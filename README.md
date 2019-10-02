# MotX

一个基于中介者模式实现的轻量级应用状态传递和存储的工具，并为多进程或封闭模块之间的通讯问题提供高效的解决方案

## Start

`npm i motx --save`

内置 TypeScript 声明文件

```typescript

    // #############################################
    // 以下代码跑在worker进程

    import MotX from 'motx'
    const motx = new MotX({
        // 使用存储状态前需先定义存储字段及初始状态
        store: {
            bean: { count: 1 }
        },
        // 注册频道
        channels:[
            // 用户通知更改bean数量
            'change-count'
        ]
    })

    // 订阅
    motx.subscribe('change-count', (count)=>{
        // 更新store状态
        motx.setState('bean', {count})
    })

    // 默认初始同步执行一次，以及bean状态变更后自动异步执行，同步多次变更状态会自动节流
    motx.autorun(({bean})=>{
        console.log(bean.count)
    })

    // 发布
    motx.publish('change-count', 2)

    console.log(motx.getState('bean').count) // 2

    // 接收来自master进程的消息并发布相应消息
    process.on('message', (message)=>{
        motx.onReceive(message)
    })

    //#################################################
    // 以下代码跑在master进程

    import MotX from 'motx'
    const worker = ... // worker handler
    const motx = new MotX({
        pipes:{
            // 定义 worker 数据传送管道
            worker(jsonStringifyed) {
                // 向 worker process 发送motx消息json字符串
                worker.send(jsonStringifyed)
            }
        }
    })
    // 通过 worker 管道将消息传送到 worker 进程
    motx.pipe('worker').publish('change-count', 3)


```

## 基础概念

### Mediator

MotX 基于中介者模式实现消息发布和订阅机制，实现组件间松耦合通讯，订阅和发布都基于特定频道(channel), `publish(channel, data1, data2, ...)` `subscribe(channel, data1, data2, ...)`

为了更好地理解与维护这些 channel，MotX 限制使用 channel 前须先注册

### Store & State

MotX 支持缓存全局应用状态，store 用于存储状态树数据，state 是 store 某字段当前状态快照，默认进行对象引用隔离

通过 getState 方法获得指定字段的 state，通过 setState 更改 store 的存储状态

订阅发布的数据不会流入 store，默认也会进行对象引用隔离

### Hooks

MotX 作为 '中介'，提供三个可以改变发布与更新缓存状态默认流程的钩子，让你可以灵活拓展 '中介' 的能力

### Pipe

Motx 通过 pipe 联通多个进程或多个隔离模块，实现多进程或多隔离模块之间相互发布消息，pipe 需要你基于具体应用场景去定义如何传送 motx 消息字符串数据

同一全局上下文含有 name 属性的 MotX 实例可使用 name 作为 pipe 通道名，无需在 MotXOption.pipes 定义

## API

### MotXOptions

```typescript
MotXOptions {
    store: Store;
    hooks?: Hooks;
    pipes?: {
        [pipeName: string]: Pipe;
    };
    isolate?: boolean;
    channels?: string[];
}
```

-   `store` 定义存储状态字段和初始数据

    > 初始化后不可动态创建字段，也不支持赋值 undefined

    > `store` 负责存储在 motx 内部的状态数据，只能通过 `setState` 和 `publish` 变更消息来触发 `store` 的变更

-   `isolate` 定义数据传输过程是否需要隔离引用
-   `hooks`: 全局钩子
    -   `willPublish?(channel: string, args: any[]): boolean;` 发布前执行，返回 false 可拦截发布
    -   `didPublish?(channel: string, args: any[]): void` 发布之后执行
    -   `willSetState?(fieldName: string, newState: State, isolate: boolean, store: Store): State | undefined;` 更改 store 数据前执行，返回非 undefined 数据可作为变更数据，返回 undefined 则停止更改数据
    -   `didSetState?(fieldName: string, newState: State, isolate: boolean, store?: Store): void` 更改 store 数据后执行
-   `pipes:{[pipeName: string]: (jsonStringifyed: string): void}`: 定义向其他进程或隔离模块传送数据的方式
    > 发布的 channel 前加上 pipeName# 即可向该管道传送经过`JSON.stringify` 的 publish 相关数据，使 publish 动作应用在目标进程或隔离模块
    >
    > 同一全局上下文不需要定义，默认使用 MotXOption.name 作为 pipeName
-   `channels: string[]` 注册频道

### Methods

-   `publish(channel: string, ...args: any[]): void`
    > 发布消息，传递数据，支持多个参数

-   `subscribe(channel: string, handler: Handler): void`
    > 订阅消息

-   `unsubscribe(channel: string, handler?: Handler): void`
    > 取消订阅消息

-   `getState(fieldName: string): State`
    > 获得指定字段的当前状态数据

-   `setState(fieldName: string, newState: State, silent?: boolean): void`
    > 变更 `store` 状态，支持 `silent` 模式，为 true 时将不会自动发布字段变更消息

-    `autorun(handler: (rootState: {  [key: string]: any; }, isInitRun: boolean) => {}): RemoveAutorunFunction`
- 
    > 初始同步执行传入的handler，依赖的state变更后异步执行

-   `pipe(rule: string): Pipe`
    > 返回管道对象，支持publish和setState
    >
    > 通过MotXOption.pipes定义的发送方式，向目标进程发送publish或setState动作相关json字符串

-   `onReceive`
    > 当前进程或隔离模块接收到其他进程或隔离模块通过管道发送来的数据后，需要执行该方法并将 json 字符串数据传入即可执行对应publish或setState动作

-   `dispose()`
    > 注销MotX实例
