---
layout: post
title: learn-go-with-test笔记
date: "2020-04-23"
tags: ["golang"]    
slug: "2020-04-23-learn-go-with-test-record"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [安装 GO](#安装-go)
* [Hello, World](#hello-world)
* [Iteration](#iteration)
* [Arrays and slices](#arrays-and-slices)
    * [简单使用](#简单使用)
    * [切片内部定义](#切片内部定义)
* [Structs, methods & interfaces](#structs-methods-amp-interfaces)
* [Pointers & errors](#pointers-amp-errors)
    * [自定义 error](#自定义-error)
    * [自定义类型](#自定义类型)
    * [类型别名](#类型别名)
* [Maps](#maps)
    * [数组定义](#数组定义)
    * [类型别名](#类型别名)
* [Dependency Injection](#dependency-injection)
* [Mocking](#mocking)
* [Concurrency](#concurrency)
    * [race detector](#race-detector)
* [Select](#select)
    * [httptest 使用](#httptest-使用)
    * [select 使用](#select-使用)
* [Reflection](#reflection)
* [Sync](#sync)
* [Context](#context)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

之前看完了[learn-go-with-tests](https://github.com/quii/learn-go-with-tests)，现在稍微做点笔记记录一下

# 安装 GO

- mac 电脑使用`brew install go`

- 环境变量 GOPATH

- GO module 使用

  ```
  mkdir my-project
  cd my-project
  go mod init <modulepath>
  ```

- Go Edit 推荐 vscode(笔者喜欢用 vim)

- Go Debugger 推荐 dlv

  安装方法: `go get -u github.com/go-delve/delve/cmd/dlv`

  [使用 vscode debug](https://github.com/Microsoft/vscode-go/wiki/Debugging-Go-code-using-VS-Code)

- Go Linting 推荐 golangci-lint

  安装方法: `go get -u github.com/golangci/golangci-lint/cmd/golangci-lint`

# Hello, World

- go 代码组成

  必须要有名为 main 的包

  必须要有名为 main 的 function

  ```golang
  //必须要有名为main的包
  package main

  // 导入的包
  import "fmt"

  // 必须要有名为main的function
  func main() {
      fmt.Println("Hello, world")
  }
  ```

- go 测试代码组成

  文件名一般为 xxx_test.go

  测试函数必须以 Test 开头

  测试代码一般会放在一个 test 的文件下或和紧跟每一个功能文件，和它出现在一起

  测试函数参数只能是`t *testing.T`

  ```golang
  package main

  import "testing"

  func TestHello(t *testing.T) {
      got := Hello()
      want := "Hello, world"

      if got != want {
          t.Errorf("got %q want %q", got, want)
      }
  }

  ```

- 子测试用例

  ```golang
  func TestHello(t *testing.T) {

      assertCorrectMessage := func(t *testing.T, got, want string) {
          t.Helper()
          if got != want {
              t.Errorf("got %q want %q", got, want)
          }
      }

      t.Run("saying hello to people", func(t *testing.T) {
          got := Hello("Chris")
          want := "Hello, Chris"
          assertCorrectMessage(t, got, want)
      })

      t.Run("empty string defaults to 'World'", func(t *testing.T) {
          got := Hello("")
          want := "Hello, World"
          assertCorrectMessage(t, got, want)
      })

      }
  ```

- 运行测试用例
  `go test`

- 性能测试

  `go test -bench=.`

  ```golang
  const repeatCount = 5

  func Repeat(character string) string {
      var repeated string
      for i := 0; i < repeatCount; i++ {
          repeated += character
      }
      return repeated
  }

  func BenchmarkRepeat(b *testing.B) {
      for i := 0; i < b.N; i++ {
          Repeat("a")
      }
  }
  ```

  指定测试的 N 的大小，cpu 核数

  `go test -benchmem -test.count=3 -test.cpu=1 -test.benchtime=1s .`

- if 语法

  if 除了简单进行布尔运算时，还能在 if 语句中求职，然后再拿运算的值去做布尔运算

  ```golang
    func Hello(name string, language string) string {
        if name == "" {
            name = "World"
        }

        if language == spanish {
            return spanishHelloPrefix + name
        }

        if language == french {
            return frenchHelloPrefix + name
        }

        return englishHelloPrefix + name
    }
  ```

  ```golang
  package main

  import "testing"

  func TestSum(t \*testing.T) {

      numbers := [5]int{1, 2, 3, 4, 5}

      want := 15

      if got:=Sum(numbers); got != want {
          t.Errorf("got %d want %d given, %v", got, want, numbers)
      }

  }

  ```

- const

  `const spanish = "Spanish"`

- switch 语法

  ```golang
  func greetingPrefix(language string) (prefix string) {
    switch language {
    case french:
        prefix = frenchHelloPrefix
    case spanish:
        prefix = spanishHelloPrefix
    default:
        prefix = englishHelloPrefix
    }
    return
    }
  ```

# Iteration

go 只有 for，没有其他语言的 while、do、until。

```golang
const repeatCount = 5

func Repeat(character string) string {
    var repeated string
    for i := 0; i < repeatCount; i++ {
        repeated += character
    }
    return repeated
}
```

类似 while 使用

```golang
package main

import "fmt"

func main() {
    sum := 1
    for sum < 1000 {
        sum += sum
    }
    fmt.Println(sum)
}
```

# Arrays and slices

## 简单使用

array 数组 slices 切片

数组定义：numbers := [5]int{1, 2, 3, 4, 5}

切片定义：numbers := [5]int{1, 2, 3, 4, 5} or make([]int, 0, 5)

make 第二参数是 len(长度)，第三个参数是 cap(容量)

数组是定长的，切片可以在运行是改变长度，如果长度超过容量，会创建新的切片

切片需要使用`reflect.DeepEqual`进行判等

```golang
 func TestSumAll(t *testing.T) {

    got := SumAll([]int{1,2}, []int{0,9})
    want := []int{3, 9}

    if !reflect.DeepEqual(got, want) {
        t.Errorf("got %v want %v", got, want)
    }
}
```

## 切片内部定义

```golang
type SliceHeader struct {
	Data uintptr // 连续的内存的空间，
	Len  int // 长度
	Cap  int // 容量
}
```

# Structs, methods & interfaces

Go 语言中接口的实现都是隐式的

```golang
// 结构体
type Rectangle struct {
Width float64
Height float64
}

// methods
// 值接收者
func (r Rectangle) Area() float64 {
return 0
}

// 指针接收者
func (r \*Rectangle) SetWidth(width float64) {
r.Width = width
}

// interface
type Shape interface {
Area() float64

```

结构体初始化的变量不能调用指针接受者实现的 method

|                        | 结构体实现的接口 | 结构体指针实现的接口 |
| :--------------------: | :--------------: | :------------------: |
|   结构体初始化的变量   |       可以       |        不可以        |
| 结构体指针初始化的变量 |       可以       |         可以         |

接口可用在变量申明、函数入参、函数返回值，解释器会在编译期进行类型检查

可以看下这个例子https://draveness.me/golang/docs/part2-foundation/ch04-basic/golang-interface/#%E9%9A%90%E5%BC%8F%E6%8E%A5%E5%8F%A3

# Pointers & errors

go 里面，函数和方法都是值拷贝。所以需要修改结构体的值时，需要使用指针。
`In Go, when you call a function or a method the arguments are copied.`

指针可以是 nil

## 自定义 error

```golang
// 返回一个error的接口值
var ErrInsufficientFunds = errors.New("cannot withdraw, insufficient funds")
```

github.com/kisielk/errcheck 检查 Unchecked errors

## 自定义类型

好处：
1、可以实现接口
2、给类型添加更多有意义的值

```golang
type Bitcoin int

// 打印时添加BTC，
func (b Bitcoin) String() string {
    return fmt.Sprintf("%d BTC", b)
}
```

## 类型别名

两个类型是等价的

```golang
type T1 = int
```

# Maps

## 数组定义

```
var dictionary = map[string]string{}
var dictionary = make(map[string]string)
// make 的作用是初始化内置的数据结构，也就是我们在前面提到的切片、哈希表和 Channel
// new 的作用是根据传入的类型在堆上分配一片内存空间并返回指向这片内存空间的指针
```

## 类型别名

类型别名，`type Dictionary map[string]string`，定义 Dictionary，然后写一些 method

```
var ErrNotFound = errors.New("could not find the word you were looking for")
var ErrWordExists = errors.New("cannot add word because it already exists")
var ErrWordDoesNotExist = DictionaryErr("cannot update word because it does not exist")


func (d Dictionary) Search(word string) (string, error) {
    definition, ok := d[word]
    if !ok {
        return "", ErrNotFound
    }

    return definition, nil
}

func (d Dictionary) Add(word, definition string) error {
    _, err := d.Search(word)

    switch err {
    case ErrNotFound:
        d[word] = definition
    case nil:
        return ErrWordExists
    default:
        return err
    }

    return nil
}

func (d Dictionary) Update(word, definition string) error {
    _, err := d.Search(word)

    switch err {
    case ErrNotFound:
        return ErrWordDoesNotExist
    case nil:
        d[word] = definition
    default:
        return err
    }

    return nil
}

func (d Dictionary) Delete(word string) {
    // 删除不存在的key，不会有错误
    delete(d, word)
}

```

# Dependency Injection

[依赖注入](https://en.wikipedia.org/wiki/Dependency_injection)，依赖是调用对象 A 需要 B(参数、函数)，注入是把对象 A 需要的单独分开 B 传给它，

业务代码

```
package main

import (
	"fmt"
	"io"
	"net/http"
)

// Greet sends a personalised greeting to writer
func Greet(writer io.Writer, name string) {
	fmt.Fprintf(writer, "Hello, %s", name)
}

// MyGreeterHandler says Hello, world over HTTP
func MyGreeterHandler(w http.ResponseWriter, r *http.Request) {
	Greet(w, "world")
}

func main() {
	err := http.ListenAndServe(":5000", http.HandlerFunc(MyGreeterHandler))

	if err != nil {
		fmt.Println(err)
	}
}
```

测试代码

```
package main

import (
	"bytes"
	"testing"
)

func TestGreet(t *testing.T) {
	buffer := bytes.Buffer{}
	Greet(&buffer, "Chris")

	got := buffer.String()
	want := "Hello, Chris"

	if got != want {
		t.Errorf("got %q want %q", got, want)
	}
}
```

fmt.Fprintf 接受 io.Writer 接口，然后测试代码中的 bytes.Buffer 也实现了同样的接口，所以测试代码不需要使用 httptest 来测试
greeting 函数依赖 io.Writer，然后我们通过把 bytes.Buffer 注入。

# Mocking

Mock 和 Dependency Injection 有点像，这里就不赘述了

# Concurrency

这里使用 chan 来实现并发

这个函数是用来请求 url，然后判断响应的状态

```
package concurrency

import "net/http"

// CheckWebsite returns true if the URL returns a 200 status code, false otherwise
func CheckWebsite(url string) bool {
	response, err := http.Head(url)
	if err != nil {
		return false
	}

	if response.StatusCode != http.StatusOK {
		return false
	}

	return true
}
```

这个文件是用来遍历，调用 CheckkWebsite 函数的，然后把结果送到 chan 里

```
package concurrency

type WebsiteChecker func(string) bool
type result struct {
    string
    bool
}



func CheckWebsites(wc WebsiteChecker, urls []string) map[string]bool {
    results := make(map[string]bool)
    resultChannel := make(chan result)

    for _, url := range urls {
        go func(u string) {
            resultChannel <- result{u, wc(u)}
        }(url)
    }

    for i := 0; i < len(urls); i++ {
        result := <-resultChannel
        results[result.string] = result.bool
    }

    return results
}
```

chan 通道，如果读数据时，chan 的 recvq，是空的话，那么读会阻塞。如果写数据时，chan 的 sendq，是满的话，那么也写会阻塞

## race detector

跑 benchmark 的时候，多个协程读写 map，会产生`fatal error: concurrent map writes`错误，所以跑 benchmark 的时候，需要使用`go test -race`

# Select

## httptest 使用

httptest 使用

```golang
// 定义一个server，然后放入一个handlerFunc，
slowserver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(delay)
		w.WriteHeader(http.StatusOK)
	}))
// 请求的URL
slowURL := slowServer.URL
```

## select 使用

select 可以等待多个 chan，使用 time.After 防止一直阻塞

```golang
func ping(url string) chan struct{} {
    // 这里使用struct{}作为通道的值，因为struct{}占用的内存最少
    ch := make(chan struct{})
    go func() {
        http.Get(url)
        close(ch)
    }()
    return ch
}

func Racer(a, b string, timeout time.Duration) (winner string, error error) {
    select {
    case <-ping(a):
        return a, nil
    case <-ping(b):
        return b, nil
    case <-time.After(timeout):
        // 如果超时了，会返回一个错误
        return "", fmt.Errorf("timed out waiting for %s and %s", a, b)
    }
}
```

# Reflection

当使用 interface{}作为参数的时候，需要使用 reflect 获取它的实际类型，
reflect.ValueOf()返回一个 Value 的结构体，然后用 Kind 确定它的类型，再通过 Value.方法可以拿到值了

```golang
func walk(x interface{}, fn func(input string)) {
	val := getValue(x)

	var getField func(int) reflect.Value

	switch val.Kind() {
	case reflect.String:
		fn(val.String())
	case reflect.Struct:
		numberOfValues = val.NumField()
		getField = val.Field
	case reflect.Slice, reflect.Array:
		numberOfValues = val.Len()
		getField = val.Index
	case reflect.Map:
		for _, key := range val.MapKeys() {
			walk(val.MapIndex(key).Interface(), fn)
		}
	case reflect.Chan:
		for v, ok := val.Recv(); ok; v, ok = val.Recv() {
			walk(v.Interface(), fn)
		}
	case reflect.Func:
		valFnResult := val.Call(nil)
		for _, res := range valFnResult {
			walk(res.Interface(), fn)
		}
	}
}

func getValue(x interface{}) reflect.Value {
	val := reflect.ValueOf(x)

    // 指针需要使用Elem来获取值
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	return val
}
```

# Sync

- `Mutex` 允许我们给数据加锁
- `Waitgroup` 等待 goroutines 完成 jobs

把 sync.Mutex 放到结构体里，然后更新数据的时候，先 Lock 仔 Unlock，

```golang
package v1

import "sync"

type Counter struct {
	mu    sync.Mutex
	value int
}

func NewCounter() *Counter {
	return &Counter{}
}

func (c *Counter) Inc() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.value++
}

func (c *Counter) Value() int {
	return c.value
}

func sync(){

    wantedCount := 1000
    counter := NewCounter()

    var wg sync.WaitGroup
    // 定义WaitGroup
    wg.Add(wantedCount)
    // 设置job数量
    for i := 0; i < wantedCount; i++ {
        go func(w *sync.WaitGroup) {
            counter.Inc()
            w.Done()
            // 任务完成
        }(&wg) // 需要传入wg
    }
    wg.Wait()
    // 等待所有任务完成
}
```

sync.WaitGroup 结构体有个 noCopy 对象，这个对象不允许拷贝，所以需要用指针值，
用 channels 传递数据
用 mutex 管理状态

# Context

context 用来管理协程运行，contextd 只要有 5 个方法

```golang
Background() Context // 根节点
WithCancel(parent Context) (ctx Context, cancel CancelFunc)
WithDeadline(parent Context, deadline time.Time) (Context, CancelFunc)
WithTimeout(parent Context, timeout time.Duration) (Context, CancelFunc)
WithValue(parent Context, key interface{}, val interface{}) Context
```

```golang
ctx, cancel := context.WithCancel(context.Background())
cancel()  // 终止 context
```

```golang
package context3

import (
    "context"
    "errors"
    "net/http"
    "testing"
    "time"
)
func (s *SpyStore) Fetch(ctx context.Context) (string, error) {
    data := make(chan string, 1)

    go func() {
        var result string
        for _, c := range s.response {
            select {
            // 如果context被取消就会走到这个case
            case <-ctx.Done():
                s.t.Log("spy store got cancelled")
                return
            default:
                time.Sleep(10 * time.Millisecond)
                result += string(c)
            }
        }
        data <- result
    }()

    select {
    case <-ctx.Done():
        return "", ctx.Err()
    case res := <-data:
        return res, nil
    }
}
```

# Reference

- https://github.com/quii/learn-go-with-tests/
- https://blog.golang.org/slices-intro
- https://laisky.com/p/golang/
- https://draveness.me/golang/
- https://changkun.de/golang/
