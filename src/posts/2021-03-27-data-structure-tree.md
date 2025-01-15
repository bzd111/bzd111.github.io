---
layout: post
title: "数据结构之树"
date: "2021-03-27"
tags: ["data-structure"]
slug: "2021-03-27-data-structure-tree"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [Define Binary Tree Node](#define-binary-tree-node)
* [Create a Binary tree](#create-a-binary-tree)
    * [Pre-order 前序遍历](#pre-order-前序遍历)
    * [In-order 中序遍历](#in-order-中序遍历)
    * [Post-order 后续遍历](#post-order-后续遍历)
* [Binary search Tree](#binary-search-tree)
    * [Time Complexity](#time-complexity)
    * [How to create BST](#how-to-create-bst)
* [Balanced binary tree](#balanced-binary-tree)
* [Key to tree problems: recursion](#key-to-tree-problems-recursion)
    * [Traditional Way](#traditional-way)
    * [Recursive way](#recursive-way)
* [Templates](#templates)
    * [Single root](#single-root)
        * [Exercise](#exercise)
    * [Two roots](#two-roots)
        * [Exercise](#exercise)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

[笔记](https://www.youtube.com/watch?v=PbGl8_-bZxI&list=WL&index=38)，感觉 up 主分享。代码都是用 golang 实现。

# Define Binary Tree Node

```golang
type TreeNode struct {
 	Val   int
 	Left  *TreeNode
 	Right *TreeNode
}
```

# Create a Binary tree

```golang
func NewBinaryTree() *TreeNode {
	root := &TreeNode{Val: 1}
	root.Left = &TreeNode{Val: 2}
	root.Right = &TreeNode{Val: 3}
	root.Left.Left = &TreeNode{Val: 4}
	root.Left.Left.Right = &TreeNode{Val: 5}
	root.Right.Left = &TreeNode{Val: 6}
}
```

## Pre-order 前序遍历

```golang
func PreOrder(root *TreeNode, ans *[]int) {
	if root == nil {
		return
	}
	fmt.Println(root.Val)
	*ans = append(*ans, root.Val)
	PreOrder(root.Left, ans)
	PreOrder(root.Right, ans)
}
```

## In-order 中序遍历

```golang
func InOrder(root *TreeNode, ans *[]int) {
	if root == nil {
		return
	}
	InOrder(root.Left, ans)
	fmt.Println(root.Val)
	*ans = append(*ans, root.Val)
	InOrder(root.Right, ans)
}
```

## Post-order 后续遍历

```golang
func PostOrder(root *TreeNode, ans *[]int) {
	if root == nil {
		return
	}
	PostOrder(root.Left, ans)
	PostOrder(root.Right, ans)
	fmt.Println(root.Val)
	*ans = append(*ans, root.Val)
}

```

# Binary search Tree

- 根节点大于左子数，小于右子数
- 中序遍历得到有序的列表

## Time Complexity

| method | average | worst case |
| :----: | :-----: | :--------: |
| insert | O(logn) |    O(n)    |
| Search | O(logn) |    O(n)    |
| Delete | O(logn) |    O(n)    |

## How to create BST

```golang
func NewBST(nums []int) *TreeNode {
	var root *TreeNode
	for _, num := range nums {
		root = insert(root, num)
	}
	return root
}

func insert(root *TreeNode, val int) *TreeNode {
	if root == nil {
		return &TreeNode{Val: val}
	}
	if val < root.Val {
		root.Left = insert(root.Left, val)
	} else {
		root.Right = insert(root.Right, val)
	}
	return root
}
```

# Balanced binary tree

TODO

# Key to tree problems: recursion

培养递归思维，视频中有个例子，查找树节点中值最大的，

普通思路是先设定最小值，然后遍历整棵树，如果大于就修改最大值。

递归思路先获取左子树的最大值，然后获取右子树的最大值，然后和根节点取最大值。

## Traditional Way

```golang

func FindMaxValTree(root *TreeNode) int {
	_max := math.MinInt16
	traverse(root, &_max)
	return _max
}

func traverse(root *TreeNode, _max *int) {
	if root == nil {
		return
	}
	*_max = max(root.Val, *_max)
	traverse(root.Left, _max)
	traverse(root.Right, _max)
}
```

## Recursive way

```golang
func FindMaxValTree2(root *TreeNode) int {
	if root == nil {
		return math.MinInt16
	}
	maxLeft := FindMaxValTree2(root.Left)
	maxRight := FindMaxValTree2(root.Right)
	bigger := max(maxLeft, maxRight)
	return max(bigger, root.Val)
}

```

# Templates

- Single root/Two roots
- Time complexity: O(n) Space complexity: O(h)

## Single root

```golang
func solve(root){
  if not root: return ...
  if f(root): retunr ...
  l = solve(root.left)
  r = solve(root.right)
  return g(root, l, r)
}
```

### Exercise

- Leetcode 104 Maximum Depth of Binary Tree
- Leetcode 111 Minimun Depth of Binary Tree
- Leetcode 112 Path sum

## Two roots

```golang
func solve(p, q){
    if not p and not q{
        return ...
    }
    if f(p, q): return ...
    c1 = solve(p.left, q.right)
    c2 = solve(p.left, q.right)
    return g(p,q,c1,c2)
}
```

### Exercise

- Leetcode 100 Same Tree
- Leetcode 101 Symmetric Tree
- Leetcode 951 Equivalent Binary Trees

# Reference

- https://www.youtube.com/watch?v=PbGl8_-bZxI&list=WL&index=38
