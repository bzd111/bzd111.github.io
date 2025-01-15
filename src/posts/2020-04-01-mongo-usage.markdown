---
layout: post
title: "go mongo驱动使用"
date: "2020-04-01"
tags: ["mongodb"]
slug: "2020-04-01-mongo-usage"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [安装](#安装)
    * [安装 mongo](#安装-mongo)
    * [安装驱动](#安装驱动)
* [使用](#使用)
    * [建立连接](#建立连接)
    * [创建集合](#创建集合)
    * [CURD 操作](#curd-操作)
        * [插入数据](#插入数据)
        * [查询数据](#查询数据)
            * [查询所有](#查询所有)
            * [查询一条](#查询一条)
        * [更新数据](#更新数据)
* [总结](#总结)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

这几天看了大佬写的代码，用的是 mgo，看了下 github 已经不维护了。随即搜索了下 github，发现 mongodb 官方的驱动，还是挺好用的，这里稍微简单介绍下

# 安装

## 安装 mongo

```
brew tap mongodb/brew
brew install mongodb-community@4.2
```

## 安装驱动

```
go get go.mongodb.org/mongo-driver/mongo
```

# 使用

先创建 client，然后创建 collection，然后就可以操作数据库了

## 建立连接

```Golang
ctx, _ := context.WithTimeout(context.Background(), 10*time.Second)
client, _ := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://localhost:27017"))
```

## 创建集合

```Golang
collection，_:= client.Database("testing").Collection("persons")
```

## CURD 操作

这里我们使用一个 Person 结构体

```golang
// 这里的bson是用来指定mongo里的存的字段名，如果不加这个tag，就是结构体字段的小写单词
type Person struct {
    Name string `json:"name" bson:"name"`
    Age  int    `json:"age" bson:"age"`
}
```

### 插入数据

```golang
p1 := Person{
    Name: "zhangsan",
    Age:  10,
}
p2 := Person{
    Name: "lisi",
    Age:  20,
}
p3 := Person{
    Name: "wangwu",
    Age:  30,
}
persons := []interface{}{p1, p2, p3}
ctx, _ := context.WithTimeout(context.Background(), 2*time.Second)
collection.InsertMany(ctx, persons)
```

### 查询数据

#### 查询所有

```golang
var persons []Person
ctx, _ := context.WithTimeout(context.Background(), 2*time.Second)
// filter is bson.M
cur, err := c.clo.Find(ctx, bson.M{}) // 这里使用key为string类型，vaule为interface{}的空字典 map[string]interface{}
if err != nil {
    log.Fatal(err)
}
defer cur.Close(ctx)
for cur.Next(ctx) {
    // person object
    var result Person
    fmt.Println(cur)

    err := cur.Decode(&result)
    if err != nil {
        log.Fatal(err)
    }
    // add person to list
    persons = append(persons, result)
}
if err := cur.Err(); err != nil {
    log.Fatal(err)
}
```

#### 查询一条

```golang
filter := bson.M{"name": "lisi"} //这里的查询条件是搜索name为lisi的人，
ctx, _ := context.WithTimeout(context.Background(), 5*time.Second)
// decode data to person
_ = c.clo.FindOne(ctx, filter).Decode(&person) // 这里只会查一个结果
fmt.Println("person name:", person.Name)
fmt.Println("person age:", person.Age)
```

### 更新数据

filter 是用来找到需要更新的 doc，然后使用 update 去更新，都可以使用聚合函数去查找和更新

```golang
// filter name zhangsan
filter := bson.M{"name": "zhangsan"} // 这里的查询条件是搜索name为zhangsan的人，
// update set age 100
update := bson.M{"$set": bson.M{"age": 100}} // 然后设置age为100，

ctx, _ := context.WithTimeout(context.Background(), 5*time.Second)
_, err := c.clo.UpdateOne(ctx, filter, update)
if err != nil {
    log.Fatal(err)
}
```

# 总结

总的用来，感觉还不错，

# Reference

- https://github.com/mongodb/mongo-go-driver#usage
- https://docs.mongodb.com/manual/crud/
