---
layout: post
title: "Fullstackopen 2020 Part1 笔记"
date: "2021-02-05"
tags: ["react"]
slug: "2021-02-05-fullstackopen-2020-one"
---

<!-- vim-markdown-toc Redcarpet -->

* [Part 1](#part-1)
    * [React 函数组件](#react-函数组件)
    * [state hook](#state-hook)
    * [debug](#debug)

<!-- vim-markdown-toc -->

# Part 1

## React 函数组件

```jsx
const Hello = (props) => {
  return (
    <div>
      <p>Hello {props.name}</p>
    </div>
  );
};
<Hello name="Maya" age={26 + 10} />;
```

## state hook

当状态修改函数如(setCounter) 被调用时， React 会重新渲染该组件

```jsx
import React, { useState } from "react";
import ReactDOM from "react-dom";

const App = () => {
  const [counter, setCounter] = useState(0);

  return (
    <div>
      <div>{counter}</div>
      <button onClick={() => setCounter(counter + 1)}>plus</button>
      <button onClick={() => setCounter(0)}>zero</button>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
```

## debug

- 在控制台打断点，然后 debug
- 安装[React Developer Tools chrome 插件](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
