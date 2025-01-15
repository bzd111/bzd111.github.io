---
layout: post
title: "python3 typing使用"
date: "2019-10-17"
tags: ["python"]
slug: "2019-10-17-python3-typing"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [Typing](#typing)
    * [直接变量可对应](#直接变量可对应)
    * [其他对象](#其他对象)
    * [举个 🌰](#举个-🌰)
        * [简单例子](#简单例子)
            * [TypeVar bound](#typevar-bound)
        * [Callable](#callable)
        * [Generator](#generator)
    * [ClassVar](#classvar)
    * [Generics](#generics)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

[PEP484](https://www.python.org/dev/peps/pep-0484/)，引入了类型注解，[PEP526](https://www.python.org/dev/peps/pep-0526/)，引入了变量的语法注释

# Typing

## 直接变量可对应

这些对象可以直接对应使用
| Typing 中的对象 | Python 内建的对象 |
| :-------------: | :-------------------------------------------------------------------: |
| Dict | dict |
| List | list |
| Tuple | tuple |
| Set | set |
| Deque | collections.deque |
| NamedTuple | collections.NamedTuple |
| IO | io.StringIO、io.BytesIO、open(\_\_file\_\_)、open(\_\_file\_\_, 'rb') |
| Pattern | re.Pattern |
| Match | re.Match |

## 其他对象

| Typing 中的对象 |  解释说明   |
| :-------------: | :---------: |
|    Optional     | 可以是 None |
|    Sequence     |    序列     |
|    Iterable     |   可迭代    |
|     Mapping     | 似字典类型  |
|       Any       |  任意对象   |
|    ClassVar     |   类变量    |
|    Callable     |   可回调    |

## 举个 🌰

我们一般调用或者申明时都是用()的，在使用 typing 模块时，都是使用[]的

### 简单例子

```python
def add(x: int, y: int) -> int:
    return x + y


add(1, 2)
add('x', 'y')
# mypy: Argument 1 to "add" has incompatible type "str"; expected "int" (E)
```

这时候如果想要使`add('x', 'y')`也通过检查，可以这么修改

使用`TypeVar`，定义泛型，指定 str、int

如果不指定类型会提示`mypy: Unsupported left operand type for + ("T")`的错误

```python
from typing import TypeVar # 新加的行

T = TypeVar('T', str, int) # 定义T类型，支持str、int


def add(x: T, y: T) -> T: # 修改的行
    return x + y


add(1, 2)
add('x', 'y')
```

#### TypeVar bound

TypeVar 有一些参数，比如 bound，用来定义 TypeVar 的上限，意味着 TypeVar 绑定的变量一定是 bound<Type>的类或者子类

```python
from typing import TypeVar


class Shape:
    def __init__(self, width: float, height: float) -> None:
        self.width = width
        self.height = height

    def area(self) -> float:
        return 0


class Rectangle(Shape):
    def area(self) -> float:
        width: float = self.width
        height: float = self.height
        return width * height


class Triangle(Shape):
    def area(self) -> float:
        width: float = self.width
        height: float = self.height
        return width * height / 2


S = TypeVar("S", bound=Shape)


def area(s: S) -> float:
    return s.area()


r: Rectangle = Rectangle(1, 2)
t: Triangle = Triangle(3, 4)
i: int = 5566

print(area(r))
print(area(t))
# print(area(i))
# Value of type variable "S" of "area" cannot be "int" (E)
```

### Callable

```python
def gcd(a: int, b: int) -> int:
    # 最大公约数
    while b:
        a, b = b, a % b
    return a


# Callable[[arg, ...], result]
def fun(cb: Callable[[int, int], int]) -> int:
    return cb(55, 66)
```

### Generator

传入的参数有 3 个，YieldType、 SendType、 ReturnType
正好对应 yield value、value = yield、return value

这里就不举例 YieldType 的例子了，因为也比较常见
这里说一下，SendType 和 ReturnType 结合的例子

```python
from typing import Generator, Optional, Union


def average() -> Generator[None, Optional[int], float]:
    total = 0
    count = 0
    avg = 0.0
    while True:
        val = yield
        if not val:
            break
        total += val
        count += 1
        avg = total / count
    return avg


if __name__ == '__main__':
    result = 0
    g = average()
    g.send(None)  # or next(g)
    g.send(3)
    g.send(5)

    try:
        g.send(None)
    except StopIteration as e:
        result = e.value
    print('result: ', result)
```

看完代码，可以看到这里用到了`Generator Optional` 接下来一一说明下，

- Generator 说明 average 类型是生成器，

- SendType 是 Option[int]，因为启动生成器的时候要发送一个 None，跳出 average 中的 While True，也需要 send 一个 None，所以用了 Optional[int]，当然可以用 Union[None, int]

**注意: Optional[int] == Union[None, int]**

## ClassVar

```python
from typing import ClassVar, Dict


class Starship:
    stats: ClassVar[Dict[str, int]] = {}
    damage: int = 10


enterprise_d = Starship()
enterprise_d.stats = {}
# Cannot assign to class variable "stats" via instance
Starship.stats = {}
```

`Classvar`表示是类变量，所以当实例对类变量进行赋值的时候，就会出现上面那个警告

## Generics

`Generics`一般都是和`TypeVar`联合使用的。

```python
from typing import Generic, List, TypeVar

T = TypeVar('T')


class Stack(Generic[T]):
    def __init__(self) -> None:
        # Create an empty list with items of type T
        self.items: List[T] = []

    def push(self, item: T) -> None:
        self.items.append(item)

    def pop(self) -> T:
        return self.items.pop()

    def empty(self) -> bool:
        return not self.items

s1: Stack[int] = Stack()
s1.push(1)
s1.push('1')
# Argument 1 to "push" of "Stack" has incompatible type "str"; expected "int"
```

这里定义了一个 Stack 类，只能存同一类型的值，这个类型由定义实例时，指定的类型。

# Reference

- https://docs.python.org/3/library/typing.html
- https://www.pythonsheets.com/notes/python-typing.html
- https://mypy.readthedocs.io/en/latest/
