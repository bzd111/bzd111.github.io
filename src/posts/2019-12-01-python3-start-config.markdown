---
layout: post
title: "python工程初始化、标准化"
date: "2019-12-01"
tags: ["python"]
slug: "2019-12-01-python3-start-config"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [工具和安装](#工具和安装)
    * [工具](#工具)
    * [安装](#安装)
        * [pre-commit](#pre-commit)
            * [安装钩子](#安装钩子)
    * [Demo](#demo)
* [git commit](#git-commit)
* [Refenrce](#refenrce)

<!-- vim-markdown-toc -->

# 前言

为了统一代码风格

# 工具和安装

## 工具

- [git](https://github.com/git/git): 代码管理
- [pipenv](https://github.com/pypa/pipenv): 虚拟环境
- [flake8](https://github.com/PyCQA/flake8): 代码风格检测
- [black](https://github.com/psf/black): 代码格式化
- [isort](https://github.com/timothycrosley/isort): 排序导入
- [pytest](https://docs.pytest.org/en/latest/): 单元测试
- [pre-commit](https://pre-commit.com/): git hooks
  对这些工具不了解，可以看下对应的链接

## 安装

用 mac 安装就比较简单，`brew install git`、`brew install pipenv`、`brew install pre-commit`

其他三个可以用 pipenv 安装
`pipenv install --dev flake8 isort black`

### pre-commit

这里稍微介绍下 pre-commit。
git 有一些[hooks](https://git-scm.com/book/zh/v2/%E8%87%AA%E5%AE%9A%E4%B9%89-Git-Git-%E9%92%A9%E5%AD%90)，应对于重要操作时触发自定义脚本。
hooks 总共有分为 3 类，提交工作流钩子、电子邮件工作流钩子和其它钩子。
具体可以看官方文档。
工作常用到的有 pre-commit、pre-push、pre-pull。

#### 安装钩子

```
pre-commit install -t pre-commit
pre-commit install -t pre-push
pre-commit install -t pre-pull
```

其实初始化一个 git 仓库的时候，就已经预置了这些 hooks，这里的安装只是把它 sample 后缀启用了而已，

这是启用了 pre-commit 钩子的变化，可以看到重新生成了一个没有后缀的 pre-commit

```
❯ ll .git/hooks
.rwxr-xr-x  478 zhangcheng 29 11 19:37 applypatch-msg.sample
.rwxr-xr-x  896 zhangcheng 29 11 19:37 commit-msg.sample
.rwxr-xr-x 3.3k zhangcheng 29 11 19:37 fsmonitor-watchman.sample
.rwxr-xr-x  189 zhangcheng 29 11 19:37 post-update.sample
.rwxr-xr-x  424 zhangcheng 29 11 19:37 pre-applypatch.sample
.rwxr-xr-x 6.0k zhangcheng 29 11 20:20 pre-commit
.rwxr-xr-x 1.6k zhangcheng 29 11 19:37 pre-commit.sample
.rwxr-xr-x 1.3k zhangcheng 29 11 19:37 pre-push.sample
.rwxr-xr-x 4.9k zhangcheng 29 11 19:37 pre-rebase.sample
.rwxr-xr-x  544 zhangcheng 29 11 19:37 pre-receive.sample
.rwxr-xr-x 1.5k zhangcheng 29 11 19:37 prepare-commit-msg.sample
.rwxr-xr-x 3.6k zhangcheng 29 11 19:37 update.sample
```

## Demo

1、创建一个仓库，也可从远程 clone 一个，这里为了演示简单，就直接初始化一个
`git init`

2、demo 代码

main.py

```python
from collections import OrderedDict


class LRUCache:
    def __init__(self, capacity: int = 128) -> None:
        self.od: OrderedDict[str, int] = OrderedDict()
        self.capacity = capacity

    def get(self, key: str) -> int:
        if key in self.od:
            val = self.od[key]
            self.od.move_to_end(key)
            return val
        else:
            return -1

    def put(self, key: str, value: int) -> None:
        if key in self.od:
            del self.od[key]
            self.od[key] = value
        else:
            self.od[key] = value
            if len(self.od) > self.capacity:
                self.od.popitem(last=False)  # last=False FIFO
```

这是一个 LRU 算法的示例代码

3、测试代码
test_lru.py

```python
import unittest

from main import LRUCache


class TestLRU(unittest.TestCase):
    def test_lru(self) -> None:
        lru = LRUCache(3)
        lru.put('a', 1)
        lru.put('b', 2)
        lru.put('c', 3)
        lru.put('d', 4)
        assert list(lru.od.keys()) == ['b', 'c', 'd']
```

4、pre-commit 配置文件
.pre-commit-config.yaml

```yaml
repos:
  - repo: local
    hooks:
      - id: isort
        name: isort
        stages: [commit]
        language: system
        entry: pipenv run isort
        types: [python]

      - id: black
        name: black
        stages: [commit]
        language: system
        entry: pipenv run black -S
        types: [python]

      - id: flake8
        name: flake8
        stages: [commit]
        language: system
        entry: pipenv run flake8
        types: [python]
        exclude: setup.py

      - id: mypy
        name: mypy
        stages: [commit]
        language: system
        entry: pipenv run mypy
        types: [python]
        pass_filenames: false

      - id: pytest
        name: pytest
        stages: [commit]
        language: system
        entry: python -m pytest -v tests
        types: [python]

      - id: pytest-cov
        name: pytest
        stages: [push]
        language: system
        entry: python -m pytest --cov=.
        types: [python]
        pass_filenames: false
```

5、setup.cfg
格式工具的配置

```ini
[isort]
multi_line_output=3
include_trailing_comma=True
force_grid_wrap=0
use_parentheses=True
line_length=88


[black]
# skip-string-normalization=True
S=True
line-length = 88
skip-string-normalization=True
include = \.pyi?$
exclude = \.git
          | \.hg
          | \.mypy_cache
          | \.tox
          | \.venv
          | _build
          | buck-out
          | build
          | dist


[flake8]
exclude = .git,.env,__pycache__,.eggs
max-line-length = 88
max-complexity = 18
select = B,C,E,F,W,T4
ignore = N801,N802,N803,E252,W503,E133,E203,E203,E266,E501


[mypy]
files=*.py, tests
ignore_missing_imports=true
check_untyped_defs = True
disallow_any_generics = True
disallow_untyped_defs = True
follow_imports = silent
strict_optional = True
warn_redundant_casts = True
warn_unused_ignores = True

[tool:pytest]
testpaths=tests
```

# git commit

提交时会触发 pre-commit 的钩子，会依次运行 isort、black、flake8、mypy、pytest 命令

会有展示如下信息

```
❯ git commit
isort....................................................................Passed
black....................................................................Passed
flake8...................................................................Passed
mypy.....................................................................Passed
pytest...................................................................Passed
```

# Refenrce

- https://github.com/asvetlov/us-pycon-2019-tutoria://github.com/asvetlov/us-pycon-2019-tutorial
- https://sourcery.ai/blog/python-best-practices/
