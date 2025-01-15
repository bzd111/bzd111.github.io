---
layout: post
title: "当 k8s 创建一个 pod 时，发生了什么？"
date: "2021-02-06"
tags: ["k8s"]
slug: "2021-02-06-what-happend-when-a-pod-is-created"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [过程](#过程)
* [小结](#小结)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

当 k8s 创建一个 pod 时，发生了什么？

# 过程

1. kubectl apply -f nginx.yaml

```yaml
apiVersion: apps/v1 # for versions before 1.9.0 use apps/v1beta2
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  selector:
    matchLabels:
      app: nginx
  replicas: 2 # tells deployment to run 2 pods matching the template
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.14.2
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: nginx
  labels:
    run: nginx
spec:
  ports:
    - port: 80
      protocol: TCP
  selector:
    run: nginx
```

2. APIServer 收到消息，把 Pod 信息存到 ETCD

   2.1 身份验证(authentication)

   2.2 授权验证(RBAC)是否有 create、delete、list 等权限

   2.3 进入到 Mutation Admission Controller，修改 yaml

   2.4 Schema validaion 检验上一步修改后的 yaml 时候正确

   2.5 Validation Admission Controller 检验资源用量等

3. 调度器指定 Node,修改 Pod 信息将 node 信息绑定,并更新到 ETCD 里

4. kubelet 创建 Pod

   4.1 CRI 创建 contaier

   4.2 CNI 创建 container 网络并指定 IP

   4.3 CSI 创建存储、挂载文件

   4.4 检查 livenessProbe 和 readinessProbe

   4.5 上报 pod 信息，到 ETCD

5. 如果 pod 属于 Service，接下来会创建 endpoint，通过组合 IP:PORT 暴露服务

6. Endpoints 被用于

   6.1 kube-proxy 设置 iptables 规则

   6.2 CornDNS 更新 DNS 条目

   6.3 Ingress controllers 设置 downstreams

   6.4 Service meshes(Istio)

# 小结

本篇简单介绍一下 pod 创建的流程，后续会再写文章对一些步骤进行解析。如自定义 Mutation Admission 和 Validation Admission、CNI、CSI、CRI 等。

# Reference

- https://twitter.com/danielepolencic/status/1291371746801545219?s=21
- https://draveness.me/kubernetes-pod/
