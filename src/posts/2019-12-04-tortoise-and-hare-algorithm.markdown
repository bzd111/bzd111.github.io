---
layout: post
title: "龟兔赛跑算法"
date: "2019-12-04"
tags: ["algorithm"]
slug: "2019-12-04-tortoise-and-hare-algorithm"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [介绍](#介绍)
    * [证明](#证明)
        * [是否存在环](#是否存在环)
        * [计算环的长度](#计算环的长度)
        * [计算环的起点](#计算环的起点)
* [题](#题)
    * [141. Linked List Cycle](#141-linked-list-cycle)
    * [142. Linked List Cycle II](#142-linked-list-cycle-ii)
    * [202. happy-number](#202-happy-number)
    * [287. Find the Duplicate Number](#287-find-the-duplicate-number)
* [总结](#总结)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

之前在一个[blog](http://adam8157.info/blog/2015/08/why-does-tortoise-and-hare-algorithm-work/)，看到这个算法， 这里稍作整理。
并且刷几道相关的题，巩固一下。

# 介绍

Floyd 判圈算法(Floyd Cycle Detection Algorithm)，又称龟兔赛跑算法(Tortoise and Hare Algorithm)，是一个可以在有限状态机、迭代函数或者链表上判断是否存在环，求出该环的起点与长度的算法。(摘自维基百科)

## 证明

![cycle](/assets/cycle.jpg)
起点 S，环长 L，相遇点 M。

乌龟和兔子从起点出发，兔子每次走 2 步，乌龟每次走一步

### 是否存在环

兔子走 2 步，会走在前面，当单列表有环时，兔子会超乌龟 N 圈，追上乌龟，然后相遇。

如果单列表没有环时，它们永远不会相遇。

### 计算环的长度

当乌龟和兔子相遇后，让兔子原地等待，乌龟再走一圈，走的步数就是环的长度

### 计算环的起点

当乌龟和兔子相遇时，走了 T 步，兔子走了 X 圈，乌龟走了 Y 圈

乌龟走过的长度

1⃣️ T = S + YL + M

兔子走过的长度

2⃣️ 2T = S + XL + M

两式相减得，T = (X - Y)L

将 T 带入到 1⃣️ 中得，S + M = (X - 2Y)L

S+M 的和，能被 L 和(X-2Y)整除，所以当 X-2Y 等于 1 时，S+M=L，S = L - M，当新的乌龟从起点出发，第一只乌龟从 M(相遇点)出发，两只乌龟会在环的起点相遇，

当 S 等 0 时，单列表自身就是环，M 就是起点

# 题

题目均来自[Leetcode](https://leetcode.com/)

## [141. Linked List Cycle](https://leetcode.com/problems/linked-list-cycle/)

判断单链表是否有环

```python
# Definition for singly-linked list.
class ListNode:
    def __init__(self, x):
        self.val = x
        self.next = None


class Solution:
    def hasCycle(self, head: ListNode) -> bool:
        rabbit = head
        turtle = head
        while rabbit is not None and rabbit.next is not None:
            rabbit = rabbit.next.next
            turtle = turtle.next
            if rabbit == turtle:
                return True
        return False
```

## [142. Linked List Cycle II](https://leetcode.com/problems/linked-list-cycle-ii/)

求环的起点

```python
class Solution:
    def detectCycle(self, head: ListNode) -> ListNode:
        rabbit = head
        turtle = head
        while rabbit is not None and rabbit.next is not None:
            rabbit = rabbit.next.next
            turtle = turtle.next
            if rabbit == turtle:
                repeat = head
                while turtle != repeat:
                    turtle = turtle.next
                    repeat = repeat.next
                return repeat
        return None
```

## [202. happy-number](https://leetcode.com/problems/happy-number/)

计算一步 n 的每位数的平方和两部 n 的每位数的平方和是否一样

```python
class Solution:
    def isHappy(self, n: int) -> bool:
        slow = fast = n
        slow = calc(slow)
        fast = calc(fast)
        fast = calc(fast)
        while slow != fast:
            slow = calc(slow)
            fast = calc(fast)
            fast = calc(fast)
        if slow == 1:
            return True
        return False


def calc(n):
    sum = 0
    while n > 0:
        l = n % 10
        sum += l * l
        n //= 10
    return sum
```

## [287. Find the Duplicate Number](https://leetcode.com/problems/find-the-duplicate-number/)

通过找环起点的方式解决

```python
from typing import List


class Solution:
    def findDuplicate(self, nums: List[int]) -> int:
        fast = slow = 0
        slow = nums[slow]
        fast = nums[fast]
        fast = nums[fast]
        while slow != fast:
            slow = nums[slow]
            fast = nums[fast]
            fast = nums[fast]
        slow = 0
        while slow != fast:
            slow = nums[slow]
            fast = nums[fast]
        return slow
```

# 总结

算法的世界还是很有趣的

# Reference

- https://zh.wikipedia.org/wiki/Floyd%E5%88%A4%E5%9C%88%E7%AE%97%E6%B3%95
