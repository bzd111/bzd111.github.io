---
layout: post
title:  "go mod usage"
date:   2019-09-17 20:49:52 +0800
categories: go mod
---

### 开启GoModule特性

```bash
❯ export GO111MODULE=on
```

### 在代码根目录下执行

`go mod init module-name`
会生成一个go.mod的文件,包含模块名称的声明

运行代码时,会生成`go.sum`文件,包含项目用到的依赖

### 清除过期依赖

`go mod tidy`


#Reference

 - https://mp.weixin.qq.com/s/UyZUVkr-c55Y8E0zOYh8Vw