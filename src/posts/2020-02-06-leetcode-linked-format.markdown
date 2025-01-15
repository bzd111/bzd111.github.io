---
layout: post
title: "leetcode listnode 格式化"
date: "2020-02-06"
tags: ["leetcode"]
slug: "2020-02-06-leetcode-linked-format"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [格式化](#格式化)
    * [Python](#python)
    * [Golang](#golang)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

之前在 leetcode 刷题，刷到几题关于列表的，由于结果不好展示，所以加了个格式化的方法

# 格式化

## Python

在 python 中，有很多魔法方法，其中**str**是和 print 有关的，
当一个类实现了**str**方法，调用 print 打印的时候会使用到。

```python
class ListNode:
    def __init__(self, x):
        self.val = x
        self.next = None

    def __str__(self):
        res = []
        while self:
            res.append(self.val)
            self = self.next
        s = map(str, res)
        return "->".join(s)

```

使用方法:

```python
# linked-list 2 -> 4 -> 3
l11 = ListNode(2)
l12 = ListNode(4)
l13 = ListNode(3)
l11.next = l12
l12.next = l13
print(l11)
# 2->4->3
```

最后，提一下**repr**，这个一般用来展示类的信息

## Golang

只要一个结构体实现了 String 方法，在 fmt.Println 调用时就可以看到效果

```golang
type ListNode struct {
	Val  int
	Next *ListNode
}

func (l *ListNode) String() string {
	res := []string{}
	for l != nil {
		res = append(res, strconv.Itoa(l.Val))
		l = l.Next
	}
	return strings.Join(res, "->")
    }

func main() {
	l11 := &ListNode{Val: 2}
	l12 := &ListNode{Val: 4}
	l13 := &ListNode{Val: 3}
	l11.Next = l12
	l12.Next = l13

	fmt.Println(l11)
}
// 2->4->3
```

结果也是 2->4->3

# Reference

- https://godoc.org/golang.org/x/tools/cmd/stringer
