---
layout: post
title: kube多config管理
date: "2020-05-07"
tags: ["k8s"]
slug: "2020-05-07-k8s-manage-context"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [kubeconfig](#kubeconfig)
* [工具](#工具)
    * [kconf](#kconf)
    * [kubectx&&kubens](#kubectx-amp-amp-kubens)
    * [kube-ps1](#kube-ps1)
    * [kubecolor](#kubecolor)
* [使用](#使用)

<!-- vim-markdown-toc -->

# 前言

由于工作原因，需要操作多个 k8s 集群，所以整理下如何简单操作。

# kubeconfig

[config](https://github.com/kubernetes/kubernetes/blob/bd6640a8e003059ee98f84e7378d97f8337c5e0b/staging/src/k8s.io/client-go/tools/clientcmd/api/types.go#L31)这个结构体定义了 kubeconfig 的所有配置，比较重要的字段有`Clusters,AuthInfos,Contexts`，
在 clusters 和 authinfos 指定相关信息，然后通过 contexts 中的 Cluster 和 AuthInfo 字段来引用

# 工具

## [kconf](https://github.com/particledecay/kconf)

kconf 用来添加 kubeconfig，

使用方法：
`kconf add /path/to/kubeconfig.conf --context-name=myContext`

也可以用来切换 context
使用方法：
`kconf use`

## [kubectx&&kubens](https://github.com/ahmetb/kubectx)

kubectx 用来切换 context
![使用情况](https://github.com/ahmetb/kubectx/raw/master/img/kubectx-demo.gif)

kubens 用来切换 namespace
![使用情况](https://github.com/ahmetb/kubectx/raw/master/img/kubens-demo.gif)

## [kube-ps1](https://github.com/jonmosco/kube-ps1)

kube-ps1 用来展示当前的 context 和 namespace
![kube-ps1](https://github.com/jonmosco/kube-ps1/raw/master/img/kube-ps1.gif)

kubeon 开启

kubeoff -g 全局关闭

## [kubecolor](https://github.com/dty1er/kubecolor)

能让输出变得有颜色

安装方法

```
brew install dty1er/tap/kubecolor
```

设置别名

```
alias kubectl="kubecolor"
```

![kubecolor](https://user-images.githubusercontent.com/60682957/95733375-04929680-0cbd-11eb-82f3-adbcfecf4a3e.png)

# 使用

1、先把使用 kconf 添加配置

2、然后使用 kconf 或者 kubectx 切换 context

3、然后使用 kubens 切换 namespace

4、然后使用 kubeon 打开命令行提示

5、最后使用 kubeoff 关闭命令行提示
