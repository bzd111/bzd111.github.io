---
date: "2022-12-05"
slug: "/2022-12-05-how-linux-work"
layout: post
title: "[读书笔记]Linux是怎样工作的"
tags: ["linux", "note"]
---

<!-- vim-markdown-toc GitLab -->

* [Linux是怎样工作的](#linux是怎样工作的)
* [准备工作](#准备工作)
* [系统调用](#系统调用)
  * [strace 查看系统调用](#strace-查看系统调用)
  * [sar](#sar)
  * [C标准库](#c标准库)
    * [ldd](#ldd)
* [进程管理](#进程管理)
  * [创建进程](#创建进程)
  * [fork()函数](#fork函数)
  * [execve()函数](#execve函数)
    * [linux可执行文件](#linux可执行文件)
* [进程调度器](#进程调度器)
  * [上下文切换](#上下文切换)
  * [进程的状态](#进程的状态)
    * [处于睡眠态的事件](#处于睡眠态的事件)
    * [状态转换](#状态转换)
    * [空闲状态](#空闲状态)
    * [吞吐量与延迟](#吞吐量与延迟)
    * [现实中的系统](#现实中的系统)
    * [存在多个逻辑CPU时的调度](#存在多个逻辑cpu时的调度)
    * [运行时间和执行时间](#运行时间和执行时间)
    * [现实中的进程](#现实中的进程)
    * [变更优先级](#变更优先级)
* [内存](#内存)
* [内存相关的统计信息](#内存相关的统计信息)
  * [内存不足(Out Of Memory) OOM](#内存不足out-of-memory-oom)
  * [简单的内存分配](#简单的内存分配)
  * [内存分配的问题](#内存分配的问题)
  * [虚拟内存](#虚拟内存)
    * [页表](#页表)
    * [为进程分配内存](#为进程分配内存)
    * [在动态分配内存时](#在动态分配内存时)
    * [利用上层进行内存分配](#利用上层进行内存分配)
  * [实验](#实验)
  * [虚拟内存的应用](#虚拟内存的应用)
    * [文件映射](#文件映射)
    * [请求分页机](#请求分页机)
  * [写时复制](#写时复制)
  * [Swap](#swap)
  * [多级页表](#多级页表)
  * [标准大页](#标准大页)
    * [透明大页](#透明大页)
* [存储层次](#存储层次)
  * [高速缓存](#高速缓存)
    * [高速缓存工作方式](#高速缓存工作方式)
    * [读](#读)
    * [写](#写)
    * [高速缓存不足时](#高速缓存不足时)
    * [多级缓存](#多级缓存)
  * [页面缓存](#页面缓存)
  * [流程](#流程)
    * [读取](#读取)
    * [写入](#写入)
    * [同步写入](#同步写入)
  * [读取文件的实验](#读取文件的实验)
    * [采集统计信息](#采集统计信息)
    * [写入文件的实验](#写入文件的实验)
    * [页面缓存调优参数](#页面缓存调优参数)
* [文件系统](#文件系统)
  * [Linux的文件系统](#linux的文件系统)
    * [面向用户的访问接口](#面向用户的访问接口)
    * [读取文件流程](#读取文件流程)
  * [数据与元数据](#数据与元数据)
  * [容量限制](#容量限制)
  * [文件系统不一致](#文件系统不一致)
    * [日志](#日志)
    * [写时复制](#写时复制-1)
  * [文件的种类](#文件的种类)
    * [设备文件](#设备文件)
    * [字符设备](#字符设备)
    * [块设备](#块设备)
  * [各种各样的文件系统](#各种各样的文件系统)
    * [基于内存的文件系统](#基于内存的文件系统)
    * [网络文件系统](#网络文件系统)
    * [虚拟文件系统](#虚拟文件系统)
* [外部存储器](#外部存储器)
  * [HDD的数据读写机制](#hdd的数据读写机制)
    * [数据传输流程](#数据传输流程)
    * [写入特性](#写入特性)
  * [预读](#预读)
  * [SSD](#ssd)

<!-- vim-markdown-toc -->

# Linux是怎样工作的

# 准备工作

Ubuntu 16.04/x86_64

```
sudo apt install binutils build-essential sysstat

```

# 系统调用

hello.c

```

#include <stdio.h>

int main(void){
	puts("hello, world");
	return 0;
}

```

[hello.py](http://hello.py/)

```
print("hello, world")

```

## strace 查看系统调用

```
cc -o hello hello.c
#./hello
hello, world
# strace -o hello.log ./hello
hello, world
# cat hello.log
# strace -T -o  hello_t.log ./hello # 带上耗时

# strace -T -o hello.py.log python3 hello.py

```

## sar

```
sar -P ALL 1 # 查看各模式下的运行时间
Linux 5.4.0-42-generic (VM-4-14-ubuntu) 	10/19/2022 	_x86_64_	(2 CPU)

10:22:31 PM     CPU     %user     %nice   %system   %iowait    %steal     %idle
10:22:32 PM     all      0.51      0.00      0.00      0.00      0.00     99.49
10:22:32 PM       0      1.01      0.00      0.00      0.00      0.00     98.99
10:22:32 PM       1      0.00      0.00      0.00      0.00      0.00    100.00

10:22:32 PM     CPU     %user     %nice   %system   %iowait    %steal     %idle
10:22:33 PM     all      8.54      0.00      0.50      0.50      0.00     90.45
10:22:33 PM       0      9.00      0.00      1.00      0.00      0.00     90.00
10:22:33 PM       1      8.08      0.00      0.00      1.01      0.00     90.91

```

用户态无限循环

```
cat loop.c
int main(void){
	for(;;)
	;
}

cc -o loop loop.c
./loop &
[1] 224242
sar -P ALL 1
Linux 5.4.0-42-generic (VM-4-14-ubuntu) 	10/19/2022 	_x86_64_	(2 CPU)

10:29:53 PM     CPU     %user     %nice   %system   %iowait    %steal     %idle
10:29:54 PM     all     60.20      0.00      0.50      0.50      0.00     38.81
10:29:54 PM       0     20.79      0.00      0.99      0.99      0.00     77.23
10:29:54 PM       1    100.00      0.00      0.00      0.00      0.00      0.00

10:29:54 PM     CPU     %user     %nice   %system   %iowait    %steal     %idle
10:29:55 PM     all     51.26      0.00      0.50      0.00      0.00     48.24
10:29:55 PM       0      2.02      0.00      1.01      0.00      0.00     96.97
10:29:55 PM       1    100.00      0.00      0.00      0.00      0.00      0.00

10:29:55 PM     CPU     %user     %nice   %system   %iowait    %steal     %idle
10:29:56 PM     all     50.25      0.00      0.00      0.00      0.00     49.75
10:29:56 PM       0      0.00      0.00      0.00      0.00      0.00    100.00
10:29:56 PM       1    100.00      0.00      0.00      0.00      0.00      0.00

```

大量内核态

```
cat ppidloop.c
#include <sys/types.h>
#include <unistd.h>

int main(void)
{
    for(;;)
        getppid();
}

cc -o ppidloop ppidloop.c
./ppidloop &
[1] 225005

sar -P ALL 1 1
Linux 5.4.0-42-generic (VM-4-14-ubuntu) 	10/19/2022 	_x86_64_	(2 CPU)

10:35:01 PM     CPU     %user     %nice   %system   %iowait    %steal     %idle
10:35:02 PM     all     16.67      0.00     35.86      0.00      0.00     47.47
10:35:02 PM       0      2.04      0.00      2.04      0.00      0.00     95.92
10:35:02 PM       1     31.00      0.00     69.00      0.00      0.00      0.00

Average:        CPU     %user     %nice   %system   %iowait    %steal     %idle
Average:        all     16.67      0.00     35.86      0.00      0.00     47.47
Average:          0      2.04      0.00      2.04      0.00      0.00     95.92
Average:          1     31.00      0.00     69.00      0.00      0.00      0.00

```

## C标准库

系统调用的标准库及POSIX标准中定义的函数

通常会以GNU项目提供的glibc作为C标准库使用

### ldd

ldd用于查看程序所依赖的库

```
$ ldd /bin/echo
	linux-vdso.so.1 (0x00007ffd37dbe000)
	libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007fc36d43a000)
	/lib64/ld-linux-x86-64.so.2 (0x00007fc36d640000)

$ ldd /usr/bin/python3
	linux-vdso.so.1 (0x00007ffe3ea61000)
	libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f6093a1f000)
	libpthread.so.0 => /lib/x86_64-linux-gnu/libpthread.so.0 (0x00007f60939fc000)
	libdl.so.2 => /lib/x86_64-linux-gnu/libdl.so.2 (0x00007f60939f6000)
	libutil.so.1 => /lib/x86_64-linux-gnu/libutil.so.1 (0x00007f60939f1000)
	libm.so.6 => /lib/x86_64-linux-gnu/libm.so.6 (0x00007f60938a2000)
	libexpat.so.1 => /lib/x86_64-linux-gnu/libexpat.so.1 (0x00007f6093874000)
	libz.so.1 => /lib/x86_64-linux-gnu/libz.so.1 (0x00007f6093856000)
	/lib64/ld-linux-x86-64.so.2 (0x00007f6093c1a000)

```

# 进程管理

## 创建进程

- 将同一个进程分成多个进程处理
- 创建

Linux提供了fork()函数和execve()函数，其底层分别调用clone()和execve()的系统调用

## fork()函数

1. 为子进程申请内存空间，并复制父进程的内存到子进程的内存空间
2. 父进程与子进程分裂成两个进程，以执行不同的代码。这一点的实现依赖于fork()函数分别返回不同的值给父进程与子进程。

fork.c

```
#include<unistd.h>
#include<stdio.h>
#include<stdlib.h>
#include<err.h>

static void child(){
    printf("I'm child my pid is %d. \\n", getpid());
    exit(EXIT_SUCCESS);
}

static void parent(pid_t pid_c){
    printf("I'm parent my pid is %d and the pid of my child is %d. \\n", getpid(), pid_c);
    exit(EXIT_SUCCESS);
}

int main(void){
    pid_t ret;
    ret = fork();
    if(ret == -1)
        err(EXIT_FAILURE, "fork failed");
    if(ret == 0){
        // fork()会返回0给子进程
        child();
    }else{
        //fork()会返回新创建的子进程的ID
        parent(ret);
    }
    err(EXIT_FAILURE, "shouldn't reach here");
}

```

## execve()函数

- 读取可执行文件，并读取创建进程的内存印象所需的信息
- 用新进程的数据覆盖当前进程的内存
- 从最初的命令开始运行新的进程

### linux可执行文件

linux可执行文件的结构遵循名为ELF(Executable and Linkable Format)

```
ubuntu@VM-4-14-ubuntu:~$ readelf -h /usr/bin/sleep
ELF Header:
  Magic:   7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00
  Class:                             ELF64
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  ABI Version:                       0
  Type:                              DYN (Shared object file)
  Machine:                           Advanced Micro Devices X86-64
  Version:                           0x1
  Entry point address:               0x2850
  Start of program headers:          64 (bytes into file)
  Start of section headers:          37336 (bytes into file)
  Flags:                             0x0
  Size of this header:               64 (bytes)
  Size of program headers:           56 (bytes)
  Number of program headers:         13
  Size of section headers:           64 (bytes)
  Number of section headers:         30
  Section header string table index: 29

```

代码段和数据段在文件中的偏移量、大小和起始位置。

```
ubuntu@VM-4-14-ubuntu:~$ readelf -S /usr/bin/sleep
There are 30 section headers, starting at offset 0x91d8:

Section Headers:
  [Nr] Name              Type             Address           Offset
       Size              EntSize          Flags  Link  Info  Align
  [ 0]                   NULL             0000000000000000  00000000
       0000000000000000  0000000000000000           0     0     0
  [ 1] .interp           PROGBITS         0000000000000318  00000318
       000000000000001c  0000000000000000   A       0     0     1
  [ 2] .note.gnu.propert NOTE             0000000000000338  00000338
       0000000000000020  0000000000000000   A       0     0     8
  [ 3] .note.gnu.build-i NOTE             0000000000000358  00000358
       0000000000000024  0000000000000000   A       0     0     4
  [ 4] .note.ABI-tag     NOTE             000000000000037c  0000037c
       0000000000000020  0000000000000000   A       0     0     4
  [ 5] .gnu.hash         GNU_HASH         00000000000003a0  000003a0
       00000000000000a8  0000000000000000   A       6     0     8
  [ 6] .dynsym           DYNSYM           0000000000000448  00000448
       0000000000000600  0000000000000018   A       7     1     8
  [ 7] .dynstr           STRTAB           0000000000000a48  00000a48
       000000000000031f  0000000000000000   A       0     0     1
  [ 8] .gnu.version      VERSYM           0000000000000d68  00000d68
       0000000000000080  0000000000000002   A       6     0     2
  [ 9] .gnu.version_r    VERNEED          0000000000000de8  00000de8
       0000000000000060  0000000000000000   A       7     1     8
  [10] .rela.dyn         RELA             0000000000000e48  00000e48
       00000000000002b8  0000000000000018   A       6     0     8
  [11] .rela.plt         RELA             0000000000001100  00001100
       00000000000003f0  0000000000000018  AI       6    25     8
  [12] .init             PROGBITS         0000000000002000  00002000
       000000000000001b  0000000000000000  AX       0     0     4
  [13] .plt              PROGBITS         0000000000002020  00002020
       00000000000002b0  0000000000000010  AX       0     0     16
  [14] .plt.got          PROGBITS         00000000000022d0  000022d0
       0000000000000010  0000000000000010  AX       0     0     16
  [15] .plt.sec          PROGBITS         00000000000022e0  000022e0
       00000000000002a0  0000000000000010  AX       0     0     16
  [16] .text             PROGBITS         0000000000002580  00002580
       0000000000003692  0000000000000000  AX       0     0     16
  [17] .fini             PROGBITS         0000000000005c14  00005c14
       000000000000000d  0000000000000000  AX       0     0     4
  [18] .rodata           PROGBITS         0000000000006000  00006000
       0000000000000f6c  0000000000000000   A       0     0     32
  [19] .eh_frame_hdr     PROGBITS         0000000000006f6c  00006f6c
       00000000000002b4  0000000000000000   A       0     0     4
  [20] .eh_frame         PROGBITS         0000000000007220  00007220
       0000000000000d18  0000000000000000   A       0     0     8
  [21] .init_array       INIT_ARRAY       0000000000009bb0  00008bb0
       0000000000000008  0000000000000008  WA       0     0     8
  [22] .fini_array       FINI_ARRAY       0000000000009bb8  00008bb8
       0000000000000008  0000000000000008  WA       0     0     8
  [23] .data.rel.ro      PROGBITS         0000000000009bc0  00008bc0
       00000000000000b8  0000000000000000  WA       0     0     32
  [24] .dynamic          DYNAMIC          0000000000009c78  00008c78
       00000000000001f0  0000000000000010  WA       7     0     8
  [25] .got              PROGBITS         0000000000009e68  00008e68
       0000000000000190  0000000000000008  WA       0     0     8
  [26] .data             PROGBITS         000000000000a000  00009000
       0000000000000080  0000000000000000  WA       0     0     32
  [27] .bss              NOBITS           000000000000a080  00009080
       00000000000001b8  0000000000000000  WA       0     0     32
  [28] .gnu_debuglink    PROGBITS         0000000000000000  00009080
       0000000000000034  0000000000000000           0     0     4
  [29] .shstrtab         STRTAB           0000000000000000  000090b4
       000000000000011d  0000000000000000           0     0     1

```

```

```

# 进程调度器

- 一个CPU同事只运行一个进程
- 在同时进行多个进程时，每个进程都会获得适当的时长，轮流在CPU上执行处理

系统识别出来的CPU成为`逻辑CPU`，开启超线程，每一个线程都会被识别为逻辑CPU

sched.c

```

```

taskset通过-c选项，可以指定程序仅运行在指定的逻辑CPU上。

```
taskset -c 0 ./sched <n> <total> <resol>

```

## 上下文切换

是指切换正在逻辑CPU上运行的进程。

## 进程的状态

运行态(R)：正在逻辑CPU上运行

就绪态(R)：进程具备运行条件，等待分配CPU时间

睡眠态(S/D)：进程不准备运行，除非发生某事件。在此期间不消耗CPU时间

```
               S是指可通过接收信号回到运行态，D主要出现于等待外部存储器的访问时

```

僵死状态(Z)：进程运行结束，正在等待父进程将其回收

### 处于睡眠态的事件

1. 等待指定的事件(比如等待3分钟)
2. 等待用户通过键盘或鼠标等设备进行输入
3. 等待HDD或SDD等外部存储器的读写结束
4. 等待网络的数据收发结束

### 状态转换

![IMG_8541 4.HEIC](Linux%E6%98%AF%E6%80%8E%E6%A0%B7%E5%B7%A5%E4%BD%9C%E7%9A%84%2087ed1df30fa64c79bfce432f71de4fec/IMG_8541_4.heic)

### 空闲状态

如果没有任务在CPU上运行，逻辑CPU会运行一个被称为空闲进程的不执行任何处理的特殊进程

```
ubuntu@VM-4-14-ubuntu:~$ cat loop.py
while True:
    pass
ubuntu@VM-4-14-ubuntu:~$ taskset -c 0 python3 loop.py &
[1] 2818225
ubuntu@VM-4-14-ubuntu:~$ sar -P ALL 1
Linux 5.4.0-42-generic (VM-4-14-ubuntu) 	10/31/2022 	_x86_64_	(2 CPU)

01:27:20 PM     CPU     %user     %nice   %system   %iowait    %steal     %idle
01:27:21 PM     all     55.22      0.00      1.00      0.00      0.00     43.78
01:27:21 PM       0    100.00      0.00      0.00      0.00      0.00      0.00
01:27:21 PM       1     10.89      0.00      1.98      0.00      0.00     87.13

01:27:21 PM     CPU     %user     %nice   %system   %iowait    %steal     %idle
01:27:22 PM     all     50.50      0.00      0.00      0.00      0.00     49.50
01:27:22 PM       0    100.00      0.00      0.00      0.00      0.00      0.00
01:27:22 PM       1      1.00      0.00      0.00      0.00      0.00     99.00

01:27:22 PM     CPU     %user     %nice   %system   %iowait    %steal     %idle
01:27:23 PM     all     51.01      0.00      0.51      0.00      0.00     48.48
01:27:23 PM       0    100.00      0.00      0.00      0.00      0.00      0.00
01:27:23 PM       1      1.02      0.00      1.02      0.00      0.00     97.96

01:27:23 PM     CPU     %user     %nice   %system   %iowait    %steal     %idle
01:27:24 PM     all     62.81      0.00      0.50      1.01      0.00     35.68
01:27:24 PM       0    100.00      0.00      0.00      0.00      0.00      0.00
01:27:24 PM       1     25.25      0.00      1.01      2.02      0.00     71.72

```

### 吞吐量与延迟

吞吐量：单位时间内的总工作量，越大越好

吞吐量 = 处理完成的进程数量 / 耗费的时间

延迟：各种处理从开始到完成所耗费的时间，越短越好

延迟 = 结束处理的时间 - 开始处理的时间

### 现实中的系统

- 空闲状态。由于逻辑CPU处于空闲状态，所以吞吐量会降低
- 进程正在运行，且没有处于就绪态的进程，这是一种理想状态。如果在这样的状态下加入一个处于就绪态的进程
- 进程正在运行中，且存在就绪态的进程。这是吞吐量很大，但是延迟会变长

sar 命令中的%idle字段，

```
ubuntu@VM-4-14-ubuntu:~$ sar -q 1 1
Linux 5.4.0-42-generic (VM-4-14-ubuntu) 	10/31/2022 	_x86_64_	(2 CPU)

08:24:36 PM   runq-sz  plist-sz   ldavg-1   ldavg-5  ldavg-15   blocked
08:24:37 PM         0       379      0.15      0.15      0.08         0
Average:            0       379      0.15      0.15      0.08         0

```

sar -q的runq-sz字段。该字段显示的是处于运行态或者就绪态的进程总数(全部逻辑CPU的合计值)

### 存在多个逻辑CPU时的调度

- 一个CPU同时只能运行一个进程
- 在同时运行多个进程时，每个进程都会获得适当的时长，轮流在CPU上执行处理
- 对于多核CPU的计算机来说，只有同时运行多个进程才能提高吞吐量。
- 与只有单个逻辑CPU时一样，当进程数量多于逻辑CPU数量是，吞吐量就不会在提高

获取cpu数量

```
$ grep -c processor /proc/cpuinfo
2

```

### 运行时间和执行时间

- 运行时间：进程从开始运行到运行结束为止所经过的时间
- 执行时间：进程实际占用逻辑CPU的时长

### 现实中的进程

ps -eo的命令，etime字段和time字段分别表示进程从开始到执行命令为止的运行时间和执行时间

```
$ ps -eo pid,comm,etime,time
    PID COMMAND             ELAPSED     TIME
      1 systemd         32-07:08:42 00:00:38
      2 kthreadd        32-07:08:42 00:00:01
      3 rcu_gp          32-07:08:42 00:00:00
      4 rcu_par_gp      32-07:08:42 00:00:00
      6 kworker/0:0H-kb 32-07:08:42 00:00:00
      9 mm_percpu_wq    32-07:08:42 00:00:00
     10 ksoftirqd/0     32-07:08:42 00:04:46
     11 rcu_sched       32-07:08:42 00:14:16
     12 migration/0     32-07:08:42 00:00:15
     13 idle_inject/0   32-07:08:42 00:00:00
     14 cpuhp/0         32-07:08:42 00:00:00
     15 cpuhp/1         32-07:08:42 00:00:00

```

### 变更优先级

nice()系统调用，可以设定进程的运行优先级

```
$ nice -n 5 echo hello
Hello

# sar命令输出的%nice字段表示从默认值0更改为其他优先级后，进程运行时间所占的比例
$ nice -n 5 python3 ./loop.py &
2895557
$ sar -P ALL 1 1
Linux 5.4.0-42-generic (VM-4-14-ubuntu) 	10/31/2022 	_x86_64_	(2 CPU)

09:31:03 PM     CPU     %user     %nice   %system   %iowait    %steal     %idle
09:31:04 PM     all      2.00     50.00      0.50      0.00      0.00     47.50
09:31:04 PM       0      0.00    100.00      0.00      0.00      0.00      0.00
09:31:04 PM       1      4.00      0.00      1.00      0.00      0.00     95.00

Average:        CPU     %user     %nice   %system   %iowait    %steal     %idle
Average:        all      2.00     50.00      0.50      0.00      0.00     47.50
Average:          0      0.00    100.00      0.00      0.00      0.00      0.00
Average:          1      4.00      0.00      1.00      0.00      0.00     95.00

```

taskset命令也是OS提供的调度器相关的程序，该命令请求被称为sched_setaffinity()的系统调用，将程序限定在指定的逻辑CPU上运行。

# 内存

# 内存相关的统计信息

```
$ free
              total        used        free      shared  buff/cache   available
Mem:        4030588     1732532      155376        2828     2142680     1855968
Swap:             0           0           0

```

- total：系统搭载的物理内存总量。
- free：表面上的可用内存量
- buff/cache：缓冲区缓存与页面缓存占用的内存。当系统的可用内存量(free字段的值)减少时，可通过内核将它们释放出来
- available：实际的可用内存量。本字段的值为free字段的值加上内存不足时内核中可释放的内存量。可释放的内存指缓冲区与页面缓存中的大部分内存，以及内核中除此以外的用于其他地方的部分内存

![IMG_8543.HEIC](Linux%E6%98%AF%E6%80%8E%E6%A0%B7%E5%B7%A5%E4%BD%9C%E7%9A%84%2087ed1df30fa64c79bfce432f71de4fec/IMG_8543.heic)

```
# sar -r 可以指定采集周期
# free == kbmemfree
# buff/cache == kbbuffers/kbcached
$ sar -r 1
Linux 5.4.0-42-generic (VM-4-14-ubuntu) 	10/31/2022 	_x86_64_	(2 CPU)

10:18:44 PM kbmemfree   kbavail kbmemused  %memused kbbuffers  kbcached  kbcommit   %commit  kbactive   kbinact   kbdirty
10:18:45 PM    161236   1863956   1640924     40.71     83088   1458708   3659512     90.79   1570012    625348      3436
10:18:46 PM    162440   1865220   1639636     40.68     83088   1458768   3659512     90.79   1569772    625392      3540
10:18:47 PM    162780   1865560   1639296     40.67     83088   1458768   3659512     90.79   1568956    625388      3540
10:18:48 PM    162008   1864804   1640024     40.69     83088   1458772   3660052     90.81   1569068    625388      3544
10:18:49 PM    161400   1864276   1640556     40.70     83088   1458848   3660052     90.81   1570620    625456      3308

```

## 内存不足(Out Of Memory) OOM

在进入OOM状态，内存管理系统会运行被称为OOM Killer的可怕功能。它会选择合适的进程并将其强制终止，以释放出更多的内存。

sysctl的vm.panic_on_oom默认是0，在发生OOM时运行OOM Killer，

变更为1，在发生OOM时强制关闭系统

## 简单的内存分配

- 在创建进程时
- 在创建完进程后，动态分配内存时

## 内存分配的问题

- 内存碎片化
    - 在进程被创建后，如果不断重复执行获取与释放内存的操作，就会引发内存碎片化的问题
- 访问用于其他用途的内存区域
    - 进程均可通过内存地址来访问内核或其他进程所使用的内存
- 难以执行多任务
    - 再次启动同一个程序并尝试映射到内存，就会引发问题

## 虚拟内存

虚拟内存使进程无法直接访问系统上搭载的内存，取而代之的是通过虚拟地址间接访问。

进程可以看见的是虚拟地址，系统上搭载的内存的实际地址称为物理地址

![IMG_8559.HEIC](Linux%E6%98%AF%E6%80%8E%E6%A0%B7%E5%B7%A5%E4%BD%9C%E7%9A%84%2087ed1df30fa64c79bfce432f71de4fec/IMG_8559.heic)

readelf

cat /proc/pid/maps输出地址是虚拟地址。

### 页表

通过保存在内核使用的内存中的**页表**，可以完成从虚拟页表到物理地址的转换。

在页表中，一个页面对应的数据条目称为**页表项**。

如果进程访问的地址没有关联物理内存，则在CPU上会发生**缺页中断**。

缺页中断可以中止正在执行的命令，并启动内核中的缺页中断机构处理，内核中的缺页中断机构检测到非法访问，

向进程发送**SIGSEGV**信号，接收到该信号的进程通常被强制结束运行。

```
cat segv.c
#include<stdio.h>
#include<stdlib.h>

int main(void){
    int *p = NULL;
    puts("before invalid access");
    *p = 0;
    puts("after invalid access");
    exit(EXIT_SUCCESS);
}
$ cc -o segv segv.c
$ ./segv
before invalid access
Segmentation fault (core dumped)
# 由于访问了非法的地址，所以触发了SIGSEGV信号，

```

### 为进程分配内存

读取进程可执行文件，代码段的大小(100)+数据段的大小(200)=300，在物理内存上划分300的区域，将其分配给进程，并把代码和数据复制过去。

Linux的物理内存分配使用的是更复杂的请求分页方法。

在复制完成后，创建进程的页表，并把虚拟地址映射到物理地址。

最后，从指定的地址开始运行即可。

### 在动态分配内存时

如果进程请求更多内存，内核将为其分配新的内存，创建相应的页表。

### 利用上层进行内存分配

C语言标准库中有一个名为malloc()的函数，用于获取内存，在Linux中，这个函数底层调用了mmap()函数。

图5-20待补充

mmap是以页为单位获取内存，malloc是以字节为单位获取内存，为了以字节为单位获取内存，glibc事先通过系统调用mmap向内核申请一大块内存区作为内存池。

当程序调用malloc时，会从池子里划分相应的大小，如果内存池耗尽，glibc会申请mmap申请新的内存空间

## 实验

显示进程的内存映射信息(/proc/pid/maps)

mmap()函数会通过系统调用向Linux内核请求新的内存。

system()函数会执行第1个参数中指定的命令

mmap.c

```

```

## 虚拟内存的应用

- 文件映射
- 请求分页
- 使用写时复制快速创建进程
- Swap
- 多级页面
- 标准大页

### 文件映射

使用mmap()函数，将文件的内容读取到内存中，然后将这个内存区域映射到虚拟地址空间。

通过¥memcpy()函数把数据复制到内存映射的区域，同样能更新文件内容

```
$ echo hello > testfile
$ cat filemap.c
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/mman.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <err.h>

#define BUFFER_SIZE	1000
#define ALLOC_SIZE	(100*1024*1024)

static char command[BUFFER_SIZE];
static char file_contents[BUFFER_SIZE];
static char overwrite_data[] = "HELLO";

int main(void)
{
	pid_t pid;

	pid = getpid();
	snprintf(command, BUFFER_SIZE, "cat /proc/%d/maps", pid);

	puts("*** memory map before mapping file ***");
	fflush(stdout);
	system(command);

	int fd;
	fd = open("testfile", O_RDWR);
	if (fd == -1)
		err(EXIT_FAILURE, "open() failed");

	char * file_contents;
	file_contents = mmap(NULL, ALLOC_SIZE, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
	if (file_contents == (void *) -1) {
		warn("mmap() failed");
		goto close_file;
	}

	puts("");
	printf("*** succeeded to map file: address = %p; size = 0x%x ***\\n",
		file_contents, ALLOC_SIZE);

	puts("");
	puts("*** memory map after mapping file ***");
	fflush(stdout);
	system(command);

	puts("");
	printf("*** file contents before overwrite mapped region: %s", file_contents);

	// 覆写映射区域
	memcpy(file_contents, overwrite_data, strlen(overwrite_data));

	puts("");
	printf("*** overwritten mapped region with: %s\\n", file_contents);

	if (munmap(file_contents, ALLOC_SIZE) == -1)
		warn("munmap() failed");
close_file:
	if (close(fd) == -1)
		warn("close() failed");
	exit(EXIT_SUCCESS);
}
$ cc -o filemap filemap.c
$ ./filemap
$ cat testfile
HELLO

```

### 请求分页机

在请求分页的机制中，对于虚拟地址空间的各个页面，只有在进程初次访问页面时，才会为这个页面分配内存。

页面的状态：未分配进程、已分配给进程且已分配物理内存、已分配给进程尚未分配物理内存

处理流程：

1. 进程访问入口点
2. CPU参照页表，筛选出入口点所属的页面中哪些虚拟地址未关联物理地址
3. 在CPU中引发缺页中断
4. 内核中的缺页中断机构，为步骤1中访问的页面分配物理内存，并更新其页表。
5. 回到用户模式，继续运行进程

实验：

demand-paging

```

```

结论：

- 在已获取内存但尚未访问的这段时间内，虚拟内存量比获取前增加相应数量，但物理内存不变
- 开始访问后，物理内存量会增加，虚拟内存量不变
- 在访问结束后，物理内存量比开始访问前多了相应数量

ps -eo中的vsz/rss/maj_flt/min_flt分别对应虚拟内存量/已分配物理内存量/创建进程后发生缺页中断的总次数

sar -B 1 的fault/s 表示每秒发生缺页中断次数

## 写时复制

在发起fork()系统调用时，并非把父进程的所有内存数据复制给子进程，而是仅仅复制了父进程的页表。

只发生读取操作，父进程与子进程都可以访问共享的物理页面。

当其中一方打算更改任意页面的数据时，则按照下面的流程解除共享。

1. 由于没有写入权限，所以在尝试写入时，CPU将引发缺页中断
2. CPU转换到内核模式，缺页中断机构开始运行
3. 对于被访问的页面，缺页中断机构将复制一份放到别的地方，然后将其分配给尝试写入的进程，并根据请求更新其中的内容
4. 为父进程和子进程双方更新与已解除共享的页面对应的页表项
    1. 对于执行写入的一方，将其页面项重新连接到新分配的物理页面，并赋予写入权限
    2. 对于另一方，也只需对其页表项重新赋予写入权限即可

因为物理内存不是在fork()系统调用时进行复制的，而是在尝试写入时才进行复制的，所以这个机制被称为写时复制(Copy on Write，CoW)

cow.c

```

```

## Swap

将外部存储器的一部分容量暂时当作内存使用。即在系统物理内存不足的情况下，当出现获取物理内存申请时，物理内存的一部分将被保存到外部存储器，从而空出充足的可用内存。这个用于保存页面的区域被称为交换分区。

交换分区有系统管理员在构建系统时进行设置。

换出：在没有空闲的内存，内核会将正在使用的物理内存中的一部分页面保存到交换分区。

换入：内核从交换分区中将先前换出的页面重新拿回到物理内存

换入与换出这两个处理统称为交换。

换入换出也被称为页面调入与页面调出。

需要访问外部存储器的缺页中断叫硬性页缺失

无需访问外部存储器的缺页中断叫软性页缺失

```
# 查看系统交换分区的信息
$ swapon --show

# swap这一行是交换分区的信息，
$ free
              total        used        free      shared  buff/cache   available
Mem:        4030588     1672344      155496        2816     2202748     1915148
Swap:             0           0           0

# 查看系统中是否发生了交换
$ sar -W 1
Linux 5.4.0-42-generic (VM-4-14-ubuntu) 	11/03/2022 	_x86_64_	(2 CPU)

09:33:12 PM  pswpin/s pswpout/s
09:33:13 PM      0.00      0.00
09:33:14 PM      0.00      0.00
09:33:15 PM      0.00      0.00

# 当发生交换时，如果kbsswpused%一直增加，就非常危险
$ sar -S

```

## 多级页表

x86_64架构的页表采用多级结构

sar -r ALL中的kbpgtbl字段查看页表所使用的物理内存量

## 标准大页

问题：

1. 随着进程的虚拟内存使用量增加，进程页表使用的物理内存量也会增加
2. fork()系统调用的执行速度变慢，因为写时复制，需要复制一份同样的页表

标准大页是比普通的页面更大的页，利用这种页面，能有效减少进程页表所需的内存量

在C语言中，通过mmap()函数的flags参数MAP_HUGETAB标志，可以获取标准大页

### 透明大页

当虚拟地址空间连续多个4KB页面符合特定条件时，通过透明大页机制能将它们自动转换成一个大页

```
$ cat /sys/kernel/mm/transparent_hugepage/enabled
always [madvise] never
# always表示启用
# never表示未启用
# 当设定madvise时，表示仅对有madvise()系统调用设定的内存区域启动透明大页机制

# 启用
$ sudo su
$ echo always > /sys/kernel/mm/transparent_hugepage/enabled

```

# 存储层次

## 高速缓存

高速缓存抹平寄存器与内存之间的性能差距

高速缓存是把内存上的数据缓存到高速缓存上，

高速缓存以缓存块为单位处理数据

高速缓存分层机构，分为L1 L2 L3

计算机运作流程

1. 根据指令，将数据从内存读取到寄存器
2. 基于寄存器上的数据进行运算
3. 把运算结果写入内存

### 高速缓存工作方式

### 读

从内存往寄存器里读取数据的是欧，数据先被发送到高速缓存，再被送往寄存器

### 写

寄存器重新写回到高速缓存上，会有脏标记，这些被标记的数据会在某个指定的时间点，通过后台处理写入内存

### 高速缓存不足时

高速缓存不足的时候，需要销毁一个现有的缓存块。

### 多级缓存

构成分层结构的各高速缓存分别名为L1、L2、L3

高速缓存信息可以通过`/sys/devices/system/cpu/cpu0/cache/index0` 目录下查看

```
ubuntu@VM-4-14-ubuntu:/sys/devices/system/cpu/cpu0/cache/index1$ ls -l
total 0
-r--r--r-- 1 root root 4096 Oct 25 22:27 coherency_line_size # 缓存块大小
-r--r--r-- 1 root root 4096 Oct 25 22:27 id
-r--r--r-- 1 root root 4096 Oct 25 22:27 level
-r--r--r-- 1 root root 4096 Oct 25 22:27 number_of_sets
-r--r--r-- 1 root root 4096 Oct 25 22:27 physical_line_partition
-r--r--r-- 1 root root 4096 Oct 25 22:27 shared_cpu_list # 共享该缓存的逻辑CPU列表
-r--r--r-- 1 root root 4096 Oct 25 22:27 shared_cpu_map
-r--r--r-- 1 root root 4096 Oct 25 22:26 size # 容量大小
-r--r--r-- 1 root root 4096 Oct 25 22:26 type # Data代表数据，Code代表仅缓存指令模块，Unified代表两者都能缓存
-rw-r--r-- 1 root root 4096 Oct 25 22:27 uevent
-r--r--r-- 1 root root 4096 Oct 25 22:27 ways_of_associativity

```

cache.c

```

```

## 页面缓存

与CPU访问内存的速度比起来，访问外部存储器的速度慢了几个数量级

内核中用于填补这一速度差的机构称为页面缓存。

页面缓存是把外部存储器上的文件数据缓存到内存上。

页面缓存以页为单位处理数据

## 流程

### 读取

1. 当进程读取文件时，内核并不会直接把文件数据复制到进程的内存中
2. 把数据复制到内核内存上的页面缓存区域
3. 然后把数据复制到进程的内存中

内核内存有一个管理区域，缓存了缓存文件的相关信息

当再次读取同样的数据，将直接返回页面缓存中的数据

![IMG_8559.HEIC](Linux%E6%98%AF%E6%80%8E%E6%A0%B7%E5%B7%A5%E4%BD%9C%E7%9A%84%2087ed1df30fa64c79bfce432f71de4fec/IMG_8559%201.heic)

### 写入

1. 在进程写入数据后，内核会把数据写入到页面缓存中，
2. 管理区域会把这些数据对应的条目添加一个标记
3. 其内容比外部存储器中的数据新
4. 这些被标记的页面称为脏页
5. 之后脏页中的数据将在指定时间通过内核的后台处理反射到外部存储器上，脏标记也会被去除

### 同步写入

强制断电会导致页面缓存中的脏页丢失。

可以通过open()调用打开文件时将flag参数设定为O_SYNC，这样执行write()系统调用，都会在页面缓存写入数据时，将数据同步写入外部存储器

## 读取文件的实验

```
# 创建名为testfile的文件，大小为1G
$ dd if=/dev/zero of=testfile oflag=direct bs=1M count=1K
1024+0 records in
1024+0 records out
1073741824 bytes (1.1 GB, 1.0 GiB) copied, 10.8637 s, 98.8 MB/s

$ du -h testfile
1.1G	testfile
$ free
              total        used        free      shared  buff/cache   available
Mem:        4030588     1666084      411560        2816     1952944     1913192
Swap:             0           0           0
ubuntu@VM-4-14-ubuntu:~$ time cat testfile >/dev/null

real	0m5.536s
user	0m0.007s
sys	  0m0.401s
ubuntu@VM-4-14-ubuntu:~$ free
              total        used        free      shared  buff/cache   available
Mem:        4030588     1663684      126148        2816     2240756     1912192
Swap:             0           0           0
# 被缓存住了，
ubuntu@VM-4-14-ubuntu:~$ time cat testfile >/dev/null

real	0m0.153s
user	0m0.000s
sys	0m0.134s
ubuntu@VM-4-14-ubuntu:~$ free
              total        used        free      shared  buff/cache   available
Mem:        4030588     1663404      124228        2816     2242956     1912456
Swap:             0           0           0

# kbcached字段获取页面缓存的总量
$ sar -r 1
Linux 5.4.0-42-generic (VM-4-14-ubuntu) 	11/03/2022 	_x86_64_	(2 CPU)

10:37:51 PM kbmemfree   kbavail kbmemused  %memused kbbuffers  kbcached  kbcommit   %commit  kbactive   kbinact   kbdirty
10:37:52 PM   1139244   1912708   1581652     39.24     57504    960928   3607924     89.51   1190080    422880      5784
Average:      1139168   1912651   1581724     39.24     57504    960947   3608207     89.52   1190105    422896      5803
ubuntu@VM-4-14-ubuntu:~$ time cat testfile >/dev/null

real	0m6.215s
user	0m0.000s
sys	0m0.446s
ubuntu@VM-4-14-ubuntu:~$ sar -r 1
Linux 5.4.0-42-generic (VM-4-14-ubuntu) 	11/03/2022 	_x86_64_	(2 CPU)

10:38:09 PM kbmemfree   kbavail kbmemused  %memused kbbuffers  kbcached  kbcommit   %commit  kbactive   kbinact   kbdirty
10:38:10 PM    114656   1913100   1581276     39.23     55016   1988440   3607924     89.51   1185372   1452820      5988

```

### 采集统计信息

[read-twice.sh](http://read-twice.sh/)

```
#!/bin/bash

rm -f testfile

echo "$(date): start file creation"
dd if=/dev/zero of=testfile oflag=direct bs=1M count=1K
echo "$(date): end file creation"

echo "$(date): sleep 3 seconds"
sleep 3

echo "$(date): start 1st read"
cat testfile >/dev/null
echo "$(date): end 1st read"

echo "$(date): sleep 3 seconds"
sleep 3

echo "$(date): start 2st read"
cat testfile >/dev/null

echo "$(date): end 2nd read"

rm -f testfile
```

外部存储器的I/O吞吐量，sar -d -p 1 rd_sec/s 和wr_sec/s分别表示每秒读取数据量和写入数据量，这两个数值以名为扇区的单元为单位

页面调入与页面调出 sar -B 1

### 写入文件的实验

[write.sh](http://write.sh/)

```
#!/bin/bash

rm -f testfile

echo "$(date): start write (file creation)"
dd if=/dev/zero of=testfile bs=1M count=1K
echo "$(date): end write"

rm -f testfile
```

### 页面缓存调优参数

1. 脏页回写周期可以通过sysctl中的vm.dirty_writeback_centisecs参数更改
    
    ```
    $ sysctl vm.dirty_writeback_centisecs
    vm.dirty_writeback_centisecs = 500
    # 设置为0，回写操作禁止
    # 单位里秒(1/100秒)
    
    ```
    
2. 内存不足时防止产生剧烈的回写负荷
    
    ```
    $ sysctl vm.dirty_background_ratio
    vm.dirty_background_ratio = 10
    # 当脏页占用的内存量与系统搭载的内存总量超过百分比值
    
    ```
    
3. 当脏页内存占比超过vm.dirty_ratio，将阻塞进程的写入
    
    ```
    $ sysctl vm.dirty_ratio
    vm.dirty_ratio = 20
    
    ```
    
4. 清除页面缓存
    
    ```
    $ echo 3 > /proc/sys/vm/drop_caches
    
    ```
    

# 文件系统

Linux在访问外部存储器中的数据时，通常不会直接访问，而是通过更加便捷的方式-文件系统来进行访问

## Linux的文件系统

为了分门别类地整理文件，Linux的文件系统提供了一种可以收纳其他文件的特殊文件，这种文件称为目录。

### 面向用户的访问接口

- 创建与删除文件: create()、unlink()
- 打开与关闭文件: open()、close()
- 从已打开的文件中读取数据: read()
- 往已打开的文件中写入数据: write()
- 将已打开的文件移动到指定位置: lseek()
- 除了以上这些操作以外依赖于文件系统的特殊处理: ioctl()

### 读取文件流程

1. 执行内核中的全部文件系统的通用处理，并判断作为操作对象的文件保存在哪个文件系统上
2. 调用文件系统专有的处理，并执行与请求的系统调用对应的处理。
3. 在读写数据时，调用设备驱动程序执行操作
4. 有设备驱动程序执行数据的读写操作

## 数据与元数据

- 数据：用户创建的文档、图片、视频和程序等数据内容
- 元数据：文件的名称，文件在外部存储器中的位置和文件大小等辅助信息
    - 种类：用于判断文件是保存数据的普通文件，还是目录或其他类型的文件信息
    - 时间信息：包括文件的创建时间、最后一次访问的时间，以及最后一次修改的时间
    - 权限信息：表明该文件允许哪些用户访问

## 容量限制

通过磁盘配额(quota)功能限制各种用途的文件系统容量

磁盘配额类型：

- 用户配额：限制作为文件所有者的用户的可用容量 (ext4/XFS)
- 目录配额：限制特定目录的可用容量 (ext4/XFS)
- 子卷配额：限制文件系统内名为子卷的单元的可用容量。(Btrfs)

## 文件系统不一致

在外部存储器读写文件系统的数据时被强制切段电源的情况

防止文件系统不一致的技术有很多，常用的是**日志**与**写时复制**

ext4与XFS利用的是日志，Btrfs利用的是写时复制

### 日志

日志功能在文件系统中提供一个名为**日志区域**的特殊区域。

日志区域是用户无法识别的元数据

1. 把更新所需的原子操作的概要(日志)暂时写入日志区域。
2. 基于日志区域中的内容，进行文件系统的更新

如果在更新日志记录的过程中被强制切断电源，那只需丢弃日志区域的数据即可

如果在实际执行数据更新的过程中，被强制切断电源，那只需执行一遍日志记录

### 写时复制

ext4和XFS等传统的文件系统上，文件一旦被创建，其位置原则上不会发生变化，即使更新文件内容，也只会在外部存储器的同一位置写入更新的数据。

Btrfs等利用写时复制的文件系统上，创建文件后的每一次更新处理都会把数据写入不同的位置。

如果只创建了文件时，被强制切断电源，再重启后删除新创建的文件

如果创建了文件也进行链接时，被强制切断电源，再重启后删除未处理完的数据

## 文件的种类

1. 保护用户数据的普通文件
2. 保存其他文件的目录
3. 设备文件

Linux会将自身所处的硬件系统上几乎所有的设备呈现为文件形式，因此在Linux上，设备可以通过open()、read()、write()等系统调用进行访问。

通常情况下，只有root用户可以访问设备文件

### 设备文件

以文件形式存在的设备分为两种类型：字符设备与块设备

```
# 行首字母为c的是字符设备，为b的是块设备
# 第5个字段是主设备号，第6个字段是次设备号
$ ls -l /dev
total 0
crw-r--r-- 1 root root     10, 235 11月  4 14:28 autofs
drwxr-xr-x 2 root root          80 11月  4 22:27 block
drwxr-xr-x 3 root root          60 11月  4 14:27 bus
drwxr-xr-x 2 root root        2640 11月  4 14:28 char
crw------- 1 root root      5,   1 11月  6 12:28 console

```

### 字符设备

write()系统调用：向终端输出数据

read()系统调用：向终端输入数据

- 终端
- 键盘
- 鼠标

```
$ ps -ef |grep bash
root        5794    5793  0 17:45 pts/0    00:00:02 -bash
root       15970   15969  0 19:45 pts/1    00:00:00 -bash
root       15997   15996  0 19:46 pts/0    00:00:00 bash
root       16016   16015  0 19:48 pts/0    00:00:00 -bash
$ echo "hello" > /dev/pts/0
hello
# 通过指定/dev/pts/1，可以往其他终端写入数据
echo hello > /dev/pts/1

```

### 块设备

除了能执行普通的读写操作外，还能进行随机访问，比较具有代表性的设备是HDD与SSD等外部存储器

只需像读文件一样读写块设备的数据，即可访问外部存储器中指定的数据。

直接操作块设备

- 更新分区表(利用parted命令等)
- 块设备级别的数据备份与还原(利用dd命令等)
- 创建文件系统(利用各文件系统的mkfs命令等)
- 挂载文件系统(利用mount命令等)
- fsck

```
mkfs.ext4 /dev/sdc7 # 创建一个ext4文件系统
mount /dev/sdc7 /mnt/ # 挂载文件系统，
echo "hello world" > /mnt/testfile
ls /mnt/
cat /mnt/testfile
unmount /mnt
strings -t x /dev/sdc7 # 提取字符串信息
echo "HELLO WORLD" > testfile-overwrite
dd if=testfile-overwiret of=/dev/sdc7 seek=$((0x803d000)) bs=1
# 可以通过块设备更改数据

```

- lost+found目录以及文件名testfile(元数据)
- testfile文件中的内容，字符串hello world(数据)

## 各种各样的文件系统

### 基于内存的文件系统

tmpfs是一种创建于内存上的文件系统，切断电源后消失，但是不需要访问外部存储器，所以能提高访问速度

tmpfs通常被用于**/tmp**和**/var/run**

```
$ mount |grep ^tmpfs
tmpfs on /dev/shm type tmpfs (rw,nosuid,nodev)
tmpfs on /run type tmpfs (rw,nosuid,nodev,mode=755)
tmpfs on /sys/fs/cgroup type tmpfs (ro,nosuid,nodev,noexec,mode=755)
tmpfs on /run/netns type tmpfs (rw,nosuid,nodev,mode=755)
tmpfs on /run/user/0 type tmpfs (rw,nosuid,nodev,relatime,size=77536k,mode=700)

```

挂载时，通过size选项指定最大容量，在初次访问文件系统中的区域时，以页单位申请相应大小的内存。

free中的shared字段表示实际占用的内存量

### 网络文件系统

Windows上的cifs文件系统

Linux上的nfs文件系统

### 虚拟文件系统

- procfs
    
    ```
    /proc/cpuinfo CPU的相关信息
    /prod/diskstat 外部存储器的相关信息
    /proc/meminfo 内存的相关信息
    /proc/sys 内核的各种调优参数，与sysctl命令和/etc/sysctl.conf的调优参数一一对应
    
    ```
    
    procfs用于获取系统上所有进程的信息，通常被挂载在/proc目录下
    
    ```
    $ ls /proc/$$
    arch_status  cgroup	 coredump_filter  exe	   io	      maps	 mountstats  oom_adj	    patch_state  sched	    smaps	  statm    timers
    attr	     clear_refs  cpuset		  fd	   limits     mem	 net	     oom_score	    personality  schedstat  smaps_rollup  status   timerslack_ns
    autogroup    cmdline	 cwd		  fdinfo   loginuid   mountinfo  ns	     oom_score_adj  projid_map	 sessionid  stack	  syscall  uid_map
    auxv	     comm	 environ	  gid_map  map_files  mounts	 numa_maps   pagemap	    root	 setgroups  stat	  task	   wchan
    
    # /proc/pid/maps: 进程的内存映射
    # /proc/pid/cmdline: 进程的命令行映射
    # /proc/pid/stat: 进程的状态，比如CPU时间、优先级、内存使用量
    
    ```
    
- sysfs
    
    /sys/devices 设备的相关信息
    
    ```
    $ ls -l /sys/devices
    total 0
    drwxr-xr-x  3 root root 0 Nov  6 20:21 breakpoint
    drwxr-xr-x  3 root root 0 Nov  6 20:21 isa
    drwxr-xr-x  4 root root 0 Nov  6 20:21 kprobe
    drwxr-xr-x  6 root root 0 Nov  6 20:21 LNXSYSTM:00
    drwxr-xr-x  5 root root 0 Nov  6 20:21 msr
    drwxr-xr-x 16 root root 0 Nov  6 20:13 pci0000:00
    drwxr-xr-x 10 root root 0 Nov  6 20:21 platform
    drwxr-xr-x  8 root root 0 Nov  6 20:21 pnp0
    drwxr-xr-x  3 root root 0 Nov  6 20:21 software
    drwxr-xr-x 10 root root 0 Nov  6 20:13 system
    drwxr-xr-x  3 root root 0 Nov  6 20:21 tracepoint
    drwxr-xr-x  4 root root 0 Nov  6 20:21 uprobe
    drwxr-xr-x 16 root root 0 Sep 29 13:54 virtual
    
    ```
    
    /sys/fs 各种文件系统的相关信息
    
    ```
    $ ls -l /sys/fs
    total 0
    drwxr-xr-x  2 root root   0 Nov  6 20:22 aufs
    drwx-----T  2 root root   0 Sep 29 13:54 bpf
    drwxr-xr-x  3 root root   0 Nov  6 20:22 btrfs
    drwxr-xr-x 15 root root 380 Sep 29 13:54 cgroup
    drwxr-xr-x  2 root root   0 Nov  6 20:22 ecryptfs
    drwxr-xr-x  4 root root   0 Nov  6 20:22 ext4
    drwxr-xr-x  3 root root   0 Sep 29 13:54 fuse
    drwxr-x---  2 root root   0 Sep 29 13:54 pstore
    
    ```
    
- cgroupfs
    
    用于限制单个进程或者多个进程组成的群组的资源使用量
    
    通常挂载在**/sys/fs/cgroup**下
    
    cpu：通过读写/sys/fs/cgroup/cpu目录下的文件进行控制
    
    内存：通过读写/sys/fs/cgroup/memory目录下的文件进行控制
    

# 外部存储器

## HDD的数据读写机制

HDD用磁性信息表示数据，并将这些数据记录在称为盘片的池畔上，

HDD读写数据的单位时扇区

HDD通过名为磁头的部件读写盘片上各个扇区的数据。

### 数据传输流程

1. 设备驱动程序将读写数据所需的信息传递给HDD，其中包含山区序列号、扇区数量以及访问类型(读取或写入)
2. 通过摆动次头摆臂并转动盘片，将磁头对准需要访问的扇区
3. 执行数据读写操作
4. 在执行读取的情况下，执行完HDD的读取处理就能结束数据传输

### 写入特性

- 尽量将文件中的数据存放在连续的或者相近的区域上
- 把针对连续区域的访问请求汇集到一次访问请求中
- 对于文件，尽量以顺序访问的方式访问尽可能大的数据量

## 预读

当程序访问了外部存储器上的某个区域后，很有可能继续访问紧跟在后面的区域，

预读机制正是基于这样的推测，预先读取那些接下来可能被访问的区域

## SSD

在访问SSD上的数据时，不会发生任何机械处理，只需要执行电子处理即可完成访问。
