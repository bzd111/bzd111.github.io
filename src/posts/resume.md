---
slug: "resume"
layout: post
title: "resume"
tags: ["resume"]
---

# 个人信息

- 技术博客：[https://bzd111.me](https://bzd111.me)
- 期望职位：云原生开发工程师

# 个人评价

1. Vimer、Pythonista、Gopher，具备良好沟通、协作、学习能力，能够主动在项目中承担起责任
2. 关注前沿技术(云原生、DevOps 等)，拥抱开源。
3. 有较强的 TroubleShooting 能力，工作认真负责。

## 联系方式

- Email：zxc@bzd111.me

# 工作经历

- 杭州石原子科技有限公司(2022 年 4 月 ~ 2022 年 8 月) 云原生开发工程师
- 杭州有赞科技(2021 年 5 月 ~ 2022 年 3 月) 高级运维开发工程师
- 杭州趣维科技有限公司(2019 年 4 月 ~ 2021 年 5 月) 高级运维开发工程师
- 上海苗圃网络科技有限公司(2018 年 6 月 ~ 2019 年 4 月) 后端开发工程师
- 杭州优云软件有限公司(2016 年 8 月 ~ 2018 年 6 月) Python 开发工程师

# 项目经历

## Cluster Operator(杭州石原子公司)

- 提供 gRPC 接口，创建 cluster cr
- controller 来 Reconcile cluster cr，针对不同的集群类型，来创建 k8s 对象
- 使用 virtual kubelet 来运行 cluster cr

## PodTrace(杭州有赞科技)

主要负责维护当前集群中 pod 的详细信息

- list watch 各集群中 Pod，并保存到数据库中，并和数据库中的 Pod 信息进行比对，若有变化则更新数据库中的 Pod 信息
- 使用 SPDY 协议对接前端 ws，实现在前端 web-console

## Qimastack 云平台 3.0(杭州有赞科技)

项目使用 DDD 设计理念开发运维平台，主要负责发布功能的开发

- 参与主机伸缩容发布，负责统计 Node 的使用量，同步保存到数据库中
- 甬道发布、(批量)普通发布、(批量)蓝绿发布、(批量)灰度发布、回滚、链路蓝绿发布等发布操作
- 发布策略，路由流量规则推送，应用流量染色等规则操作
- CustomResourceDefinition 定时伸缩容，使用 OpenKruise sidecarset 拆分富容器等 k8s 相关工作
- 使用 kubevela OAM 模型管理应用，对接容器平台使用 karmada 分发 deployment
- 负责 severless 开发，对接腾讯云的云函数，支持有赞云提供相应能力

## 混合云运维平台项目(杭州趣维科技有限公司)

负责前后端框架的搭建、开发和维护。

系统主要模块

- 登陆注册
- 权限管理
- 对接公司 OAuth
- 账单管理
- 主机管理
- 域名、DNS、证书等管理
- 发布管理
- 基础数据(VPC、启动模板、交换机、安全组等)

## 服务器监控端开发项目(杭州优云软件有限公司)

负责本地监控框架的开发、改造和维护
部署在机器上的 agent，采，收集磁盘、CPU、内存等系统本身的指标和其他安装的应用的指标兼容阿里云、华为云、openstack、nagios 的采集集成。

## 开源项目

- [harbor](https://github.com/bzd111/harbor): Fix aliyun acr replicas
- [rq-exporter](https://github.com/mdawar/rq-exporter): Prometheus metrics exporter for Python RQ (Redis Queue)
- [trojan-go-exporter](https://github.com/bzd111/trojan-go-exporter): trajan-go exporter
- [k8s-pod-inject](https://github.com/bzd111/k8s-sw-agent): k8s pod inject skywalking-agent
- [kconf](https://github.com/particledecay/kconf)：k8s 配置管理
- [pysheet 中文译文](https://pysheet-cn.readthedocs.io/zh_CN/latest/)：[pysheeet](https://github.com/crazyguitar/pysheeet)的中文译文

# 技能清单

1. 熟悉 Python/Golang，能独立开发 Web 服务(Django/Flask/Gin)，了解 RESTFul API/Graphql/gRPC 等请求方式，及 DDD 的开发理念
2. 能独立开发、部署前端项目(React、Antd)
3. 了解 MySQL、Redis、NSQ、FDB 等使用
4. 熟悉 AWS、AliYun、腾讯云等云厂商产品，能独立部署 k8s 集群环境、提供对外访问、日志采集、指标监控、自动扩缩容等能力。
5. 拥有 Akamai Web Performance Foundations 证书，能独立配置 akamai cdn 加速。
6. 熟悉 k8s 操作，能独立开发 Promethus Exporter、Admission Webhook、CRD、Operator 等