---
layout: post
title: "docker优雅退出"
date: 2019-12-16
tags: ["docker"]
slug: "2019-12-16-docker-exit"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [Docker Stop](#docker-stop)
    * [信号](#信号)
* [Solve](#solve)
    * [同步程序](#同步程序)
    * [asyncio 异步程序](#asyncio-异步程序)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

最近在服务器上部署了一个镜像，发现停止的时候很慢，需要 10 多妙。偶然看到一篇[文章](https://blog.opskumu.com/graceful-shutdown-docker.html)

# Docker Stop

docker stop 先会用信号 15(SIGTERM)去 kill，如果在指定超时时间内无法 kill，就会用信号 9(SIGKILL)去 kill。

SIGTERM 和 SIGKILL 区别：
SIGKILL 和 SIGTERM 都会终止进程，SIGTERM 会先清除临时文件、释放其它资源，然后再关闭进程，俗称优雅的退出进程。SIGKILL 是直接终止进程。

## 信号

摘自`man signal`

| No  |   Name    |  Default Action   |                   Description                   |
| --- | :-------: | :---------------: | :---------------------------------------------: |
| 1   |  SIGHUP   | terminate process |              terminal line hangup               |
| 2   |  SIGINT   | terminate process |                interrupt program                |
| 3   |  SIGQUIT  | create core image |                  quit program                   |
| 4   |  SIGILL   | create core image |               illegal instruction               |
| 5   |  SIGTRAP  | create core image |                   trace trap                    |
| 6   |  SIGABRT  | create core image |         abort program (formerly SIGIOT)         |
| 7   |  SIGEMT   | create core image |          emulate instruction executed           |
| 8   |  SIGFPE   | create core image |            floating-point exception             |
| 9   |  SIGKILL  | terminate process |                  kill program                   |
| 10  |  SIGBUS   | create core image |                    bus error                    |
| 11  |  SIGSEGV  | create core image |             segmentation violation              |
| 12  |  SIGSYS   | create core image |        non-existent system call invoked         |
| 13  |  SIGPIPE  | terminate process |         write on a pipe with no reader          |
| 14  |  SIGALRM  | terminate process |             real-time timer expired             |
| 15  |  SIGTERM  | terminate process |           software termination signal           |
| 16  |  SIGURG   |  discard signal   |       urgent condition present on socket        |
| 17  |  SIGSTOP  |   stop process    |       stop (cannot be caught or ignored)        |
| 18  |  SIGTSTP  |   stop process    |       stop signal generated from keyboard       |
| 19  |  SIGCONT  |  discard signal   |               continue after stop               |
| 20  |  SIGCHLD  |  discard signal   |            child status has changed             |
| 21  |  SIGTTIN  |   stop process    | background read attempted from control terminal |
| 22  |  SIGTTOU  |   stop process    | background write attempted to control terminal  |
| 23  |   SIGIO   |  discard signal   | I/O is possible on a descriptor (see fcntl(2))  |
| 24  |  SIGXCPU  | terminate process |   cpu time limit exceeded (see setrlimit(2))    |
| 25  |  SIGXFSZ  | terminate process |   file size limit exceeded (see setrlimit(2))   |
| 26  | SIGVTALRM | terminate process |      virtual time alarm (see setitimer(2))      |
| 27  |  SIGPROF  | terminate process |    profiling timer alarm (see setitimer(2))     |
| 28  | SIGWINCH  |  discard signal   |               Window size change                |
| 29  |  SIGINFO  |  discard signal   |          status request from keyboard           |
| 30  |  SIGUSR1  | terminate process |              User defined signal 1              |
| 31  |  SIGUSR2  | terminate process |              User defined signal 2              |

# Solve

为程序添加 SIGTERM 信号处理。

## 同步程序

只要使用 signal 模块注册一个信号处理事件就行。

signal.signal 要传入两个参数。

第一个参数是信号值，第二个是回调方法。

```python
import signal
import os
import time

exit = 0


def receive_signal(signum, stack):
    global exit
    print('Received:', signum)
    exit = 1


signal.signal(signal.SIGTERM, receive_signal)
signal.signal(signal.SIGINT, receive_signal)

print('My PID is:', os.getpid())

if __name__ == '__main__':
    while True:
        if exit:
            break
        print('Waiting...')
        time.sleep(3)

```

## asyncio 异步程序

asyncio 的 eventloop 提供 add_signal_handler 方法，用法和 signal.signal 一样。

这里展示了两种用法，第一种是通过偏函数传入参数，第二种是通过 ensure_future 将 handler_signal 放入 eventloop 里

```python
import asyncio
import functools
import os
import signal


async def main():
    while True:
        print('Wait...')
        await asyncio.sleep(3)


def handle_signal(loop):
    print('loop close....')
    loop.stop()


if __name__ == '__main__':
    print('My PID:', os.getpid())
    loop = asyncio.get_event_loop()
    loop.add_signal_handler(signal.SIGTERM, functools.partial(handle_signal, loop=loop))
    loop.add_signal_handler(
        signal.SIGINT, lambda: asyncio.ensure_future(handle_signal(loop=loop))
    )
    asyncio.ensure_future(main())
    loop.run_forever()

```

# Reference

- https://pymotw.com/3/signal/index.html
- https://pymotw.com/3/asyncio/unix_signals.html
- https://blog.opskumu.com/graceful-shutdown-docker.html
- https://stackoverflow.com/questions/23313720/asyncio-how-can-coroutines-be-used-in-signal-handlers
