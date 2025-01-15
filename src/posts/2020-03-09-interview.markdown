---
layout: post
title: "多年前面试的题目"
date: "2020-03-09"
tags: ["interview"]
slug: "2020-03-09-interview"
---

<!-- vim-markdown-toc Redcarpet -->

- [前言](#前言)
  - [1、写出 r'123\n'\*3 的运行结果](#1、写出-r-39-123-n-39-3-的运行结果)
  - [2、用 for in 执行 1 亿次 自增操作](#2、用-for-in-执行-1-亿次-自增操作)
  - [3、函数式编程](#3、函数式编程)
  - [4、简述 classmothed 和 staticmethod 的区别](#4、简述-classmothed-和-staticmethod-的区别)
  - [5、请简述一下代码的作用`options，args = getopt.getopt(sys.argv[1:],"hu:p:i:","url=","path=","port="])`](#5、请简述一下代码的作用-options，args-getopt-getopt-sys-argv-1-quot-hu-p-i-quot-quot-url-quot-quot-path-quot-quot-port-quot)
  - [6、已知 A 类，B 类，C 类（继承自 A 类），D 类（继承自 B 类），E 类（继承自 C，D），如果 A,D 类都有个办法 demo()，请问调用 E 类的 demo 的方法时，将会调用哪个基类的 demo()方法？并说明原因](#6、已知-a-类，b-类，c-类（继承自-a-类），d-类（继承自-b-类），e-类（继承自-c，d），如果-a-d-类都有个办法-demo-，请问调用-e-类的-demo-的方法时，将会调用哪个基类的-demo-方法？并说明原因)
  - [7、请简单说明 search()和 match()的区别](#7、请简单说明-search-和-match-的区别)
  - [８、如何拷贝一个对象？并简单说一下赋值，浅拷贝、深拷贝的区别](#８、如何拷贝一个对象？并简单说一下赋值，浅拷贝、深拷贝的区别)
  - [９、请写出一段代码实现删除一个列表 temp 里面的重复元素](#９、请写出一段代码实现删除一个列表-temp-里面的重复元素)
  - [10、用 Python 匹配 HTML.tag 的时候，<._>和<._?>有什么区别？](#10、用-python-匹配-html-tag-的时候，和有什么区别？)
  - [11、请简单的介绍 python 的垃圾回收机制，它是否能处理循环引用的问题？并说明原因](#11、请简单的介绍-python-的垃圾回收机制，它是否能处理循环引用的问题？并说明原因)
  - [12、你有 8 个一样大小的球，其中 7 个的质量是一样的，另一个比较重，怎样用两次将那个重一些的球找出来](#12、你有-8-个一样大小的球，其中-7-个的质量是一样的，另一个比较重，怎样用两次将那个重一些的球找出来)
  - [13、使用修饰器实现一个单例](#13、使用修饰器实现一个单例)
  - [14、实现一个字典类，要求元素只能被设置 1 次](#14、实现一个字典类，要求元素只能被设置-1-次)
  - [15、MySQL 数据库操作](#15、mysql-数据库操作)

<!-- vim-markdown-toc -->

## 前言

多年前面试的题目

### 1、写出 r'123\n'\*3 的运行结果

```
123\n123\n123\n
```

拓展：print '123\n'\*3

```
123
123
123
```

### 2、用 for in 执行 1 亿次 自增操作

```
for i in xrange(100000000)
for i in range(100000000)
补充：xrange 用法与 range 完全相同，所不同的是生成的不是一个list对象，而是一个生成器。

```

### 3、函数式编程

```
reduce(lambda x,i : x+i ,[ i for i in temp if i>0 and temp.index(i)%2==0  ])
补充:

map()
将序列中的元素通过处理函数处理后返回一个新的列表

filter()
将序列中的元素通过函数过滤后返回一个新的列表

reduce()
将序列中的元素通过一个二元函数处理返回一个结果
```

### 4、简述 classmothed 和 staticmethod 的区别

```
对于classmethod的参数，需要隐式地传递类名，而staticmethod参数中则不需要传递类名，其实这就是二者最大的区别。

二者都可以通过类名或者类实例对象来调用，因为强调的是classmethod和staticmethod，所以在写代码的时候最好使用类名。

对于staticmethod就是为了要在类中定义而设置的，一般来说很少这样使用，可以使用模块级(module-level)的函数来替代它。既然要把它定义在类中，想必有作者的考虑。

对于classmethod，可以通过子类来进行重定义。

```

### 5、请简述一下代码的作用`options，args = getopt.getopt(sys.argv[1:],"hu:p:i:","url=","path=","port="])`

```
首先getopt是用来处理命令行参数的，
默认参数 getopt(args, shortopts, longopts = [])
shortopts: 是短格式 (-)
longtopts: 是长格式 (--)
短格式中带: 表示后面要参数
长格式中带= 表示后面要参数
options，args都是列表，只是options列表中有元组，而args只是单纯的列表
options会将匹配到的参数，用类似key-value的形式保存在元组中，而没有配到的数据会保存到args中，
```

```
python getopt_init.py  --url=www.baidu.com -u www.baidu.com -p 88 -i 127.0.0.1 --port=88 55 66

#options结果
[('--url', 'www.baidu.com'), ('-u', 'www.baidu.com'), ('-p', '88'), ('-i', '127.0.0.1'), ('--port', '88')]
#args的结果
['55', '66']
```

### 6、已知 A 类，B 类，C 类（继承自 A 类），D 类（继承自 B 类），E 类（继承自 C，D），如果 A,D 类都有个办法 demo()，请问调用 E 类的 demo 的方法时，将会调用哪个基类的 demo()方法？并说明原因

```
#conding:utf-8
#!/usr/bin python
class A:
    def __init__(self,data_A= "A_data"):
        self.data = data_A

    def demo(self):
        print "A.demo()"


class B:
    def __init__(self,data_B="B_data"):
        self.data =data_B



class C(A):
    def __init__(self,data_C="C_data"):
        #A.__init__(self,data_A="A_data")
        self.data = data_C



class D(B):
    def __init__(self,data_D="D_data",data_B="B_data"):

        self.data = data_D

    def demo(self):
        print "D.demo()"
class E(C,D):
    def __init__(self,data_E="E_data"):
        self.data = data_E


E = E()
print E.demo()
```

```
运行结果:
A.demo()
```

### 7、请简单说明 search()和 match()的区别

```
match()函数只检测是不是在string的开始位置匹配，
search()会扫描整个string查找匹配；
match()只有在0位置匹配成功的话才有返回，如果不是开始位置匹配成功的话，match()就返回none
search()会扫描整个字符串并返回第一个成功的匹配
```

### ８、如何拷贝一个对象？并简单说一下赋值，浅拷贝、深拷贝的区别

```
1. 赋值是将一个对象的地址赋值给一个变量，让变量指向该地址

2. 浅拷贝是在另一块地址中创建一个新的变量或容器，但是容器内的元素的地址均是源对象的元素的地址的拷贝。也就是说新的容器中指向了旧的元素

3. 深拷贝是在另一块地址中创建一个新的变量或容器，同时容器内的元素的地址也是新开辟的，仅仅是值相同而已，是完全的副本。

```

### ９、请写出一段代码实现删除一个列表 temp 里面的重复元素

```
list(set(temp))
```

### 10、用 Python 匹配 HTML.tag 的时候，<._>和<._?>有什么区别？

```
第一种写法是，尽可能多的匹配，就是匹配到的字符串尽量长，第二种写法是尽可能少的匹配，就是匹配到的字符串尽量短。
```

### 11、请简单的介绍 python 的垃圾回收机制，它是否能处理循环引用的问题？并说明原因

```
在Python中，每个对象都保存了一个称为引用计数的整数值，来追踪到底有多少引用指向了这个对象。无论何时，如果程序中的一个变量或其他对象引用了目标对象，Python将会增加这个计数值，而当程序停止使用这个对象，则Python会减少这个计数值。一旦计数值被减到零，Python将会释放这个对象以及回收相关内存空间。

list1与list2相互引用，如果不存在其他对象对它们的引用，list1与list2的引用计数也仍然为1，所占用的内存永远无法被回收，这将是致命的。
```

### 12、你有 8 个一样大小的球，其中 7 个的质量是一样的，另一个比较重，怎样用两次将那个重一些的球找出来

```
1、分别拿3个球放在天平的两边,如果天平平衡,则再称剩余的两个球；
2、如果天平不平衡,则把重的一边的3个球中任选2个球放在天平两边
3、若天平平衡,则剩余的那个球是比较重的那个,若不平衡,则天平下沉的一端是那个重一些的球
```

### 13、使用修饰器实现一个单例

单例模式：系统中一个类只有一个实例而且该实例易于外界访问

```
def singleton(cls, *args, **kw):
    instances = {}
    def _singleton():
        if cls not in instances:
            instances[cls] = cls(*args, **kw)
        return instances[cls]
    return _singleton

@singleton
class MyClass(object):
    a = 1
    def __init__(self, x=0):
        self.x = x

one = MyClass()
two = MyClass()
one.x = 2
two.a = 5
print one.x
#2
print two.x
#2
print one.a
#5
print one.a
#5

```

### 14、实现一个字典类，要求元素只能被设置 1 次

```
class ODict(dict):
    def __setitem__(self,key,value):
        if self.__contains__(key):
            raise ValueError("The Value Exists")
        else:
            super(ODict, self).__setitem__(key, value)

d = ODict()
d["hello"] = "world"
d["hello"] = "1111"
```

```
会出现错误提示
ValueError: The Value Exists
```

### 15、MySQL 数据库操作

表 demo1 如下：

| name | subject | score |
| :--: | :-----: | :---: |
| 张三 |  数学   |  97   |
| 张五 |  数学   |  63   |
| 杨七 |  科学   |  84   |
| 杨三 |  科学   |  88   |
| 王五 |  语文   |  54   |
| 王六 |  语文   |  72   |
| 赵七 |  英语   |  91   |
| 赵六 |  英语   |  78   |

表 demo2 如下：
| name | level |
|:------:|:-------:|
| 张三 | 1 |
| 张五 | 5 |
| 杨七 | 4 |
| 杨三 | 8 |
| 王五 | 2 |
| 王六 | 6 |
| 赵七 | 7 |
| 赵六 | 3 |

1.请将上面的表格用 json 表达。

```
{
    "张三": {
        "数学": 97
    },
    "张五": {
        "数学": 63
    },
    "杨七": {
        "科学": 84
    },
    "杨三": {
        "科学": 88
    },
    "王五": {
        "语文": 54
    },
    "王六": {
        "语文": 72
    },
    "赵七": {
        "数学": 91
    },
    "赵六": {
        "数学": 78
    }
}
```

```
{
    "张三": 1,
    "张五": 5,
    "杨七": 4,
    "杨三": 8,
    "王五": 2,
    "王六": 6,
    "赵七": 7,
    "赵六": 3
}
```

2.请用一句话 SQL 统计 60，70，80，90 分各档次的人数，并输出人数大于 2 的记录，val1 为分数，val2 为人数。

```
select *
from (
select case
when (score >=60 and score <70) then "60-70"
when (score >=70 and score <80) then "70-80"
when (score >=80 and score <90) then "80-90"
when (score >=90 ) then "90-100"
else '100'
end "val1",
count(*) 'val2' from demo1
group by
case
when (score >=60 and score <70) then "60-70"
when (score >=70 and score <80) then "70-80"
when (score >=80 and score <90) then "80-90"
when (score >=90 ) then "90-100"
end
order by 1
) as bbb
where bbb.val2>=2
```

3.请用 SQL 输出 demo1 左连接 demo2，并且 level 大于 5 的记录。

```
select distinct
demo2.name,level from demo1 left join demo2 on (demo2.level>5);
```
