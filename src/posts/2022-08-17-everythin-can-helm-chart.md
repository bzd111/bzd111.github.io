---
date: "2022-08-17"
slug: "/2022-08-17-everythin-can-helm-chart"
layout: post
title: "万物皆可helm chart"
tags: ["helm", "k8s"]
---

<!-- vim-markdown-toc GitLab -->

* [前言](#前言)
* [Helm](#helm)
    * [remote repo](#remote-repo)
    * [local repo](#local-repo)
* [小结](#小结)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

helm 简单介绍

# Helm

helm 作为 k8s 的包管理工具，使用还是非常广的。

## remote repo

第三方提供的 helm repo

1. helm repo add devops https://harbor.xxx.cn/chartrepo/xxxx

   添加 repo

2. helm update

   更新 repo

3. helm install fdb-operator --version 0.2.0 devops/fdb-operator -n fdb

   安装

4. helm upgrade fdb-operator --version 0.4.0 devops/fdb-operator -n fdb

   更新

5. helm uninstall fdb-operator

   卸载

## local repo

新建一个 chart

1. helm create xxxx

   创建一个 xxxx 的 chart

2. helm lint .

   检查一下有没有报错

3. helm package .

   打包成 tar.gz 文件

4. helm install xxxx ./xxxx -n xxxx

   打包前也可以本地安装测试下。

   - helm uninstall xxxx

     测试完成可以选择删除

5. helm plugin install https://github.com/chartmuseum/helm-push

   如果需要推送到 harbor 就需要安装`helm-push`插件

6. helm repo add --username=xxxx --password=xxxx myrepo https://harbor.xxx.cn/chartrepo/xxxx

   当然推送之前需要添加 repo

7. helm cm-push xxxx-0.2.0.tgz myrepo

   上传到 repo

# 小结

这里只是介绍下 helm 的使用，具体怎么写 helm chart 没有涉及，

# Reference

- https://helm.sh/
