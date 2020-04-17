import EventEmitter from 'eventemitter3'

const MotXInstances: { [key: string]: MotX } = {}

let AutoRunTarget: Function | null = null

export default class MotX {
    protected name: string = ''
    protected event: EventEmitter
    protected store: Store
    protected hooks: Hooks
    protected pipes: {
        [pipeName: string]: (jsonStringifyed: string) => void
    }
    protected isolate: boolean
    protected channels: string[]
    protected actions: {
        [actionName: string]: (target: string, ...args: any[]) => void
    }

    /**
     * constructor
     * @param options {store, hooks, pipes, isolate, channels, actions}
     */
    constructor(options: MotXOptions) {
        const {
            name,
            store = {},
            hooks = {},
            isolate = true,
            pipes = {},
            channels = [],
            actions = {}
        } = options

        if (name) {
            MotXInstances[name] = this
            this.name = name
        }

        this.event = new EventEmitter()
        this.isolate = isolate
        this.hooks = {
            willPublish: (channel: string, args: any[]) => true,
            didPublish: (channel: string, args: any[]) => {},
            willSetState: (
                fieldName: string,
                newState: State,
                isolate: boolean,
                store: Store
            ) => newState,
            didSetState: (
                fieldName: string,
                newState: State,
                isolate: boolean,
                store: Store
            ) => {},
            ...hooks
        }
        this.channels = channels.map((item) => {
            item = item.trim()
            if (CHANNEL_VALID_REG.test(item)) {
                return item
            } else {
                throw new Error(INVALID_REGISTER_CHANNEL_ERR_MSG(item))
            }
        })

        this.pipes = pipes
        this.actions = actions

        this.store = new Store(JSON.parse(JSON.stringify(store)), this.isolate)
    }

    public pipe(rule: string): Pipe {
        const handlers: Function[] = this.filterPipes(rule)
        return new Pipe(handlers)
    }

    public onReceive(jsonStringifyed: string) {
        const { channel, args } = JSON.parse(jsonStringifyed)
        this.publish(channel, ...args)
    }

    public autorun(
        handler: (rootState: { [key: string]: any }, isInitRun: boolean) => {}
    ): RemoveAutorunFunction {
        AutoRunTarget = handler
        handler(this.store.reactData, true)
        AutoRunTarget = null
        return () => {
            this.store.removeAutorun(handler)
        }
    }

    public getState(fieldName: string, isolate?: boolean): State {
        return this.store.getState(fieldName, isolate)
    }

    public setState(
        fieldName: string,
        newState: State,
        isolate?: boolean,
        silent?: boolean
    ): void {
        if (typeof newState === 'undefined') {
            throw new Error(NEW_STATE_UNDEFINED_ERR_MSG)
        }
        const newStat: State | undefined =
            this.hooks.willSetState &&
            this.hooks.willSetState.call(
                this,
                fieldName,
                newState,
                this.isolate,
                this.store
            )

        if (typeof newStat !== 'undefined') {
            const oldState = this.store.getState(fieldName, isolate)

            this.store.setState(fieldName, newStat, isolate, silent)

            if (!silent) {
                this.event.emit(
                    this.stringifyChannel({
                        target: fieldName,
                        event: 'change'
                    }),
                    this.store.ifClone(newStat, isolate),
                    oldState
                )
            }

            this.hooks.didSetState &&
                this.hooks.didSetState.call(
                    this,
                    fieldName,
                    newStat,
                    this.isolate,
                    this.store
                )
        }
    }

    public publish(channel: string, ...args: any[]) {
        if (
            this.hooks.willPublish &&
            !!this.hooks.willPublish.call(this, channel, args)
        ) {
            const parsed = this.parseChannel(channel)
            if (parsed.target && parsed.action) {
                if (parsed.action === 'setState') {
                    this.setState(parsed.target, args[0])
                } else {
                    if (!this.actions[parsed.action]) {
                        throw new Error(UNKNOWN_ACTION_MSG(parsed.action))
                    }
                    this.actions[parsed.action].call(
                        this,
                        parsed.target,
                        ...args
                    )
                }
            } else if (this.channels.includes(channel)) {
                this.event.emit(channel, ...args)
            } else {
                throw new Error(UNKNOWN_CHANNEL_MSG(this.name, channel))
            }
            this.hooks.didPublish &&
                this.hooks.didPublish.call(this, channel, args)
        }
    }

