---
title: "static files to go file"
date: 2021-02-23
slug: "2021-02-23-static-files-to-go-file"
categories:
	- go
tags:
	- go
---

# 前言

在使用 pingcap 的 dm 数据同步工具时，发现没起前端服务，怎么看到的配置页面。原来是把静态文件压缩放到一个 go 的 string 变量里了。
然后起了一个 `http.FileServer`。接下来实践一下。

# 实践

代码结构比较简单，有个 frontend 文件夹。

```bash
├── frontend
│   ├── dist
│   │   ├── assets
│   │   ├── favicon.ico
│   │   └── index.html
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── public
│   │   └── favicon.ico
│   ├── src
│   │   ├── App.vue
│   │   ├── assets
│   │   ├── components
│   │   └── main.js
│   └── vite.config.js
├── go.mod
├── go.sum
├── main.go
└── statik
    └── statik.go
```

## 后端代码

初始化项目，`go mod init static-embed`，创建`main.go`，内容如下

```go
//go:generate statik -src=./frontend/dist -dest=./
package main

import (
	"fmt"
	"net/http"
	"os"

	_ "static-embed/statik" // statik生成的文件会在statik下, 调用init方法

	"github.com/rakyll/statik/fs"
	"go.uber.org/zap"
)

func main() {
	statikFS, err := fs.New()
	if err != nil {
		zap.L().Error("", zap.Error(err))
		os.Exit(1)
	}
	http.Handle("/", http.StripPrefix("/", http.FileServer(statikFS)))
	err = http.ListenAndServe(fmt.Sprintf(":%d", 8080), nil)
	if err != nil {
		zap.L().Error("", zap.Error(err))
		os.Exit(1)
	}
}
```

## 前端代码

前端使用 vue3，在根目录下使用命令`npm init @vitejs/app frontend`创建项目，
直接打包`npm run build`，静态文件会生成在 dist 文件下，

## 生成 statik 文件

使用命令`go generate`，会调用`statik -src=./frontend/dist -dest=./`，生成 statik.go

## 运行

运行`go run main.go`，打开浏览器`localhost:8080`就能看到如下的图片了
![](assets/statik-vue.png)

## 原理

1. 运行`go generate`命令时，运行的是`statik -src=./frontend/dist -dest=./`，会根据 src 的目录规则去读取文件内容，然后进行 zip 压缩，赋值给 data 变量，
2. 在 `main.go` 引入，调用 `init()`方法，把 data 通过 `fs.Register` 注册到 map 上，
3. 通过 `fs.New()` 返回一个实现了`Open(name string) (File, error)`的 `Statik` 的结构体，供`http.FileServer`使用

# Reference

- https://github.com/rakyll/statik
- https://github.com/pingcap/dm/tree/master/dm/portal
