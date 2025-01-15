---
layout: post
title: "django custom response"
tags: django custom response
slug: "2019-09-26-django-custom-response"
---

<!-- vim-markdown-toc GFM -->

* [自定义 django 的 response](#自定义-django-的-response)
* [实现原理](#实现原理)
        * [How to use](#how-to-use)
* [用到的地方](#用到的地方)
    * [普通返回](#普通返回)
    * [分页返回](#分页返回)
    * [鉴权返回](#鉴权返回)

<!-- vim-markdown-toc -->

# 自定义 django 的 response

# 实现原理

```python
from rest_framework.status import HTTP_200_OK
from rest_framework.response import Response


class AttrDict(dict):
    # 将dict的key作为class的属性,可以直接通过.获取熟悉
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.__dict__ = self


class CustomResponse:

    def __init__(self, *args, **kwargs):
        self.data = AttrDict()

    def success(self):
        self.data.error = False
        return Response(data=self.data, status=HTTP_200_OK)

    def fail(self):
        self.data.error = True
        return Response(data=self.data, status=HTTP_200_OK)
```

### How to use

```python
In :attr = AttrDict()

In :attr.foo = 1

In :attr.__dict__
Out:{'foo': 1}

In :attr['foo']
Out:1
```

# 用到的地方

- view 处理完返回
- 分页后返回数据
- 自定义权限

## 普通返回

- drf api_view

  ```python
  @api_view(['GET'])
  def test(request):
   email = request.email
   if email:
       cache.delete(email)
       c = CustomResponse()
       c.data.token = ''
       return c.success()

  ```

- drf APIView

  ```python
  class TestAPIView(APIView):
    serializer_class = TestSerializer

    def get(self, request, *args, **kwargs):
        c = CustomResponse()
        c.data.message = 'test'
        return c.success()

  ```

  drf ModelViewSet 也是同理,这里就不说了

## 分页返回

自定义分页，[官方文档](https://www.django-rest-framework.org/api-guide/pagination/#custom-pagination-styles)

```python
from rest_framework import pagination

from response import CustomResponse


class CustomPagination(pagination.PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'

    def get_paginated_response(self, data):
        c = CustomResponse()
        c.data.data = {'data': data, 'total': self.page.paginator.count}
        return c.success()
```

## 鉴权返回

自定义权限，[官方文档](https://www.django-rest-framework.org/api-guide/permissions/#custom-permissions)

```python
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import APIException
from rest_framework.status import HTTP_200_OK


class IsLogin(BasePermission):
    """
    Allows access only to authenticated users.
    """

    def has_permission(self, request, view):
        if request.user:
            return True
        raise NeedLogin()


class NeedLogin(APIException):
    status_code = HTTP_200_OK
    default_detail = {'error': True, 'message': '请先登录'}
    default_code = 'not_authenticated'

```

这个代码片段没有`CustomResponse`, 只能通过使用返回异常, 来保持返回的 response 和之前的返回的格式一致
