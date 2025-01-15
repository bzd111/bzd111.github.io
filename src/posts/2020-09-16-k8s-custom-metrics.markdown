---
layout: post
title: "k8s自定义指标HPA"
date: "2020-09-16"
tags: ["k8s"]
slug: "2020-09-16-k8s-custom-metrics"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [pre-install](#pre-install)
    * [kube-prometheus](#kube-prometheus)
    * [prometheus-adapter](#prometheus-adapter)
* [Metrics](#metrics)
    * [指标类型](#指标类型)
* [Expose Metrics](#expose-metrics)
    * [metrics url](#metrics-url)
    * [exporter](#exporter)
        * [Go code](#go-code)
* [PodMonitor](#podmonitor)
* [ServiceMonitor](#servicemonitor)
* [HPA](#hpa)
* [Demo](#demo)
    * [nsq-pod](#nsq-pod)
    * [nsq-service](#nsq-service)
    * [nsq-servicemonitor](#nsq-servicemonitor)
    * [nsq-hpa](#nsq-hpa)
* [总结](#总结)
* [Renference](#renference)

<!-- vim-markdown-toc -->

# 前言

为了更好的扩缩容，自定义一些指标，作为 HPA 的标准，在本文中采用 nsq 的队列长度作为指标

# pre-install

准备工作，准备一个 K8S 集群，然后安装下面两个组件

## kube-prometheus

安装[kube-prometheus](https://github.com/prometheus-operator/kube-prometheus)

`kubectl apply -f kube-prometheus-0.4.0/manifests/`

## prometheus-adapter

安装[prometheus-adapter](https://github.com/DirectXMan12/k8s-prometheus-adapter)

将 prometheus-service-name、namespace 改成实际的名称

```
kubectl create namespace custom-metrics
helm install prometheus-adapter stable/prometheus-adapter -n  custom-metrics --set prometheus.url=http://<prometheus-service-name>.<namespace>.svc
```

# Metrics

指标的格式是三行

第一行是 HELP 开头的基础信息

第二行是 TYPE 开头的指标名称和指标类型

第三行是具体的指标值

```
# HELP myapp_processed_ops_total The total number of processed events
# TYPE myapp_processed_ops_total counter
myapp_processed_ops_total 5
```

## 指标类型

Counter: 累积量度，代表一个单调递增的计数器

Gague: 通常用于测量值，例如温度或当前内存使用情况，但也可以用于上升和下降的“计数”，例如正在运行的 goroutine 的数量。

Histogram: 直方图对观察值（通常是请求持续时间或响应大小之类的东西）进行采样，并将其计数在可配置的存储桶中。

Summary: 采样观察值（通常是请求持续时间和响应大小之类的东西）

# Expose Metrics

应用暴露指标通常有两种方式，一种是通过自身提供 metrics url 接口，第二种是 exporter 将指标导出成 Prometheus 的指标

## metrics url

通常在应用层暴露 http 接口，就像多提供一个健康检查的接口一样

## exporter

当使用的中间件(数据库、消息队列)没有提供接口时，可以使用这种方式，产用外接一个 exporter 的方式，获取它的指标信息

### Go code

使用 prometheus 提供的 golang client，可以简单的增加指标。prometheus 同时还支持 python、java、ruby 的客户端

这样就可以拿到指标了

```golang
package main

import (
        "net/http"
        "time"

        "github.com/prometheus/client_golang/prometheus"
        "github.com/prometheus/client_golang/prometheus/promauto"
        "github.com/prometheus/client_golang/prometheus/promhttp"
)

func recordMetrics() {
        go func() {
                for {
                        opsProcessed.Inc()
                        time.Sleep(2 * time.Second)
                }
        }()
}

var (
        opsProcessed = promauto.NewCounter(prometheus.CounterOpts{
                Name: "myapp_processed_ops_total",
                Help: "The total number of processed events",
        })
)

func main() {
        recordMetrics()

        http.Handle("/metrics", promhttp.Handler())
        http.ListenAndServe(":2112", nil)
}
```

# PodMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  namespace: monitoring
  name: pm
  labels:
    k8s-app: pm-exporter
spec:
  jobLabel: app
  podMetricsEndpoints:
    - port: metrics
      interval: 15s
  selector:
    matchLabels:
      app: app-for-pm
  namespaceSelector:
    matchNames:
      - default
```

需要在 pod 的 template 中添加

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/path: "/metrics"
  prometheus.io/port: "port" # pod实际的端口
```

# ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: sm
  namespace: monitoring
  labels:
    k8s-app: sm-exporter
spec:
  jobLabel: app
  endpoints:
    - port: metrics
      interval: 15s
  selector:
    matchLabels:
      app: sm
  namespaceSelector:
    matchNames:
      - default
```

需要在 Service 上指定名称，端口

```yaml
spec:
  ports:
    - port: 9117
      protocol: TCP
      targetPort: 9117
      name: metrics
```

# HPA

```yaml
apiVersion: autoscaling/v2beta2
kind: HorizontalPodAutoscaler
metadata:
  name: nsq-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nsq-deployment # 需要扩缩容的deployment名字
  minReplicas: 60
  maxReplicas: 150
  metrics:
    - type: Object
      object:
        metric:
          name: "metrics-name" # 需要监控的指标
          selector:
            matchLabels:
              "topic": "topic-name"
        describedObject:
          apiVersion: "v1"
          kind: Service
          name: nsq-exporter-svc # 从哪里获取指标
        target:
          type: Value
          value: 10
```

# Demo

## nsq-pod

```yaml
---
apiVersion: v1
kind: Pod
metadata:
  name: nsq-exporter
  labels:
    app: nsq-exporter
spec:
  containers:
    - name: nsq-exporter
      image: nsq-prometheus-exporter:latest
      imagePullPolicy: IfNotPresent
      ports:
        - containerPort: 9117
          name: metrics
      readinessProbe:
        tcpSocket:
          port: 9117
        initialDelaySeconds: 3
        periodSeconds: 10
      env:
        - name: NSQD_ADDR
          value: "http://nsqd-2.nsqd:4151/stats"
      args: ["-nsqd.addr", "$(NSQD_ADDR)"]
```

## nsq-service

```yaml
---
apiVersion: v1
kind: Service
metadata:
  labels:
    app: nsq-exporter
  name: nsq-exporter-svc
spec:
  ports:
    - port: 9117
      protocol: TCP
      targetPort: 9117
      name: metrics
  selector:
    app: nsq-exporter
  type: ClusterIP # ClusterIP or LoadBalancer
```

## nsq-servicemonitor

```yaml
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: nsq
  namespace: monitoring
  labels:
    k8s-app: nsq-exporter
spec:
  jobLabel: app
  endpoints:
    - port: metrics
      interval: 15s
  selector:
    matchLabels:
      app: nsq-exporter
  namespaceSelector:
    matchNames:
      - default
```

## nsq-hpa

```yaml
apiVersion: autoscaling/v2beta2
kind: HorizontalPodAutoscaler
metadata:
  name: video-post-vid-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: app-deployment # 需要扩缩容的deployment名字
  minReplicas: 60
  maxReplicas: 150
  metrics:
    - type: Object
      object:
        metric:
          name: "nsq_channel_depth" # 需要监控的指标
          selector:
            matchLabels:
              "topic": "topic-name"
        describedObject:
          apiVersion: "v1"
          kind: Service
          name: nsq-exporter-svc # 从哪里获取指标
        target:
          type: Value
          value: 10
```

# 总结

![纵览](https://github.com/prometheus-operator/prometheus-operator/blob/master/Documentation/custom-metrics-elements.png?raw=true)

# Renference

- https://prometheus.io/docs/concepts/metric_types/
- https://prometheus.io/docs/instrumenting/exporters/
- https://github.com/prometheus/client_golang
- https://github.com/prometheus-operator/prometheus-operator
- https://github.com/prometheus-operator/prometheus-operator/tree/master/Documentation
