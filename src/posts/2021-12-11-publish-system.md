---
layout: post
title: "我所理解的发布系统"
date: 2021-12-11
tags: ["gitlab"]
slug: "2021-12-11-publish-system"
---

<!-- vim-markdown-toc GitLab -->

* [前言](#前言)
    * [打包](#打包)
    * [发布](#发布)
        * [正常发布](#正常发布)
        * [灰度发布](#灰度发布)
        * [蓝绿发布](#蓝绿发布)
        * [回滚发布](#回滚发布)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

浅谈我所理解的发布系统，主要功能打包和部署。

## 打包

打包就是把代码打包成 docker 镜像，上传到相应的镜像仓库。

打包的时机，可以是你提交了分支并且通过了单测 etc.

## 发布

发布就是把 k8s deployment 里的 image 改成刚刚打包的镜像。

验证发布完成，一般的方法都是轮训 pod 的状态和 deployment 的状态。如果在规定时间内 ready，那说明本次发布成功。如果超出规定时间，就是发布失败

k8s 提供了便捷的[滚动更新的策略](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/#strategy)可以配合使用。

### 正常发布

正常发布需要提前打包，然后使用 k8s 滚动更新即可。

### 灰度发布

少量流量验证，会新建一个较小规模(比如原有的 20%)的 deployment 来简单验证

这时候创建出来的灰度 deployment 可能只有 20%规模，所以配合网关切流的时候会控制最大只能切 20%流量。

当验证成功时，需要将灰度的 deployment 和流量规则删除，重新滚动更新支持全部流量的 deployment

### 蓝绿发布

全量流量验证，会新建一个一样规模的 deployment 来全量验证

通过`blue\green`来回替换，表明当前稳定版本是`blue`还是`green`，在搭配网关来配置流量规则，慢慢切流验证。

当新版验证没问题时，只需要把老版本的 deployment 和切流时使用的流量规则删除掉即可

### 回滚发布

回滚可以通过`.spec.strategy.rollingUpdate.maxSurge`控制回滚的速度。

相比正常发布，它少了打包的过程，其他都一样。

# Reference

简单的发布配合 K8S 已经做的很方便了，
像灰度、蓝绿需要搭配网关协作，就稍微麻烦一点了。

社区也开源了很多 API 网关可以搭配使用。
