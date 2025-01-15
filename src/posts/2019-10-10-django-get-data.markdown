---
layout: post
title: "django获取数据"
date: 2019-10-10 20:49:52 +0800
tags: ["django"]
slug: "2019-10-10-django-get-data"
---

<!-- vim-markdown-toc Redcarpet -->

* [django](#django)
    * [function view 使用 get method](#function-view-使用-get-method)
        * [一般风格](#一般风格)
        * [rest 风格](#rest-风格)
    * [class-based view 使用 get method](#class-based-view-使用-get-method)
        * [一般风格](#一般风格)
        * [rest 风格](#rest-风格)
    * [function view 使用 post method](#function-view-使用-post-method)
    * [class view 使用 post、put method](#class-view-使用-post、put-method)
        * [处理 post method](#处理-post-method)
        * [处理 put method](#处理-put-method)
* [总结](#总结)
* [注意：](#注意：)

<!-- vim-markdown-toc -->

# django

首先根据 view 类型分成两类，function view、class-based view

再根据 http method 分成两类，get，put post delete

所以两两分组就会有 4 中情况。其实大同小异。

这里统一使用 Django REST framework 提供 api 服务

## function view 使用 get method

### 一般风格

```python
# url
http://localhost:8000/api/test?tags=1

# urls.py
path('test', views.test)

# views.py
# 需要从request.GET中获取，request.GET的类型是QueryDict
@api_view(['GET'])
def test(request):
    return Response(data={'tags': request.GET.get('tags')}, status=HTTP_200_OK)
```

### rest 风格

```python
# url
http://localhost:8000/api/test/1/

# urls.py
path('test/<tags>/', views.test)

# views.py
# 需要将url中的参数传入到function中
@api_view(['GET'])
def test(request, tags):
    return Response(data={'tags': tags}, status=HTTP_200_OK)
```

## class-based view 使用 get method

### 一般风格

```python
# url
http://localhost:8000/api/test?tags=1

# urls.py
path('test', views.TestAPIView.as_view()),

# views.py
# 需要从request.GET中获取，request.GET的类型是QueryDict
class TestAPIView(generics.RetrieveUpdateAPIView):
    def get(self, request, *args, **kwargs):
        return Response(data={'tags': request.GET.get('tags')},
                        status=HTTP_200_OK)
```

### rest 风格

```python
# url
http://localhost:8000/api/test/1/

# urls.py
path('test/<tags>/', views.TestAPIView.as_view())

# views.py
# 需要从kwargs中获取传入的参数
class TestAPIView(generics.RetrieveUpdateAPIView):
    def get(self, request, *args, **kwargs):
        return Response(data={'tags': kwargs.get('tags')},
                        status=HTTP_200_OK)
```

## function view 使用 post method

```python
# 验证
http :8000/api/test/ tags=10

# urls.py
path('test/', views.test)

# views.py
# 需要使用json将byte字符串loads成字典
@api_view(['POST'])
def test(request):
    body = json.loads(request.body)
    return Response(data={'tags': body.get('tags')},
                    status=HTTP_200_OK)
```

## class view 使用 post、put method

### 处理 post method

```python
# 验证
http :8000/api/test/ tags=11

# urls.py
path('test/', views.TestAPIView.as_view()),

# views.py
# 方法和上面相同
class TestAPIView(generics.CreateAPIView):
    def post(self, request, *args, **kwargs):
        body = json.loads(request.body)
        return Response(data={'tags': body.get('tags', 1)}, status=HTTP_200_OK)

```

### 处理 put method

```python
# 验证
http PUT :8000/api/test/1/ tags=11

# urls.py
path('test/<tags>/', views.TestAPIView.as_view())

# views.py
# 这里需要把put方法单独提出来说一下，因为修改时要带着id，去数据库获取数据去修改
class TestAPIView(generics.UpdateAPIView):
    def put(self, request, *args, **kwargs):
        pk = kwargs.get('tags')
        # 这个是要修改唯一标识
        # 可以通过kwargs获取到
        body = json.loads(request.body)
        return Response(data={'tags': body.get('tags', 1)}, status=HTTP_200_OK)
```

# 总结

function view get method 一般接口需要从 request.GET 获取数据
rest 风格需要把参数放到 url，并且把参数放到 function 中，

function view post method，需要从 request.body 中获取数据，

class view get method，一般接口和上面相同，需要从 request.GET 获取数据
rest 风格需要从 kwargs 中获取

class view post method 需要从 request.body 中到数据，如果是 put、delete method，需要传入唯一标识，
可以从 kwargs 中获取数据，并且要在 url 中声明

# 注意：

验证中使用的 http 是[httpie 工具](https://httpie.org/)
