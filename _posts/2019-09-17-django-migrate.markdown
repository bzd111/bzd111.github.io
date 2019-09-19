---
layout: post
title:  "django migrate操作"
date:   2019-09-19 20:49:52 +0800
categories: django makemigration migrate
---

# django makemigration migrate tips


### 生成migrate文件
一般命令：`python manage.py makemigrations`
加上app：`python manage.py makemigrations app `
加上name: `python manage.py makemigrations app -n 0001_test.py`

### 应用migrate文件
一般命令：`python manage.py migrate`
加上app：`python manage.py migrate app `

取消应用migrate文件
查看所有应用：`python manage.py showmigrations app `
取消应用：`python manage.py migrate app migrate_name`

举个🌰：
某个app下面有2个应用
`python manage.py showmigrations app `运行此命令,获取一下内容
```
app
 [X] 0001_initial
 [X] 0002_auto_20190722_0230
```
如果想要去掉第二个引用,运行一下的命令即可。
```
python manage.py migrate app 0001_initial
```