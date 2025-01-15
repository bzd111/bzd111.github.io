---
layout: post
title: "python3 asyncio使用"
date: "2019-11-25"
tags: ["python"]
slug: "2019-11-25-python3-asyncio"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [asyncio](#asyncio)
    * [eventloop](#eventloop)
    * [Future(GatheringFuture)](#future-gatheringfuture)
    * [Task](#task)
* [Python3.7 中的改进](#python3-7-中的改进)
* [疑问](#疑问)
    * [Future 与 Task 的不同](#future-与-task-的不同)
    * [ensure_future、create_task 差别](#ensure_future、create_task-差别)
    * [gather、wait 差别](#gather、wait-差别)
    * [协程、多线程、多进程怎么混用](#协程、多线程、多进程怎么混用)
* [未完待续](#未完待续)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

Python3，应该多使用 asyncio
**以下代码基于 python3.7**

# asyncio

由[PEP3156](https://www.python.org/dev/peps/pep-3156/)提出重启 asyncio，[PEP492](https://www.python.org/dev/peps/pep-0492/)优化写法。
更到了 Python2 不在维护的时间点，应该多使用 Python3 异步 IO

## eventloop

一个线程只会有一个事件循环，用 `threading.local` 来存放 loop 和 pid，保证同一个线程的 loop 是相同的，和 Flask 中用到的管理上下文的类似。

事件循环使用 selectors 模块，来实现异步 IO。

## Future(GatheringFuture)

asyncio 中的 Future 和 concurrent.futures 中的 Future 差不多兼容的，差别在于 asyncio 中的 Future 不是线程安全的。

GatheringFuture 是 Future 的子类，用于批量运行一些任务，运行的结果放在一个列表中。

## Task

Task 是 Future 的子类，用来创建任务。

所有的任务都会存在 weakref.WeakSet()集合中。通过内部的\_\_step 来启动、执行 coroutine。

# Python3.7 中的改进

python3.7 之前需要这么执行 main 方法

```
loop = asyncio.get_event_loop()
try:
    loop.run_until_complete(main())
finally:
    loop.close()
```

python3.7 之后只要这么一行

```
asyncio.run(main())
```

其实 asyncio.run 封装了类似的逻辑，它会新起一个 loop，去执行 main 方法。

核心逻辑如下

```
loop = events.new_event_loop()
    try:
        events.set_event_loop(loop)
        loop.set_debug(debug)
        return loop.run_until_complete(main)
    finally:
        try:
            _cancel_all_tasks(loop)
            loop.run_until_complete(loop.shutdown_asyncgens())
        finally:
            events.set_event_loop(None)
            loop.close()
```

# 疑问

## Future 与 Task 的不同

## ensure_future、create_task 差别

loop.create_task 和 asyncio.create_task，都有这个功能，官方文档推荐使用 asyncio.create_task

asyncio.create_task 其实是封装了 loop.create_task 的，loop.create_task 其实是调用了 BaseEventLoop 的 create_task，创建一个 Task 对象

ensure_future 根据传入参数不同的类型，进行不同的处理。

如果是 coroutine 也是调用 create_task，如果是 future 类型直接返回，如果是 awaitable 类型，\_wrap_awaitable 包装一下，再调用一次 ensure_future

```
def ensure_future(coro_or_future, *, loop=None):
    """Wrap a coroutine or an awaitable in a future.

    If the argument is a Future, it is returned directly.
    """
    if coroutines.iscoroutine(coro_or_future):
        if loop is None:
            loop = events.get_event_loop()
        task = loop.create_task(coro_or_future)
        if task._source_traceback:
            del task._source_traceback[-1]
        return task
    elif futures.isfuture(coro_or_future):
        if loop is not None and loop is not futures._get_loop(coro_or_future):
            raise ValueError('loop argument must agree with Future')
        return coro_or_future
    elif inspect.isawaitable(coro_or_future):
        return ensure_future(_wrap_awaitable(coro_or_future), loop=loop)
    else:
        raise TypeError('An asyncio.Future, a coroutine or an awaitable is '
                        'required')
```

## gather、wait 差别

gather、wait，都能执行一批任务，不同的是返回值。

gather 返回的是执行结果，不分先后顺序。

wait 返回两个值，分别是完成的任务和未完成的任务，然后可以遍历完成的任务获取结果，通过 Future 的 result 方法。对未完成的任务可以进行处理。

如果单纯的执行，不关注结果或只关注结果可以使用 gather。

## 协程、多线程、多进程怎么混用

有了协程，以往的多进程(处理计算密集型)、多线程(处理 IO 密集型)是不是无用武之地了？

当然不是，异步代码，需要你所有的操作都是异步的，当然这个不太可能的，所有需要使用 loop.run_in_executor 来执行同步代码，

像官方代码中的 getaddrinfo、getnameinfo 等都有使用的这个方法。

值得一提的是，run_in_executor(executor, func, \*args)，有三个参数，如果 executor 参数是 None 的话，就会通过 concurrent.futures.ThreadPoolExecutor()创建一个。

如果同步代码较多的话，可以在代码开头先创建一个线程池或进程池，达到复用的目的。

# 未完待续

# Reference

- https://docs.python.org/zh-cn/3.7/library/asyncio-task.html
- https://realpython.com/async-io-python/#other-features-async-for-and-async-generators-comprehensions
- https://www.pythonsheets.com/notes/python-asyncio.html
- https://www.dongwm.com/post/understand-asyncio-1/
- https://www.dongwm.com/post/understand-asyncio-2/
- https://www.dongwm.com/post/understand-asyncio-3/
