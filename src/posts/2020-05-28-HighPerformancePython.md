---
layout: post
title: "[读书笔记]HighPerformancePython2e"
date: "2020-05-28"
tags: ["python"]
slug: "2020-05-28-HighPerformancePython"
---

<!-- vim-markdown-toc Redcarpet -->

* [List and Tuple](#list-and-tuple)
* [Dict](#dict)
    * [linear probing](#linear-probing)
    * [Dict Resizing](#dict-resizing)
    * [Hashable Type](#hashable-type)
    * [Dictionaries and Namespaces](#dictionaries-and-namespaces)
* [Iterators and Generators](#iterators-and-generators)
    * [For loop](#for-loop)
    * [itertools](#itertools)
* [Concurrency](#concurrency)
* [How Does async/await Work?](#how-does-async-await-work)
    * [I/O wait](#i-o-wait)
    * [cralwer](#cralwer)
        * [aiohttp > tornado > gevent > serial](#aiohttp->-tornado->-gevent->-serial)
* [The multiprocessing Module](#the-multiprocessing-module)
    * [Overview the multiprocessing module](#overview-the-multiprocessing-module)
    * [Interprocess Communication](#interprocess-communication)
        * [Manager.Value](#manager-value)
        * [Redis](#redis)
        * [multiprocessing.RawValue](#multiprocessing-rawvalue)
        * [mmap.mmap](#mmap-mmap)
* [Clusters and Job Queues](#clusters-and-job-queues)
    * [Benefits](#benefits)
    * [Drawbacks](#drawbacks)
    * [nsq](#nsq)
        * [nsqd](#nsqd)
        * [nsqadmin](#nsqadmin)
        * [nsq_tail](#nsq_tail)
* [Using Less RAM](#using-less-ram)
    * [Understanding the RAM Used in a Collection](#understanding-the-ram-used-in-a-collection)
    * [Bloom Filters](#bloom-filters)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# List and Tuple

list: Lists are dynamic arrays that let us modify and resize the data we are storing,
tuple: tuples are static arrays whose contents are fixed and immutable.
同属于 arrays

Lists are dynamic arrays; they are mutable and allow for resizing (changing the number of elements that are held).

Tuples are static arrays; they are immutable, and the data within them cannot be changed after they have been created.

Tuples are cached by the Python runtime, which means that we don’t need to talk to the kernel to reserve memory every time we want to use one.

# Dict

## linear probing

```
def index_sequence(key, mask=0b111, PERTURB_SHIFT=5):
    perturb = hash(key) 1
    i = perturb & mask
    yield i
    while True:
        perturb >>= PERTURB_SHIFT
        i = (i * 5 + perturb + 1) & mask
        yield i
```

## Dict Resizing

By default, the smallest size of a dictionary or set is 8,it will resize by 3× if the dictionary is more than two-thirds full

```
8; 18; 39; 81; 165; 333; 669; 1,341; 2,685; 5,373; 10,749; 21,501; 43,005;
```

## Hashable Type

\_\_hash\_\_ with \_\_cmp\_\_ or \_\_eq\_\_

## Dictionaries and Namespaces

```
local() -> globals() -> \_\_builtin\_\_
List       Dict
```

[Namespaces](https://github.com/mynameisfiber/high_performance_python_2e/blob/master/04_dict_set/namespace.py)

# Iterators and Generators

## For loop

```
# The Python loop
for i in object:
    do_work(i)

# Is equivalent to
object_iterator = iter(object)
while True:
    try:
        i = next(object_iterator)
    except StopIteration:
        break
    else:
        do_work(i)
```

## itertools

```
islice
Allows slicing a potentially infinite generator

chain
Chains together multiple generators

takewhile
Adds a condition that will end a generator

cycle
Makes a finite generator infinite by constantly repeating it
```

# Concurrency

# How Does async/await Work?

await Future object contain a result

## I/O wait

hard drive, network adapter, GPU

## cralwer

### aiohttp > tornado > gevent > serial

|    Usage    | serial  | gevent | tornado | aiohttp |
| :---------: | :-----: | :----: | :-----: | :-----: |
| Runtime (s) | 102.684 | 1.142  |  1.171  |  1.101  |

# The multiprocessing Module

## Overview the multiprocessing module

Process
A forked copy of the current process; this creates a new process identifier, and the task runs as an independent child process in the operating system. You can start and query the state of the Process and provide it with a target method to run.

Pool
Wraps the Process or threading.Thread API into a convenient pool of workers that share a chunk of work and return an aggregated result.

Queue
A FIFO queue allowing multiple producers and consumers.

Pipe
A uni- or bidirectional communication channel between two processes.

Manager
A high-level managed interface to share Python objects between processes.

ctypes
Allows sharing of primitive datatypes (e.g., integers, floats, and bytes) between processes after they have forked.

multiprocessing use physical cores

## Interprocess Communication

### Manager.Value

### Redis

### multiprocessing.RawValue

behave similarly to array.array

### mmap.mmap

seek
read_byte
write_byte

#Clusters and Job Queues

## Benefits

- easily scale computing requirements
- clusters can be separated geographically

## Drawbacks

- Maintaining expensive

## nsq

produce -> topic -> channels -> consumers

### nsqd

start an instance

### nsqadmin

```
curl "http://127.0.0.1:4151/stats"
```

or

```
nsqadmin --lookupd-http-address=127.0.0.1:4161
```

### nsq_tail

```
nsq_tail --topic prime -n 5 --nsqd-tcp-address=127.0.0.1:4150
```

# Using Less RAM

## Understanding the RAM Used in a Collection

int object costs 24 bytes in Python 3.7

empty byte sequence costs 33 bytes

An empty list costs 64 bytes, each item in the list takes another 8 bytes on a 64-bit laptop

## Bloom Filters

self.num*bits = int((-capacity * math.log(error)) // math.log(2) \*\* 2 + 1)
self.num*hashes = int((self.num_bits * math.log(2)) // capacity + 1)

# Reference

- https://learning.oreilly.com/library/view/high-performance-python/9781492055013/
- https://github.com/mynameisfiber/high_performance_python
- https://github.com/mynameisfiber/high_performance_python_2e