    public subscribe(channel: string, handler: (...args: any[]) => void) {
        if (
            this.channels.includes(channel) ||
            EVENT_CHANNEL_VALID_REG.test(channel)
        ) {
            this.event.on(channel, handler)
        } else {
            throw new Error(UNKNOWN_CHANNEL_MSG(this.name, channel))
        }
    }

    public unsubscribe(channel: string, handler?: (...args: any[]) => void) {
        if (
            this.channels.includes(channel) ||
            EVENT_CHANNEL_VALID_REG.test(channel)
        ) {
            this.event.off(channel, handler)
        } else {
            throw new Error(UNKNOWN_CHANNEL_MSG(this.name, channel))
        }
    }

    public dispose() {
        ;(this.store as any) = null
        this.event.removeAllListeners()
        ;(this.event as any) = null
        if (this.name) {
            delete MotXInstances[this.name]
        }
    }

    protected stringifyChannel({ action, target, event, channel }: any) {
        if (action) {
            return `${action}:${target}`
        } else if (event) {
            return `${target}@${event}`
        } else {
            return channel
        }
    }

    protected parseChannel(cnn: string) {
        const [matched, hasAction, action, target]: string[] =
            CHANNEL_PARSE_REG.exec(cnn) || []
        if (!matched) {
            throw new Error(`[MotX] illegal channel: ${cnn}`)
        }

        if (hasAction) {
            return {
                action,
                target
            }
        } else {
            return {
                channel: target
            }
        }
    }

    protected filterPipes(rule: string) {
        const handlers: Function[] = []
        if (rule === '*' || rule[0] === '!') {
            let excludes: string[] = []
            if (rule[0] === '!') {
                excludes = rule
                    .substr(1)
                    .split(',')
                    .map((item) => item.trim())
            }
            Object.keys(this.pipes).forEach((key) => {
                if (!excludes.includes(key)) {
                    handlers.push(this.pipes[key])
                }
            })

            Object.keys(MotXInstances).forEach((key) => {
                if (!excludes.includes(key)) {
                    handlers.push((jsonStringifyed: string) => {
                        MotXInstances[key].onReceive(jsonStringifyed)
                    })
                }
            })
        } else if (rule.includes(',') || Array.isArray(rule)) {
            const keys =
                typeof rule === 'string'
                    ? rule.split(',').map((item) => item.trim())
                    : rule
            keys.forEach((key) => {
                if (this.pipes[key]) {
                    handlers.push(this.pipes[key])
                }
                if (MotXInstances[key]) {
                    handlers.push((jsonStringifyed: string) => {
                        MotXInstances[key].onReceive(jsonStringifyed)
                    })
                }
            })
        } else {
            if (!this.pipes[rule] && !MotXInstances[rule]) {
                throw new Error(UNKNOWN_PIPE_NAME_MSG(rule))
            }
            if (this.pipes[rule]) {
                handlers.push(this.pipes[rule])
            }
            if (MotXInstances[rule]) {
                handlers.push((jsonStringifyed: string) => {
                    MotXInstances[rule].onReceive(jsonStringifyed)
                })
            }
        }
        return handlers
    }
}

class Store {
    public reactData: { [key: string]: any } = {}
    public state: { [key: string]: any }
    public isolate: boolean = true
    protected observers: { [key: string]: Observer } = {}
    constructor(state: { [key: string]: any }, isolate: boolean) {
        this.state = state
        this.isolate = isolate
        this.observe()
    }
    public setState(
        key: string,
        newState: State,
        isolate?: boolean,
        silent?: boolean
    ): void {
        this.checkFieldName(key)
        this.state[key] = this.ifClone(newState, isolate)
        if (!silent) {
            this.observers[key].deps.forEach((autorun) => {
                AutoRunTarget = autorun
                autorun(this.reactData, false)
                AutoRunTarget = null
            })
        }
    }
    public getState(key, isolate) {
        this.checkFieldName(key)
        return this.ifClone(this.state[key], isolate)
    }
    protected observe() {
        Object.keys(this.state).forEach((key) => {
            const observer = new Observer()
            this.observers[key] = observer
            Object.defineProperty(this.reactData, key, {
                get() {
                    if (AutoRunTarget) {
                        if (!observer.deps.includes(AutoRunTarget))
                            observer.deps.push(AutoRunTarget)
                    }
                    return this.ifClone(this.store[key])
                },
                set(value) {
                    throw new Error(CANNOT_SET_STATE_DIRECTLY(key))
                },
                enumerable: true,
                configurable: false
            })
        })
    }

