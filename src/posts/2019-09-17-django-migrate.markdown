---
layout: post
title: "django migrate操作"
date: 2019-09-19 20:49:52 +0800
tags: ["django", "migrate", "migration"]
slug: "2019-09-19-django-migrate"
---

# django makemigration migrate tips

### 生成 migrate 文件

一般命令：`python manage.py makemigrations`

加上 app：`python manage.py makemigrations app`

加上 name: `python manage.py makemigrations app -n 0001_test.py`

### 应用 migrate 文件

一般命令：`python manage.py migrate`

加上 app：`python manage.py migrate app`

取消应用 migrate 文件

查看所有应用：`python manage.py showmigrations app`

取消应用：`python manage.py migrate app migrate_name`

取消所有应用：`python manage.py migrate zero`
⚠️ 不推荐使用，会清除数据库的记录

### 举个 🌰：

某个 app 下面有 5 个应用

`python manage.py showmigrations app`运行此命令,获取以下内容

```
app
 [X] 0001_initial
 [X] 0002_auto_20190722_0230
 [X] 0003_auto_20190723_0231
 [X] 0004_auto_20190724_0232
 [X] 0005_auto_20190725_0233
```

如果只想要保留第二个 migrate,运行以下命令即可。

```
python manage.py migrate app 0001_initial
```

如果想把 0002-0005 的 migrate，合并成一个：

```
python manage.py migrate app 0001_initial
到对应的目录删除对应的migrate文件
python manage.py makemigrations app_name migrate_anme
python manage.py migrate app_name
```
