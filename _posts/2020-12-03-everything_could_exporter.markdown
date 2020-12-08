---
layout: post
title: "万物皆可exporter"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [exporter](#exporter)
    * [指标类型](#指标类型)
    * [代码实现](#代码实现)
        * [Describe](#describe)
            * [🌰](#🌰)
        * [Collect](#collect)
            * [🌰](#🌰)
    * [查询指标](#查询指标)
    * [展示指标](#展示指标)
* [总结](#总结)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

创建一个简单的 prometheus exporter

# exporter

建议阅读本文前，建议新手先看一下[Prometheus-Basics](https://github.com/yolossn/Prometheus-Basics/blob/master/README.md)

官方实现了 4 个 client，(Go，Java or Scala，Python，Ruby)，我决定使用 Go 实现

## 指标类型

指标上传的 4 种方式，Counter、Gauge、Histogram、Summary

1.Counter
counter 记录的指标值只能增加或重置为 0。比如请求的数量，错误的数量。

2.Gauge
gauge 记录的指标值能增加、能减少。比如当前集群内的 pod 数据，队列里事件的数量。

3.Histogram
histogram 记录的指标值，会落在预先划好的区间里，然后将记录值放入对应的区间。比如请求时间的区间的中位值、平均值，cpu 温度的中位值、平均值。

4.Summary
summary 记录的指标值和 histogram 类似，预先不知道对应的区间，可以使用 summary 记录。

## 代码实现

主要分为两块，

1、指标的定义
2、指标采集逻辑

exporter 只要实现`Collect`和`Describe`两个 method 即可

### Describe

负责指标的定义，函数入参是\*prometheus.Desc 的单向通道，
`func (e *Exporter) Describe(ch chan<- \*prometheus.Desc)`

`func NewDesc(fqName, help string, variableLabels []string, constLabels Labels) *Desc`
指标可以通过 prometheus.NewDesc 生成出来，需要传入参数

```
fqName 指标名
help 帮助信息
variableLabels  指标的标签
constLabels 固定标签
```

标签名可以通过 prometheus.BuildFQName 构建，函数的作用是\_连接非空的入参

`func BuildFQName(namespace, subsystem, name string) string`，

#### 🌰

```golang
func (e *Exporter) Describe(ch chan<- *prometheus.Desc) {
    desc := prometheus.NewDesc(prometheus.BuildFQName("redis", "", "metricName"), "Number of receieved bytes", []string{"target"}, nil)
	ch <- desc()
}
```

### Collect

负责采集指标，函数入参是*prometheus.Metrics 的单向通道
`func (e *Exporter) Collect(ch chan<- \*prometheus.Metrics)`

Metrics 需要实现`Desc() *Desc`和`Write(*dto.Metric) error`两个接口

采集逻辑需要自己根据被采集提供的方式，进行封装

#### 🌰

```golang
func (e *Exporter) Collect(ch chan<- prometheus.Metric){
    desc := prometheus.NewDesc(prometheus.BuildFQName("redis", "", "metricName"), "Number of receieved bytes", []string{"target"}, nil)
    m, _:= prometheus.NewConstMetric(desc, prometheus.CounterValue, val, labelValues...)
	ch <- m
}
```

## 查询指标

这时候指标已经进入到 promethus 了，然后可以通过`promql`进行查询了，

[基本的查询教程](https://prometheus.io/docs/prometheus/latest/querying/basics/)

有一些常用的函数，需要了解下

rate 常用来 counter 指标类型的增长速率

max_over_time、min_over_time、avg_over_time 常用来查询 gauge 的指标类型

查询命令也可以和 lable 互动，

## 展示指标

指标最后会在 granafa 里展示，汇聚成一个 dashboard，可以保存为一个 json 文件，到处使用。
官方和社区维护很多[dashboards](https://grafana.com/grafana/dashboards)，自己多玩玩就知道了。

granfana 里需要配置 promethus 的数据源，一般都是一个 granfana 和一个 promethus 单独配对。

dashboard 里还可以配置变量，然后在 dashboard 里，根据变量选择不同的值，展示不同的数据
granfana 本身也是可以配置变量的

# 总结

整个流程是一环套一环。 1.采集指标 2.查询指标 3.绘制 dashboard

最好自己实现一个 exporter，走一遍流程，granfana、promethus 可以用 docker 启动，简单玩玩。

我可以参考[v2ray-exporter](https://github.com/wi1dcard/v2ray-exporter)，实现了一个[trojan-go-exporter](https://github.com/bzd111/trojan-go-exporter)

# Reference

- https://prometheus.io/docs/instrumenting/writing_exporters/
- https://prometheus.io/docs/prometheus/latest/querying/examples/
- https://github.com/wi1dcard/v2ray-exporter
- https://github.com/bzd111/trojan-go-exporter
