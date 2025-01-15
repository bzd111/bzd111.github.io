---
layout: post
title: "react state管理"
date: "2021-07-19"
tags: ["react"]
slug: "2021-07-19-react-hooks"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [单组件使用](#单组件使用)
    * [hooks](#hooks)
        * [useState](#usestate)
        * [useEffect](#useeffect)
            * [hooks on Class Component](#hooks-on-class-component)
        * [useRef](#useref)
        * [useReducer](#usereducer)
* [多组件使用](#多组件使用)
    * [Context](#context)
    * [Mobx](#mobx)
    * [Redux](#redux)
* [小结](#小结)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

react 状态管理

# 单组件使用

## hooks

### useState

管理 state

`const [count, setCount] = useState(0);`

useState(value)设置初始值 value，count 是 state 的值所对应的变量，setCount(value)用来修改 count 为 value

### useEffect

渲染更新

当 count 变化时，就会调用 useEffect 进行渲染，如果不加条件，就是每次渲染都会更新

useEffect 相当于 componentDidMount，componentDidUpdate 和 componentWillUnmount 三个生命周期的组合。

```js
const [count, setCount] = useState(0);

useEffect(() => {
  // do something...
}, [count]);
```

#### hooks on Class Component

componentDidMount

```js
import React, { useState, useEffect } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCount(1);
    }, 3000);
  }, []);

  return (
    <div className="App">
      <h1>{count}</h1>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

componentWillUnmount() on return a function

```js
import React, { useState, useEffect } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCount(1);
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="App">
      <h1>{count}</h1>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

when a count value is changed.

```js
import React, { useState, useEffect } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCount(1);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [count]);

  return (
    <div className="App">
      <h1>{count}</h1>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

### useRef

返回一个可变的 ref 对象，在整个生命周期内保持不变

`const inputRef = useRef();`

### useReducer

接受一个 reduce、initialArg、init，返回 state 和 dispatch，适合复杂的赋值情况，有点类似 redux

`const [state, dispatch] = useReducer(reducer, initialArg, init);`

```js
const initialState = { count: 0 };

function reducer(state, action) {
  switch (action.type) {
    case "increment":
      return { count: state.count + 1 };
    case "decrement":
      return { count: state.count - 1 };
    default:
      throw new Error();
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <div>
      Count: {state.count}
      <button onClick={() => dispatch({ type: "decrement" })}>-</button>
      <button onClick={() => dispatch({ type: "increment" })}>+</button>
    <div/>
  );
}
```

# 多组件使用

## Context

在组件树中，传递相同的数据

定义：`const MyContext = React.createContext(defaultValue);`
使用：

```
<ThemeContext.Provider value="dark">
    <Toolbar />
</ThemeContext.Provider>

function Toolbar() {
  return (
    <div>
      <ThemedButton />
    </div>
  );
}

class ThemedButton extends React.Component {
  static contextType = ThemeContext;
  render() {
    return <Button theme={this.context} />;
  }
}
```

## Mobx

```js
import React from "react";
import { useObserver, useLocalStore } from "mobx-react";
import ReactDOM from "react-dom";

const App = () => {
  const store = useLocalStore(() => ({
    count: 0,
    add() {
      console.log(123);
      this.count++;
    },
  }));
  // const localStore = useLocalStore(() => store);
  return useObserver(() => <button onClick={store.add}>{store.count}</button>);
};

ReactDOM.render(<App />, document.getElementById("container"));
```

## Redux

```js
import React from "react";
import ReactDOM from "react-dom";
import { createStore } from "redux";

const counterReducer = (state = 0, action) => {
  switch (action.type) {
    case "INCREMENT":
      return state + 1;
    case "DECREMENT":
      return state - 1;
    case "ZERO":
      return 0;
    default:
      return state;
  }
};

const store = createStore(counterReducer);

const App = () => {
  return (
    <div>
      <div>{store.getState()}</div>
      <button onClick={(e) => store.dispatch({ type: "INCREMENT" })}>
        plus
      </button>
      <button onClick={(e) => store.dispatch({ type: "DECREMENT" })}>
        minus
      </button>
      <button onClick={(e) => store.dispatch({ type: "ZERO" })}>zero</button>
    </div>
  );
};

const renderApp = () => {
  ReactDOM.render(<App />, document.getElementById("root"));
};

renderApp();
store.subscribe(renderApp);
```

# 小结

从单组件的复制组件：
react hooks -> react context -> mobx -> redux

单组件用 hooks 即可，多组件看复杂情况使用 context、mbox、redux

# Reference

- https://www.benawad.com/how-to-manage-state-in-reactjs/
- https://raoenhui.github.io/react/2019/11/07/hooksSetinterval/index.html
- https://zh-hans.reactjs.org/docs/hooks-intro.html
- https://www.freecodecamp.org/news/learn-react-hooks-by-building-a-paint-app/
- https://zh-hans.reactjs.org/docs/context.html
- https://mobx.js.org/README.html
- https://redux.js.org/
- https://reactgo.com/settimeout-in-react-hooks/
