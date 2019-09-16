# MotX

一个基于订阅发布模式实现的轻量级的状态共享与传递工具，轻松解决数据状态存储与变更，以及多进程或隔离模块之间的通讯问题

## Start

`npm i motx --save`

```javascript
    // #############################################
    // run in worker process
    import MotX from 'motx'
    const motx = new MotX({
        store: {
            bean: { count: 1 }
        }
    })

    motx.subscribe('bean:change', (newState)=>{
        console.log(newState.count) // 2
    })
    motx.subscribe('change-count', (count)=>{
        // Use 'set' action to change store.bean.count
        // and automatically published channel 'bean:change'
        motx.publish('set:bean', {count})
    })
    motx.publish('change-count', 2)
    console.log(motx.getState('bean').count) // 2

    // to receive publish actions from master process
    process.on('message', (message)=>{
        motx.onReceive(message)
    })

    //#################################################
    // run in master process
    // send message to worker
    import MotX from 'motx'
    const worker = ... // worker handler
    const motx = new MotX({
        store: {},
        pipes:{
            worker(jsonStringifyed) {
                worker.send(jsonStringifyed)
            }
        }
    })
    // 'pipeName#channel' or 'pipeName#set:bean'
    // the publish action will apply to the motx instance in worker process
    motx.publish('worker#change-count')

```

## 基础概念

### Mediator

### Store & State

### Pipe

## API

### Options

- `[store]` 定义存储状态字段和初始数据
  > 初始化后不可动态创建字段，也不支持赋值 undefined
  
  >  `store` 负责存储在motx内部的状态数据，只能通过 `setState` 和 `publish` 变更消息来触发 `store` 的变更
  
- `[isolate]`  定义数据传输过程是否需要隔离引用
- `[hooks]`: 全局钩子 
  - `[willPublish]` 发布前执行，返回 false 可拦截发布
  - `[willSetState]` 更改store数据前执行，返回非undefined数据可作为变更数据，返回 undefined 则停止更改数据
  - `[didSetState]` 更改store数据后执行
- `[pipes]`: 定义向其他进程或隔离模块传送数据的方式
  > 发布的 channel 前加上 pipeName# 即可向该管道传送经过`JSON.stringify` 的 publish 相关数据，使publish动作应用在目标进程或隔离模块
  >


### Methods

- `publish(channel: string, ...args: any[]): void`
  > 发布消息，传递数据，支持多个参数

  > 支持变更 `store` 的消息，目前仅支持 `set` 和 `merge`
  > - `set` 设置指定字段的值，如：`motx.publish('set:userInfo', {username: 'tom'})`
  > - `merge` 使用assign的方式混合新旧对象，如：`motx.publish('set:userInfo', {age: 16})`

  > 触发store变更后，会自动发布变更字段消息，格式为变更字段名后面接`:change`, 如 `userInfo:change`

  > 支持向其他进程发布消息，如：`set:userInfo -> worker`
- `subscribe(channel: string, handler: Handler): void`
  > 订阅消息
- `getState(fieldName: string): State`
  > 获得指定字段的当前状态数据
- `setState(fieldName: string, newState: State, silent?: boolean): void`
  > 变更 `store` 状态，支持 `silent` 模式，为true时将不会自动发布字段变更消息
- `unsubscribe(channel: string, handler?: Handler): void`
  > 取消订阅消息
- `onReceive`
  > 当前进程或隔离模块接收到其他进程或隔离模块发送来的数据后，需要执行该方法并将json字符串数据传入
- `dispose()`
  > 注销内置对象，释放内存

## todo

- 支持全局发布
- 状态变更消息，需要带上旧数据
- `set:userInfo > worker`
- `set:userInfo > all`
- 支持自定义动作
