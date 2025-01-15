---
layout: post
title: "python魔法函数\_\_sub\_\_ \_\_rsub\_\_"
date: "2019-11-25"
tags: ["python"]
slug: "2019-11-25-python-sub-rsub"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [moment 使用方法](#moment-使用方法)
* [抽离核心代码](#抽离核心代码)
    * [解析](#解析)
* [reference](#reference)

<!-- vim-markdown-toc -->

# 前言

最近使用到[Moment.js](https://momentjs.com/docs/)，发现可以加减月份。python 中好像没有这个实现，遂在 github 上找到一个库[datedelta](https://github.com/aaugustin/datedelta)

# moment 使用方法

```javascript
var moment = require("moment");
console.log(moment().format("YYYY-MM"));
console.log(
  moment()
    .add(-1, "months")
    .format("YYYY-MM")
);
```

输出结果：

```
❯ node moment.js
2019-11
2019-10
```

# 抽离核心代码

```python
import datetime


class datedelta:

    __slots__ = ['_years', '_months', '_days']

    def __init__(self, *, years=0, months=0, days=0):
        int_years = int(years)
        int_months = int(months)
        int_days = int(days)

        self._years = int_years
        self._months = int_months
        self._days = int_days

    def __rsub__(self, other):
        if isinstance(other, datetime.date):
            month = other.month
            year = other.year

            month -= self._months
            dyear, month0 = divmod(month - 1, 12)
            year += dyear
            month = month0 + 1
            result = other.replace(year, month, 1)

            return result


MONTH = datedelta(months=1)

if __name__ == '__main__':
    print(datetime.date(2016, 3, 1) - MONTH)
    # 2016-02-01
```

输出结果：
`2016-02-01`

## 解析

python 有很多魔法方法，比如加减乘除、取余取模、大于小于等于... 感兴趣的可以看[官方文档](https://docs.python.org/3/library/operator.htm://docs.python.org/3/library/operator.html)

值得一提的是，python 不仅提供了这些魔法方法，还提供部分反向操作符(+, -, \*, /, %, divmod(), pow(), \*\*, «, », &, ^, |)。

如果 x-y，x 没有实现**sub**方法，那就要看 y 有没有实现**rsub**，如果 y 有实现这个方法，就可以会调用 y-x。

[datetime.date](https://github.com/python/cpython/blob/master/Lib/datetime.py#L651)的\_\_sub\_\_，只支持 timedelta 类型才能减。

所以当 datetime.date(2016, 3, 1)去减 datedelta(months=1)时，会反向调用 datedelta 的\_\_rsub\_\_，来减去一个月。

有时间下次整理下，python 的魔法方法

# reference

- https://github.com/aaugustin/datedelta
