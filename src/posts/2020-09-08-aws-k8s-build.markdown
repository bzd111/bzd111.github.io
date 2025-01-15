---
layout: post
title: "aws eks搭建"
date: "2020-09-08"
tags: ["k8s"]
slug: "2020-09-08-aws-k8s-build"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [准备](#准备)
* [部署](#部署)
    * [划分子网](#划分子网)
    * [部署 Master](#部署-master)
    * [创建 NodeGroup](#创建-nodegroup)
* [Alb 配置](#alb-配置)
* [监控](#监控)
    * [部署](#部署)
    * [持久化](#持久化)
        * [prometheus](#prometheus)
        * [grafana](#grafana)
* [小结](#小结)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

用了 aws 也有一段时间了，记录下用 cli 命令，创建托管 k8s 集群

# 准备

1. 安装 eksctl

```sh
brew tap weaveworks/tap
brew install weaveworks/tap/eksctl
```

更多安装请看[链接](https://docs.aws.amazon.com/zh_cn/eks/latest/userguide/eksctl.html#installing-eksctl)

2. 安装 awscli

```sh
pip install awscli
```

3. 配置权限
   根据提示输入 aws ak，配置文件保存在家目录下的.aws 文件下

```sh
aws configure
```

4. 验证权限
   有返回用户信息，就说明权限

```
aws sts get-caller-identity
```

# 部署

## 划分子网

建议：分散可用区，子网范围尽量大(aws 的 eks node 和 pod 网段是同层的，每个 node 会预留 30 个 ip)

一般分在 3 个可用区里，如

```
pub-1a subnet-111111111111
pub-1b subnet-222222222222
pub-1c subnet-333333333333
```

为每个子网打上标签(cluster-name 要统一)

```
kubernetes.io/cluster/cluster-name:shared
kubernetes.io/role/elb:1
```

## 部署 Master

create-cluster.yaml

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: cluster-name
  region: ap-south-1
  version: "1.17"
vpc:
  subnets:
    public:
      ap-south-1a: { id: subnet-111111111111 }
      ap-south-1b: { id: subnet-222222222222 }
      ap-south-1c: { id: subnet-333333333333 }
```

创建集群

`eksctl create cluster -f create-cluster.yaml`

## 创建 NodeGroup

create-nodegroup.yaml

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: cluster-name
  region: ap-south-1
  version: "1.17"

vpc:
  subnets:
    public:
      ap-south-1a: { id: subnet-111111111111 }
      ap-south-1b: { id: subnet-222222222222 }
      ap-south-1c: { id: subnet-333333333333 }
  securityGroup: "sg-05067cf3f9fee95c8"
managedNodeGroups:
  - name: ng-workers-0 # 指定名称
    labels: { role: workers } # 打标签
    instanceType: m5.2xlarge # 指定机型
    desiredCapacity: 4 # 下面三行和autoScaler有关
    minSize: 3
    maxSize: 40
    volumeSize: 200
    tags:
      nodegroup-role: worker
    iam:
      withAddonPolicies:
        autoScaler: true
        cloudWatch: true
        albIngress: true
    ssh:
      publicKeyName: "node-key" # 指定ec2上密钥对名称，需提前创建
```

执行文件
`eksctl create nodegroup -f create-nodegroup.yaml`

# Alb 配置

具体看一下这个[文档](https://docs.aws.amazon.com/zh_cn/eks/latest/userguide/alb-ingress.html)讲的很详细

配置文件，可以在[文档](https://kubernetes-sigs.github.io/aws-alb-ingress-controller/guide/ingress/annotation/)上看到更多用法，如访问日志放到 s3(通过 logstash 同步到 es,然后通过 kibana 展示)、添加证书、健康检查等

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  namespace: default
  name: ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/actions.service-1: >
      {"Type":"forward","ForwardConfig":{"TargetGroups":[{"ServiceName":"service-1","ServicePort":"8080","Weight":98}],"TargetGroupStickinessConfig":{"Enabled":false}}}
spec:
  rules:
    - http:
        paths:
          - path: /path
            backend:
              serviceName: service-1
              servicePort: use-annotation
```

# 监控

采用开源的[kube-prometheus](https://github.com/prometheus-operator/kube-prometheus)

## 部署

在`kube-prometheus/manifests`下直接执行`kubectl apply -f .`即可

## 持久化

### prometheus

在`kube-prometheus/manifests/prometheus-prometheus.yaml`中添加下文+开头部分，storageClassName 使用 aws eks 自带的 gp2

```yaml
apiVersion: monitoring.coreos.com/v1
kind: Prometheus
metadata:
  labels:
    prometheus: k8s
  name: k8s
  namespace: monitoring
spec:
  alerting:
    alertmanagers:
    - name: alertmanager-main
      namespace: monitoring
      port: web
+ storage:
+   volumeClaimTemplate:
+     spec:
+       storageClassName: gp2
+       resources:
+         requests:
+           storage: 500Gi
  image: quay.io/prometheus/prometheus:v2.20.0
  nodeSelector:
    kubernetes.io/os: linux
  podMonitorNamespaceSelector: {}
  podMonitorSelector: {}
  replicas: 2
  resources:
    requests:
      memory: 400Mi
  ruleSelector:
    matchLabels:
      prometheus: k8s
      role: alert-rules
  securityContext:
    fsGroup: 2000
    runAsNonRoot: true
    runAsUser: 1000
  serviceAccountName: prometheus-k8s
  serviceMonitorNamespaceSelector: {}
  serviceMonitorSelector: {}
  version: v2.20.0
```

### grafana

先创建 pvc，使用 aws eks 自带的 gp2

```yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: grafana-pvc
  namespace: monitoring
spec:
  accessModes:
    - "ReadWriteOnce"
  storageClassName: gp2
  resources:
    requests:
      storage: 100Gi
```

在`kube-prometheus/manifests/grafana-deployment.yaml`中在相应部分替换

```yaml
volumes:
  - emptyDir: {}
    name: grafana-storage
```

替换成下面的

```yaml
volumes:
  - name: grafana-storage
    persistentVolumeClaim:
      claimName: grafana-pvc
```

# 小结

到此，集群就搭建完成

# Reference

- https://eksctl.io/usage/creating-and-managing-clusters/
- https://eksctl.io/usage/managing-nodegroups/
- https://docs.aws.amazon.com/zh_cn/eks/latest/userguide/alb-ingress.html
- https://kubernetes-sigs.github.io/aws-alb-ingress-controller/guide/ingress/annotation/
