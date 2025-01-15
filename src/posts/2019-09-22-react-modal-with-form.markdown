---
layout: post
title:  "ant design的modal中使用多个form表单"
date:   2019-09-22 11:34:52 +0800
tags: ["react", "ant design"]
slug: "2019-09-22-ant-design的modal中使用多个form表单"
---

# 前情提要
最近有个需求，需要在modal，提交多个表单数据，有点类似录入多条信息。这个需求的难点，在于如果获取到所有表单的数据。

# 过程
在ant design的文档中，只发现了提交单个表单的数据的[例子](https://ant.design/components/form-cn/#components-form-demo-form-in-modal)，从这个例子中我们可以看到
一个关键的属性`wrappedComponentRef`

## wrappedComponentRef
看[源码](https://github.com/react-component/form/blob/master/src/createBaseForm.js)不难发现，它是组件的一个属性，用于获取form的ref，然后拿到form的实例，然后可以进行获取value

## 方案
将form放在一个数组里，然后按添加按钮的时候往数组添加一个值，然后渲染数据时，遍历数组就行，同时使用wrappedComponentRef把form的实例绑定当前的组件上。

## code example
[demo](https://codesandbox.io/embed/inspiring-oskar-4nlpr)
