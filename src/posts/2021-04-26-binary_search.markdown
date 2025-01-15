---
layout: post
title: "二分查找"
date: "2021-04-26"
tags: ["algorithm"]
slug: "2021-04-26-binary_search"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [Tempalte](#tempalte)
    * [lower_bound](#lower_bound)
    * [upper_bound](#upper_bound)
* [Example](#example)
    * [No.1 Leetcode 69 |sqrt(x)|](#no-1-leetcode-69-sqrt-x)
    * [No.2 Leetcode 278. First Bad Version](#no-2-leetcode-278-first-bad-version)
    * [No.3 Leetcode 875. Koko Eating Bananas](#no-3-leetcode-875-koko-eating-bananas)
    * [No.4 Leetcode 378 Kth Smallest Element in a Sorted Matrix](#no-4-leetcode-378-kth-smallest-element-in-a-sorted-matrix)
* [Reference](#reference)

<!-- vim-markdown-toc -->

#前言

二分查找

# Tempalte

[l, r) 左闭右开

f(m)：可选的，用来判断结果

g(m)：用来缩小区间

```golang
func binary_search(l, r int) int{
    for l < r:
        m := l + (r - l) // 2
        if f(m): return m  // optional
        if g(m):
            r = m // new range [l, m)
        else:
            l = m + 1 // new range [m+1, r)
    return l // or not found
}
```

Time complexity:
$$ O(log(r-l)*(f(m) + g(m))) $$

Space complexity:
$$ O(1) $$

## lower_bound

返回第一个大于或等于 t 的索引值

```golang
// lowerBound first index of i, such that s[i] >= t
func lowerBound(s []int, t int) int {
	l := 0
	r := len(s)
	for l < r {
		m := l + (r-l)/2
		if s[m] >= t {
			r = m
		} else {
			l = m + 1
		}
	}
	return l
}
```

## upper_bound

返回第一个大于 t 的索引值

```golang
// upperBound first index of i, such that s[i] > t
func upperBound(s []int, t int) int {
	l := 0
	r := len(s)
	for l < r {
		m := l + (r-l)/2
		if s[m] > t {
			r = m
		} else {
			l = m + 1
		}
	}
	return l
}
```

# Example

## No.1 Leetcode 69 |sqrt(x)|

```golang
func mySqrt(x int) int {
	l := 1
	r := x + 1
	for l < r {
		m := l + (r-l)/2
		if m*m > x {
			r = m
		} else {
			l = m + 1
		}
	}
	return l - 1
}
```

## No.2 Leetcode 278. First Bad Version

```golang
func firstBadVersion(n int) int {
	l := 0
	r := n
	for l < r {
		m := l + (r-l)/2
		if isBadVersion(m) {
			r = m
		} else {
			l = m + 1
		}
	}
	return l
}
```

## No.3 Leetcode 875. Koko Eating Bananas

```golang
func maxInArr(nums []int) int {
	max := nums[0]
	for i := 1; i < len(nums); i++ {
		if max < nums[i] {
			max = nums[i]
		}
	}
	return max
}

func minEatingSpeed(piles []int, h int) int {
	l := 1
	r := maxInArr(piles) + 1

	for l < r {
		m := l + (r-l)/2
		_h := 0
		for _, p := range piles {
			_h += (p + m - 1) / m
		}
		if _h <= h {
			r = m
		} else {
			l = m + 1
		}
	}
	return l
}
```

## No.4 Leetcode 378 Kth Smallest Element in a Sorted Matrix

```golang
func kthSmallest(matrix [][]int, k int) int {
	l := matrix[0][0]
	x, y := len(matrix), len(matrix[0])
	r := matrix[x][y]
	for l < r {
		m := l + (r-l)/2
		total := 0
		for _, row := range matrix {
			total += upperBound(row, m)
		}
		if total >= k {
			r = m
		} else {
			l = m + 1
		}
	}
	return l
}

func upperBound(s []int, t int) int {
	l := 0
	r := len(s)
	for l < r {
		m := l + (r-l)/2
		if s[m] > t {
			r = m
		} else {
			l = m + 1
		}
	}
	return l
}
```

# Reference

- https://www.youtube.com/watch?v=v57lNF2mb_s&list=PLLuMmzMTgVK5Hy1qcWYZcd7wVQQ1v0AjX&index=17
