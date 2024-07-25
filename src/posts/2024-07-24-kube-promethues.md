---
date: "2024-07-24"
slug: "/2024-07-24-kube-promethues"
layout: post
title: "custom kube-promethues"
tags: ["custom", "promethues"]
---


<!-- vim-markdown-toc GitLab -->

* [前言](#前言)
* [custom](#custom)
    * [1. 安装工具](#1-安装工具)
    * [2. 初始化](#2-初始化)
    * [3. 修改example.jsonnet，取消注释custom-metrics和external-metrics](#3-修改examplejsonnet取消注释custom-metrics和external-metrics)
    * [4. 重新生成](#4-重新生成)
    * [5. 部署](#5-部署)
    * [6. 删除](#6-删除)
* [reference](#reference)

<!-- vim-markdown-toc -->


# 前言
在使用kube-proemethues，根据github默认提供的manifests，没有带custom-metrics，因为最近需要用到自定义指标的hpa

# custom
参考[官方教程](https://github.com/prometheus-operator/kube-prometheus/blob/main/docs/customizing.md)

### 1. 安装工具
```bash
go install -a github.com/jsonnet-bundler/jsonnet-bundler/cmd/jb@latest
go install github.com/brancz/gojsontoyaml@latest
go install github.com/google/go-jsonnet/cmd/jsonnet@latest
```

### 2. 初始化

```bash
mkdir my-kube-prometheus; cd my-kube-prometheus
mkdir my-kube-prometheus; cd my-kube-prometheus
jb init  # Creates the initial/empty `jsonnetfile.json`
# Install the kube-prometheus dependency
jb install github.com/prometheus-operator/kube-prometheus/jsonnet/kube-prometheus@main # Creates `vendor/` & `jsonnetfile.lock.json`, and fills in `jsonnetfile.json`

wget https://raw.githubusercontent.com/prometheus-operator/kube-prometheus/main/example.jsonnet -O example.jsonnet
wget https://raw.githubusercontent.com/prometheus-operator/kube-prometheus/main/build.sh -O build.sh
chmod +x build.sh
```
### 3. 修改example.jsonnet，取消注释custom-metrics和external-metrics

```
local kp =
  (import 'kube-prometheus/main.libsonnet') +
  // Uncomment the following imports to enable its patches
  // (import 'kube-prometheus/addons/anti-affinity.libsonnet') +
  // (import 'kube-prometheus/addons/managed-cluster.libsonnet') +
  // (import 'kube-prometheus/addons/node-ports.libsonnet') +
  // (import 'kube-prometheus/addons/static-etcd.libsonnet') +
  (import 'kube-prometheus/addons/custom-metrics.libsonnet') +
  (import 'kube-prometheus/addons/external-metrics.libsonnet') +
  // (import 'kube-prometheus/addons/pyrra.libsonnet') +
  {
    values+:: {
      common+: {
        namespace: 'monitoring',
      },
    },
  };

{ 'setup/0namespace-namespace': kp.kubePrometheus.namespace } +
{
  ['setup/prometheus-operator-' + name]: kp.prometheusOperator[name]
  for name in std.filter((function(name) name != 'serviceMonitor' && name != 'prometheusRule'), std.objectFields(kp.prometheusOperator))
} +
// { 'setup/pyrra-slo-CustomResourceDefinition': kp.pyrra.crd } +
// serviceMonitor and prometheusRule are separated so that they can be created after the CRDs are ready
{ 'prometheus-operator-serviceMonitor': kp.prometheusOperator.serviceMonitor } +
{ 'prometheus-operator-prometheusRule': kp.prometheusOperator.prometheusRule } +
{ 'kube-prometheus-prometheusRule': kp.kubePrometheus.prometheusRule } +
{ ['alertmanager-' + name]: kp.alertmanager[name] for name in std.objectFields(kp.alertmanager) } +
{ ['blackbox-exporter-' + name]: kp.blackboxExporter[name] for name in std.objectFields(kp.blackboxExporter) } +
{ ['grafana-' + name]: kp.grafana[name] for name in std.objectFields(kp.grafana) } +
// { ['pyrra-' + name]: kp.pyrra[name] for name in std.objectFields(kp.pyrra) if name != 'crd' } +
{ ['kube-state-metrics-' + name]: kp.kubeStateMetrics[name] for name in std.objectFields(kp.kubeStateMetrics) } +
{ ['kubernetes-' + name]: kp.kubernetesControlPlane[name] for name in std.objectFields(kp.kubernetesControlPlane) }
{ ['node-exporter-' + name]: kp.nodeExporter[name] for name in std.objectFields(kp.nodeExporter) } +
{ ['prometheus-' + name]: kp.prometheus[name] for name in std.objectFields(kp.prometheus) } +
{ ['prometheus-adapter-' + name]: kp.prometheusAdapter[name] for name in std.objectFields(kp.prometheusAdapter) }
```

### 4. 重新生成

  执行下面的命令，会生成manifests文件夹

```bash
./build.sh example.jsonnet
```

### 5. 部署
```bash
# Update the namespace and CRDs, and then wait for them to be available before creating the remaining resources
kubectl apply --server-side -f manifests/setup
kubectl apply -f manifests/
```

### 6. 删除

```bash

kubectl delete --ignore-not-found=true -f manifests/ -f manifests/setup

```


# reference
- https://github.com/prometheus-operator/kube-prometheus
- https://github.com/prometheus-operator/kube-prometheus/blob/main/docs/customizing.md

