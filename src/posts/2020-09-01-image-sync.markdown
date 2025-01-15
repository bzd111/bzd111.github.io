---
layout: post
title: "[源码阅读]image-syncer"
date: "2020-09-01"
tags: ["docker"]
slug: "2020-09-01-image-sync"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [docker image](#docker-image)
    * [manifest](#manifest)
    * [layer](#layer)
    * [展示镜像信息](#展示镜像信息)
* [image syncer](#image-syncer)
    * [生成镜像同步关系](#生成镜像同步关系)
    * [生成同步任务](#生成同步任务)
    * [运行同步任务](#运行同步任务)
        * [task.Run](#task-run)
    * [同步失败重试](#同步失败重试)
    * [简化版](#简化版)
* [References](#references)

<!-- vim-markdown-toc -->

# 前言

由于我司主要的战场是在海外，所以在海外部署时，希望把镜像也同步到对应的海外区。目前采用的[image-syncer](https://github.com/AliyunContainerService/image-syncer)

# docker image

## manifest

镜像的 manifest 提供了一个 config 和一些 layer 作为容器镜像

## layer

layer 是对基础镜像每一步操作，生成的记录

## 展示镜像信息

```
docker manifest inspect --verbose hello-world

```

# image syncer

具体使用不说了，需要两个配置文件(或者写在一个里)

```
auth.json：提供镜像仓库的地址
images.json: 提供需要同步的镜像
```

为了保证并发，putATask、getATask，GetAURLPair，PutAURLPair 等均采用通道阻塞

```go
c = &Client{
        ...
		taskListChan:               make(chan int, 1),
		urlPairListChan:            make(chan int, 1),
		failedTaskListChan:         make(chan int, 1),
		failedTaskGenerateListChan: make(chan int, 1),
	}

func (c *Client) GetAURLPair() (*URLPair, bool) {
	c.urlPairListChan <- 1
	defer func() {
		<-c.urlPairListChan
	}()
    ...
}
```

启动的时候还可以指定并发 goroutine 数量 proc， 重试次数 retries，

## 生成镜像同步关系

根据配置的同步 image 信息，生成源和目的地的对应关系

```go
for source, dest := range c.config.GetImageList() {
    c.urlPairList.PushBack(&URLPair{
        source:      source,
        destination: dest,
    })
}

```

## 生成同步任务

根据并发 goroutine 数，使用`WaitGroup`进行并发，去生成 task

```go
openRoutinesGenTaskAndWaitForFinish := func() {
    wg := sync2.WaitGroup{}
    for i := 0; i < c.routineNum; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for {
                urlPair, empty := c.GetAURLPair()
                // no more task to generate
                if empty {
                    break
                }
                moreURLPairs, err := c.GenerateSyncTask(urlPair.source, urlPair.destination)
                if err != nil {
                    c.logger.Errorf("Generate sync task %s to %s error: %v", urlPair.source, urlPair.destination, err)
                    // put to failedTaskGenerateList
                    c.PutAFailedURLPair(urlPair)
                }
                if moreURLPairs != nil {
                    c.PutURLPairs(moreURLPairs)
                }
            }
        }()
    }
    wg.Wait()
}

```

## 运行同步任务

根据并发 goroutine 数，使用`WaitGroup`进行并发，去执行 task

```go
openRoutinesHandleTaskAndWaitForFinish := func() {
    wg := sync2.WaitGroup{}
    for i := 0; i < c.routineNum; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for {
                task, empty := c.GetATask()
                // no more tasks need to handle
                if empty {
                    break
                }
                if err := task.Run(); err != nil {
                    // put to failedTaskList
                    c.PutAFailedTask(task)
                }
            }
        }()
    }

    wg.Wait()
}

```

### task.Run

从源镜像中获取 manifestType 和 manifestByte，然后从到 Layer 的 Blob 信息，然后同步 Blob 和 Manifest

```go
func (t *Task) Run() error {
	// get manifest from source
	manifestByte, manifestType, err := t.source.GetManifest()

	blobInfos, err := t.source.GetBlobInfos(manifestByte, manifestType)

	// blob transformation
	for _, b := range blobInfos {
		blobExist, err := t.destination.CheckBlobExist(b)

		if !blobExist {
			// pull a blob from source
			blob, size, err := t.source.GetABlob(b)

			b.Size = size
			// push a blob to destination
			t.destination.PutABlob(blob, b)

        }
    }
	// push manifest to destination
    t.destination.PushManifest(manifestByte)
}

```

## 同步失败重试

将生成同步任务失败的 task，重新进去 urlPairList，
将同步失败的 task，重新进去 TaskList，

```go
for times := 0; times < c.retries; times++ {
    if c.failedTaskGenerateList.Len() != 0 {
        c.urlPairList.PushBackList(c.failedTaskGenerateList)
        c.failedTaskGenerateList.Init()
        // retry to generate task
        fmt.Println("Start to retry to generate sync tasks, please wait ...")
        openRoutinesGenTaskAndWaitForFinish()
    }

    if c.failedTaskList.Len() != 0 {
        c.taskList.PushBackList(c.failedTaskList)
        c.failedTaskList.Init()
    }

    if c.taskList.Len() != 0 {
        // retry to handle task
        fmt.Println("Start to retry sync tasks, please wait ...")
        openRoutinesHandleTaskAndWaitForFinish()
    }
}

```

## 简化版

```go
func (c *Client) Run() {
	fmt.Println("Start to generate sync tasks, please wait ...")

    // 根据配置的image，生成的镜像源到目的地的对应关系
    for source, dest := range c.config.GetImageList() {
		c.urlPairList.PushBack(&URLPair{
			source:      source,
			destination: dest,
		})
	}

	// generate sync tasks
	openRoutinesGenTaskAndWaitForFinish()


	// generate goroutines to handle sync tasks
	openRoutinesHandleTaskAndWaitForFinish()

    // retry
    retry()
}

```

# References

- https://github.com/AliyunContainerService/image-syncer
- https://docs.docker.com/registry/spec/manifest-v2-2/#image-manifest-field-descriptions
- https://docs.docker.com/engine/reference/commandline/manifest_inspect/
- https://stackoverflow.com/questions/57937733/how-to-enable-experimental-docker-cli-features
