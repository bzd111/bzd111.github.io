---
layout: post
title: "数据结构之堆"
date: "2021-03-29"
slug: "/2021-03-29-data-struct-of-heap"
tags: ["shell", "cli"]
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [实现](#实现)
    * [最小堆](#最小堆)
        * [method](#method)
    * [应用](#应用)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

结构是树(完全树)，存储结构是列表

# 实现

## 最小堆

parent => children n=>2n+1,2n+2

child => parent n => (n-1)/2

### method

```
▼+MinHeap : struct
    [fields]
   -data : []int
    [methods]
   -heapifyDown(index int)
   -heapifyUp(index int)
   -pop() : int
   -push(item int)
    [functions]
   +NewMinHeap() : *MinHeap
   +NewMinHeapFromSlice(data []int) : *MinHeap
```

结构体定义和初始化

```golang
type MinHeap struct {
	data []int
}

func NewMinHeap() *MinHeap {
	return &MinHeap{}
}
```

push
把值放到最后，然后往上冒

```golang
func (h *MinHeap) push(item int) {
	h.data = append(h.data, item)
	h.heapifyUp(len(h.data) - 1)
}
```

heapifyUp

```golang
func (h *MinHeap) heapifyUp(index int) {
	if index == 0 {
		return
	}
	parent := (index - 1) / 2
	if h.data[index] >= h.data[parent] {
		return
	}
	swap(&h.data[index], &h.data[parent])
	h.heapifyUp(parent)
}
```

pop
把最小值和最后一个值交换位子，然后往下沉

```golang
func (h *MinHeap) pop() int {
	h.data[0], h.data[len(h.data)-1] = h.data[len(h.data)-1], h.data[0]
	last := h.data[len(h.data)-1]
	h.data = h.data[:len(h.data)-1]
	h.heapifyDown(0)
	return last
}
```

heapifyDown

```golang
func (h *MinHeap) heapifyDown(index int) {
	smallest := index
	for i := 2*index + 1; i <= 2*index+2; i++ {
		if i < len(h.data) && h.data[i] < h.data[smallest] {
			smallest = i
		}
	}
	if smallest == index {
		return
	}
	swap(&h.data[index], &h.data[smallest])
	h.heapifyDown(smallest)

}

```

NewMinHeapFromSlice(data []int) // create a heap from a slice.

对数组前一半的元素进行 heapifyDown，即可得到。

```golang
func NewMinHeapFromSlice(data []int) *MinHeap {
	h := NewMinHeap()
	n := len(data) - 1
	h.data = data
	for i := (n - 1) / 2; i >= 0; i-- {
		h.heapifyDown(i)
	}
	return h
}
```

## 应用

Heapsort O(nlogn)

Dijkstra's algorithm

Priority Queue

Selection algorithm

- select top k elements among n
- sorting O(nlogn)
- Binary heap: O(n+klogn)

# Reference

- https://www.youtube.com/watch?v=mnSMdTPBG1U
