---
layout: post
title: "[笔记]aiohttp 使用"
date: "2019-12-19"
tags: ["python"]
slug: "2019-12-19-aiohttp-usage"
---

<!-- vim-markdown-toc GFM -->

* [前言](#前言)
* [asyncio](#asyncio)
    * [asyncio.run](#asynciorun)
    * [asyncio 运行多任务](#asyncio-运行多任务)
* [aiohttp](#aiohttp)
    * [client](#client)
    * [server](#server)
        * [A Minimal Application](#a-minimal-application)
        * [装饰器方法](#装饰器方法)
        * [url 参数和 query 参数](#url-参数和-query-参数)
        * [返回 json 的 response](#返回-json-的-response)
        * [使用数据库](#使用数据库)
    * [template](#template)
    * [middleware](#middleware)
    * [seesion](#seesion)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

这篇文章简单介绍下 aiohttp,这个是看了 pycon2019[视频](https://www.youtube.com/watch?v=OxzVApXKWYM&list=PLPbTDk1hBo3xof51R8pk3kP1BVBuMYP9c&index=9&t=2193s)的观后感
视频不错,作者本身是 python 核心开发者。

视频时间 2 个小时，比较长，没有时间的话，可以看作者提供的[文档](https://us-pycon-2019-tutorial.readthedocs.io/)

# asyncio

python3.7 提供了`asyncio.run方法`，运行协程更方便，可以看一下下面的 🌰

## asyncio.run

```python
# python3.5之前
In :import asyncio
In :@asyncio.coroutine
... def fib(n: int):
...     a, b = 0, 1
...     for _ in range(n):
...         b, a = a + b, b
...     return a
...
In :@asyncio.coroutine
... def coro(n: int):
...     for x in range(n):
...         yield from asyncio.sleep(1)
...         f = yield from fib(x)
...         print(f)
...
In :loop = asyncio.get_event_loop()
In :loop.run_until_complete(coro(3))
0
1
1
```

```python
# python3.5以上(包含3.5)
In :import asyncio
In :async def fib(n: int):
...     a, b = 0, 1
...     for _ in range(n):
...         b, a = a + b, b
...     return a
...
In :async def coro(n: int):
...     for x in range(n):
...         await asyncio.sleep(1)
...         f = await fib(x)
...         print(f)
...
In :loop = asyncio.get_event_loop()
In :loop.run_until_complete(coro(3))
0
1
1
```

```python
# python3.7
In :import asyncio

In :async def fib(n: int):
...     a, b = 0, 1
...     for _ in range(n):
...         b, a = a, a + b
...     return a
...

In :async def coro(n: int):
...     for x in range(n):
...         await asyncio.sleep(1)
...         f = await fib(x)
...         print(f)

In :asyncio.run(coro(3))
0
1
1

```

## asyncio 运行多任务

使用 asyncio.gather，返回的结果就是 task 的结果，而且是无序的

使用 asyncio.wait，返回的结果是 done, pending 两个参数，分别代表已完成的 task 和正在等待的 pending,

task 的结果，需要遍历去调用 task 的 result 的方法才能获取到。

```python
import asyncio
import time


async def long_running_task(time_to_sleep: int) -> int:
    print(f'Begin sleep for {time_to_sleep}')
    await asyncio.sleep(time_to_sleep)
    print(f'Awake from {time_to_sleep}')
    return time_to_sleep


async def main() -> None:
    task1 = asyncio.create_task(long_running_task(2))
    task2 = asyncio.create_task(long_running_task(3))
    task3 = asyncio.create_task(long_running_task(5))
    # results = []
    # done, pending = await asyncio.wait([task3, task2, task1])
    # for d in done:
    #     results.append(d.result())
    # print('resuluts: ', results)
    # print('pending: ', pending)

    results = await asyncio.gather(task1, task2, task3)
    print('resuluts: ', results)


if __name__ == '__main__':
    s = time.perf_counter()
    asyncio.run(main())
    elapsed = time.perf_counter() - s
    print(f'Excetion time: {elapsed:0.2f} seconds.')

```

# aiohttp

异步 HTTP 客户端/服务器

## client

可以用作异步请求的客户端，requests 只能做同步请求。

使用方法也很简单，用 aiohttp.ClientSession()开启一个会话，然后通过这个会话是发起 http 请求，这里
只演示了 get，也可以用作其他的 method。返回的结果通过 read()方法获取到。

这里使用异步的上下文管理器，用法和普通的是一样的，只是前面加了 async 关键字。

```python
import asyncio
import time

import aiohttp


async def download_pep(pep_number: int) -> bytes:

    url = f"https://www.python.org/dev/peps/pep-{pep_number}/"
    print(f"Begin downloading {url}")
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            content = await resp.read()
            print(f"Finished downloading {url}")
            return content


async def write_to_file(pep_number: int, content: bytes) -> None:
    filename = f"async_{pep_number}.html"
    with open(filename, "wb") as pep_file:
        print(f"Begin writing to {filename}")
        pep_file.write(content)
        print(f"Finished writing {filename}")


async def web_scrape_task(pep_number: int) -> None:
    content = await download_pep(pep_number)
    await write_to_file(pep_number, content)


async def main() -> None:
    tasks = []
    for i in range(8010, 8016):
        tasks.append(web_scrape_task(i))
    await asyncio.wait(tasks)


if __name__ == "__main__":
    s = time.perf_counter()

    asyncio.run(main())

    elapsed = time.perf_counter() - s
    print(f"Execution time: {elapsed:0.2f} seconds.")
```

## server

### A Minimal Application

最简单的例子，使用也很简单，定义一个 handle 函数，然后绑定路由，就可以了。

```python
from aiohttp import web


async def handler(request: web.Request) -> web.Response:
    return web.Response(text="Hello world")


async def init_app() -> web.Application:
    app = web.Application()
    app.add_routes([web.get("/", handler)])
    return app


web.run_app(init_app())
```

### 装饰器方法

可以使用路由装饰器的方法

```python
from aiohttp import web

router = web.RouteTableDef()


@router.get('/')
async def handler(request: web.Request) -> web.Response:
    return web.Response(text="Hello world")


async def init_app() -> web.Application:
    app = web.Application()
    app.add_routes(router)
    return app


web.run_app(init_app())

```

### url 参数和 query 参数

url 参数和 query 参数，分别由 match_info、rel_url 获取

```python
from aiohttp import web

router = web.RouteTableDef()


@router.get('/')
async def handler(request: web.Request) -> web.Response:
    return web.Response(text="Hello world")


@router.get('/{username}')
async def greet_user(request: web.Request) -> web.Response:
    # http://0.0.0.0:8080/<student>?page=<pagenum>
    user = request.match_info.get('username', '')
    page_num = request.rel_url.query.get('page', '')
    return web.Response(text=f'Hello, {user} {page_num}')


async def init_app() -> web.Application:
    app = web.Application()
    app.add_routes(router)
    return app


web.run_app(init_app())
```

### 返回 json 的 response

这里通过一个 post view 方法展示，post 的 body 可以通过 request.body 获取到，然后通过 json_response 返回一个 json 格式的 response

```python
from aiohttp import web

router = web.RouteTableDef()


@router.get('/')
async def handler(request: web.Request) -> web.Response:
    return web.Response(text="Hello world")


@router.post('/json')
async def json(request: web.Request) -> web.Response:
    args = await request.json()
    data = {'value': args['key']}
    return web.json_response(data)


async def init_app() -> web.Application:
    app = web.Application()
    app.add_routes(router)
    return app


web.run_app(init_app())
```

### 使用数据库

使用 cleanup_ctx 将 db 实例放入 config_dict 中，然后在 view 中就可以使用了

```python
import sqlite3
from pathlib import Path
from typing import AsyncIterator

import aiosqlite
from aiohttp import web


router = web.RouteTableDef()


@router.get('/')
async def handler(request: web.Request) -> web.Response:
    return web.Response(text="Hello world")


@router.post('/post')
async def new_post(request: web.Request) -> web.Response:
    post = await request.json()
    print('post', post)
    db = request.config_dict["DB"]
    async with db.execute(
        "INSERT INTO posts (title, text) VALUES(?, ?)", [post["title"], post["text"]],
    ) as cursor:
        post_id = cursor.lastrowid
    await db.commit()
    return web.json_response({"new_post": post_id})


async def init_app() -> web.Application:
    app = web.Application()
    app.add_routes(router)
    app.cleanup_ctx.append(init_db)
    return app


async def init_db(app: web.Application) -> AsyncIterator[None]:
    sqlite_db = get_db_path()
    db = await aiosqlite.connect(sqlite_db)
    app["DB"] = db
    yield
    await db.close()


def get_db_path() -> Path:
    here = Path.cwd()
    while not (here / ".git").exists():
        if here == here.parent:
            raise RuntimeError("Cannot find root github dir")
        here = here.parent

    return here / "db.sqlite3"


def try_make_db() -> None:
    sqlite_db = get_db_path()
    if sqlite_db.exists():
        return

    with sqlite3.connect(sqlite_db) as conn:
        cur = conn.cursor()
        cur.execute(
            """CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            title TEXT,
            text TEXT,
            owner TEXT,
            editor TEXT)
        """
        )
        conn.commit()


try_make_db()

web.run_app(init_app())
```

## template

模版渲染需要依赖 aiohttp-jinja2 和 jinja2

```python
import os
import time

import aiohttp_jinja2
import jinja2
from aiohttp import web


router = web.RouteTableDef()


@router.get("/{username}")
async def greet_user(request: web.Request) -> web.Response:

    context = {
        "username": request.match_info.get("username", ""),
        "current_date": time.ctime(),
    }
    response = aiohttp_jinja2.render_template("base.html", request, context=context)

    return response


async def init_app() -> web.Application:
    app = web.Application()
    app.add_routes(router)
    aiohttp_jinja2.setup(app, loader=jinja2.FileSystemLoader("."))
    return app


web.run_app(init_app())

```

```html
<html>
  <head>
    <title>aiohttp page</title>
  </head>
  <body>
    <div>
      <h1><a href="/">My aiohttp server</a></h1>
    </div>

    <div>
      <p>Date now: {{ current_date }}</p>
      <p>Hello {{ username}}.</p>
    </div>
  </body>
</html>
```

TODO

## middleware

中间件可以修改 request、response，做一些定制化的操作，如果验证用户是否登陆，记录访问次数，访问 ip、记录日志...

这里演示一个数据库事务操作，数据库操作错误的话，就会把错误用 response 返回

```python
import sqlite3
from pathlib import Path
from typing import AsyncIterator, Awaitable, Callable

import aiosqlite
from aiohttp import web


router = web.RouteTableDef()


@router.get('/')
async def handler(request: web.Request) -> web.Response:
    return web.Response(text="Hello world")


@router.post('/post')
async def new_post(request: web.Request) -> web.Response:
    post = await request.json()
    db = request.config_dict["DB"]
    async with db.execute(
        "INSERT INTO posts (title, text) VALUES(?, ?, ?, ?)",
        [post["title"], post["text"]],
    ) as cursor:
        post_id = cursor.lastrowid

    return web.json_response({"new_post": post_id})


async def init_app() -> web.Application:
    app = web.Application(middlewares=[middleware])
    app.add_routes(router)
    app.cleanup_ctx.append(init_db)
    return app


async def init_db(app: web.Application) -> AsyncIterator[None]:
    sqlite_db = get_db_path()
    db = await aiosqlite.connect(sqlite_db)
    app["DB"] = db
    yield
    await db.close()


def get_db_path() -> Path:
    here = Path.cwd()
    while not (here / ".git").exists():
        if here == here.parent:
            raise RuntimeError("Cannot find root github dir")
        here = here.parent

    return here / "db.sqlite3"


def try_make_db() -> None:
    sqlite_db = get_db_path()
    if sqlite_db.exists():
        return

    with sqlite3.connect(sqlite_db) as conn:
        cur = conn.cursor()
        cur.execute(
            """CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            title TEXT,
            text TEXT,
            owner TEXT,
            editor TEXT)
        """
        )
        conn.commit()


@web.middleware
async def middleware(
    request: web.Request, handler: Callable[[web.Request], Awaitable[web.Response]]
):
    db = request.config_dict["DB"]
    await db.execute("BEGIN")
    print('begin')
    try:
        resp = await handler(request)
        await db.execute("COMMIT")
        return resp
    except Exception as e:
        await db.execute("ROLLBACK")
        return web.json_response({"error": str(e)})


try_make_db()

web.run_app(init_app())

```

## seesion

Session 是用于保存临时数据(如登录用户信息)的存储
session 是类 dict 的对象

通常用 redis 做 backend，将数据保存到 redis 中，cookie 中只有一个 redis 的 key。

aiohttp 使用 session，需要安装`pip install aiohttp_session[aioredis]`

会在 redis 中创建以 AIOHTTP*SESSION*开头的 key。

```python
import time

import aiohttp_session
import aioredis
from aiohttp import web
from aiohttp_session import redis_storage


router = web.RouteTableDef()


@router.get("/")
async def handler(request: web.Request) -> web.Response:
    session = await aiohttp_session.get_session(request)
    last_visit = session["last_visit"] if "last_visit" in session else None
    session["last_visit"] = time.time()
    text = "Last visited: {}".format(last_visit)
    return web.Response(text=text)


async def init_app() -> web.Application:
    app = web.Application()
    pool = await aioredis.create_redis_pool(("127.0.0.1", 6379))
    session = redis_storage.RedisStorage(pool)
    aiohttp_session.setup(app, session)
    app.add_routes(router)
    return app


web.run_app(init_app())
```

# Reference

- [https://youtu.be/OxzVApXKWYM](https://youtu.be/OxzVApXKWYM)
- [https://us-pycon-2019-tutorial.readthedocs.io/](https://us-pycon-2019-tutorial.readthedocs.io/)
