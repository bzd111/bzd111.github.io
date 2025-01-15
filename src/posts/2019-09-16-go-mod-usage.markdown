---
layout: post
title: "go mod usage"
date: 2019-09-17 20:49:52 +0800
tags: ["go", "mod"]
---

## Changelog

- 2020/03/04 增加私有包下载

### 开启 GoModule 特性

```bash
❯ export GO111MODULE=on
```

### 在代码根目录下执行

`go mod init module-name`
会生成一个 go.mod 的文件,包含模块名称的声明

运行代码时,会生成`go.sum`文件,包含项目用到的依赖

### 清除过期依赖

`go mod tidy`

### 下载私有包

把 gitlab.name.com 换成自己的域名

1、先生成 ssh 私钥，然后添加到对应的平台，

`ssh-keygen -t ed25519 -C "email"`

推荐使用 ed25519 算法

2、将公钥放置到代码管理平台
3、在~/.ssh/config 添加以下内容

```
Host gitlab.name.com
  Preferredauthentications publickey
  IdentityFile ~/.ssh/id_ed25519
```

4、在~/.gitconfig 下添加以下内容

```
[url "git@gitlab.quvideo.com:"]
    insteadOf = https://gitlab.quvideo.com
```

5、设置 GOPROXY、GOPRIVATE 环境变量

`go env -w GOPRIVATE="gitlab.name.com"`
`go env -w GOPROXY=https://goproxy.cn,direct`

# Reference

- https://mp.weixin.qq.com/s/UyZUVkr-c55Y8E0zOYh8Vw
- https://juejin.im/post/5d8ee2db6fb9a04e0b0d9c8b
