<!-- vim-markdown-toc GFM -->

* [asyncio](#asyncio)
* [aiohttp](#aiohttp)
    * [server](#server)
    * [client](#client)
    * [template](#template)
    * [middleware](#middleware)
    * [seesion](#seesion)

<!-- vim-markdown-toc -->

这篇文章简单介绍下 aiohttp,这个是看了 pycon2019[视频](https://www.youtube.com/watch?v=OxzVApXKWYM&list=PLPbTDk1hBo3xof51R8pk3kP1BVBuMYP9c&index=9&t=2193s)的观后感
视频不错,作者本身是 python 核心开发者。
视频时间 2 个小时，比较长，没有时间的话，可以看作者提供的[文档](https://us-pycon-2019-tutorial.readthedocs.io/)

# asyncio

python3.7 提供了`asyncio.run方法`，运行协程更方便，可以看一下下面的 🌰

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

# aiohttp

## server

## client

## template

## middleware

## seesion