    public removeAutorun(autorun) {
        Object.values(this.observers).forEach(({ deps }: Observer) => {
            const index = deps.indexOf(autorun)
            if (index > -1) {
                deps.slice(index, 1)
            }
        })
        if (AutoRunTarget === autorun) {
            AutoRunTarget = null
        }
    }

    public ifClone(state: State | Store, isolate?: boolean): State | Store {
        if (typeof isolate === 'undefined' ? !this.isolate : !isolate) {
            return state
        }
        if (state && typeof state === 'object') {
            return JSON.parse(JSON.stringify(state))
        } else return state
    }

    public checkFieldName(key) {
        if (typeof this.state[key] === 'undefined') {
            throw new Error(
                `[MotX] unknown field name: ${Object.keys(
                    this.state
                )}, ${DEFAULT_FIELD_ERR_MSG}`
            )
        }
    }
}

class Observer {
    public deps: Function[] = []
    constructor() {}
}
class Pipe {
    protected pipes: Function[]

    constructor(pipes: Function[]) {
        this.pipes = pipes
    }

    public publish(channel: string, ...args: Function[]) {
        this.send(channel, args)
    }

    public setState(fieldName: string, newState: State): void {
        this.send(`setState:${fieldName}`, [newState])
    }

    // public getState(fieldName: string): State {
    //     return
    // }

    private send(channel, args) {
        const data = JSON.stringify({ channel, args })
        this.pipes.forEach((pipe) => {
            pipe(data)
        })
    }
}

const CHANNEL_VALID_REG = /[\w\-_\/\\\.]+/
const EVENT_CHANNEL_VALID_REG = /[\w\-_\/\\\.]+\s*\@\s*[\w\-_\/\\\.]+/
const CHANNEL_PARSE_REG = /\s*(([\w\-_\.]+)\s*\:)?\s*([\w\-_\/\\\.]+)\s*/

// 内置

const DEFAULT_FIELD_ERR_MSG =
    'you should define the fields of store when instantiate MotX'
const NEW_STATE_UNDEFINED_ERR_MSG = '[MotX] new state should not be undefined'
const UNKNOWN_PIPE_NAME_MSG = (pipeName) =>
    `[MotX] the pipe or the motx instance is not found: ${pipeName}`
const UNKNOWN_CHANNEL_MSG = (motxName, channel) =>
    `[MotX] unknown channel: ${channel}${
        motxName ? ' in ' + motxName : ''
    }, please register with options.channels before using it`
const UNKNOWN_ACTION_MSG = (action) =>
    `[MotX] unknown action: ${action}, please register with options.actions before using it`
const INVALID_REGISTER_CHANNEL_ERR_MSG = (channel) =>
    `[MotX] invalid channel: ${channel}, please check for /[\w\-_]+/`
const CANNOT_SET_STATE_DIRECTLY = (key) =>
    `[MotX] please set state with motx.setState(${key}, newState, isolate, silent) or publish(set:${key}, newState)`
export type State = any

export interface RemoveAutorunFunction {
    (): void
}
export interface Hooks {
    willPublish?(channel: string, args: any[]): boolean
    didPublish?(channel: string, args: any[]): void
    willSetState?(
        fieldName: string,
        newState: State,
        isolate: boolean,
        store: Store
    ): State | undefined
    didSetState?(
        fieldName: string,
        newState: State,
        isolate: boolean,
        store?: Store
    ): void
}
export interface MotXOptions {
    name?: string
    store?: PlainObject
    hooks?: Hooks
    pipes?: { [pipeName: string]: (jsonStringifyed: string) => void }
    isolate?: boolean
    channels?: string[]
    actions?: { [actionName: string]: (target: string, ...args: any[]) => void }
}

export interface PlainObject {
    [key: string]: any
}
