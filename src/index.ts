import EventEmitter from 'eventemitter3'

const MotXInstances: { [key: string]: MotX } = {}

let AutoRunTarget: Func | null = null

export default class MotX {
    protected name: string = ''
    protected event: EventEmitter
    protected store: Store
    protected hooks: Hooks
    protected pipes: {
        [pipeName: string]: (jsonStringifyed: string) => void
    }
    protected isolate: boolean
    protected actions: {
        [actionName: string]: (target: string, ...args: any[]) => void
    }

    /**
     * constructor
     * @param options {name, store, hooks, pipes, isolate, actions}
     */
    constructor(options: MotXOptions) {
        const {
            name,
            store = {},
            hooks = {},
            isolate = true,
            pipes = {},
            actions = {}
        } = options

        if (!name) {
            throw new Error('[Motx] MotXOptions.name is required.')
        }

        MotXInstances[name] = this
        this.name = name

        this.event = new EventEmitter()
        this.isolate = isolate
        this.hooks = {
            willPublish: (channel: string, args: any[]) => true,
            didPublish: (channel: string, args: any[]) => true,
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
            ) => true,
            ...hooks
        }

        this.pipes = pipes
        this.actions = actions

        this.store = new Store(JSON.parse(JSON.stringify(store)), this.isolate)
    }

    /**
     * Get the pipes to publish message to the target MotX instance
     * @param rule
     * '*' match all pipe, including the named MotX instance in the same global context
     * '!pipe1,pipe2' match all pipe, but pipe1,pipe2 excluded
     * 'pipe1,pipe2' just match pipe1,pipe2
     * @returns get the pipe to send channel
     */
    public pipe(rule: string): Pipe {
        const handlers: Func[] = this.filterPipes(rule)
        return new Pipe(handlers)
    }

    /**
     * Receive a json with channel and args from other motx to publish or setState in current MotX instance
     * @param jsonStringifyed A json with channel and args which was stringified by other motx
     */
    public onReceive(jsonStringifyed: string) {
        const { channel, args } = JSON.parse(jsonStringifyed)
        this.publish(channel, ...args)
    }

    /**
     * Run the handler in sync when called, and run in async when the state it depends is changed
     * @param handler The autorun handler, receive tow params, rootState and isInitRun
     * @returns A function to remove this autorun
     */
    public autorun(
        handler: (rootState: { [key: string]: any }, isInitRun: boolean) => {}
    ): RemoveAutorunFunc {
        AutoRunTarget = handler
        handler(this.store.reactData, true)
        AutoRunTarget = null
        return () => {
            this.store.removeAutorun(handler)
        }
    }

    /**
     * Get the state from store by field name
     * @param fieldName The root field name defined in MotXOptions.store
     * @param isolate Whether to isolate the object reference
     */
    public getState(fieldName: string, isolate?: boolean): State {
        return this.store.getState(fieldName, isolate)
    }

    /**
     * Apply new state to the store, and call the autorun which depended on this field, and publish `fieldName@change`
     * @param fieldName The root field name defined in MotXOptions.store
     * @param newState New state to set to the store
     * @param isolate Whether to isolate the object reference
     * @param silent  Whether not to publish `fieldName@change`， false by default
     */
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

            if (this.hooks.didSetState) {
                this.hooks.didSetState.call(
                    this,
                    fieldName,
                    newStat,
                    this.isolate,
                    this.store
                )
            }
        }
    }

    /**
     * Publish message to the channel
     * @param channel
     * @param args
     */
    public publish(channel: string, ...args: any[]) {
        if (
            this.hooks.willPublish &&
            !!this.hooks.willPublish.call(this, channel, args)
        ) {
            args = args.map((item) => {
                if (typeof item === 'object') {
                    return this.store.ifClone(item)
                } else {
                    return item
                }
            })
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
            } else {
                this.event.emit(`${channel}:before`, ...args)
                this.event.emit(channel, ...args)
                this.event.emit(`${channel}:after`, ...args)
            }
            if (this.hooks.didPublish) {
                this.hooks.didPublish.call(this, channel, args)
            }
        }
    }

    /**
     * Subscribe message from channel
     * @param channel
     * @param handler
     */
    public subscribe(channel: string, handler: (...args: any[]) => void) {
        if (CHANNEL_VALID_REG.test(channel)) {
            this.event.on(channel, handler)
        } else {
            throw new Error(INVALID_CHANNEL_MSG(this.name, channel))
        }
    }

    /**
     * Remove all subscriptions by channel or remove the target subscription by a hanlder as the second param
     * @param channel
     * @param handler
     */
    public unsubscribe(channel: string, handler?: (...args: any[]) => void) {
        if (CHANNEL_VALID_REG.test(channel)) {
            this.event.off(channel, handler)
        } else {
            throw new Error(INVALID_CHANNEL_MSG(this.name, channel))
        }
    }

    /**
     * Dispose the MotX instance
     */
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
        const handlers: Func[] = []
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
            if (!this.name && !excludes.includes('self')) {
                handlers.push((jsonStringifyed: string) => {
                    this.onReceive(jsonStringifyed)
                })
            }
        } else if (rule.includes(',')) {
            const keys = rule.split(',').map((item) => item.trim())
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

    protected toRun: Func[] = []

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
            const deps = this.observers[key].deps
            deps.forEach((autorun) => {
                if (!this.toRun.includes(autorun)) {
                    this.toRun.push(autorun)
                }
            })
        }
        this.run()
    }
    public getState(key, isolate) {
        this.checkFieldName(key)
        return this.ifClone(this.state[key], isolate)
    }

    public removeAutorun(autorun) {
        Object.values(this.observers).forEach(({ deps }: Observer) => {
            const index = deps.indexOf(autorun)
            if (index > -1) {
                deps.splice(index, 1)
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
        } else {
            return state
        }
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
    protected observe() {
        Object.keys(this.state).forEach((key) => {
            const observer = new Observer()
            this.observers[key] = observer
            const self = this
            Object.defineProperty(this.reactData, key, {
                get() {
                    if (AutoRunTarget) {
                        if (!observer.deps.includes(AutoRunTarget)) {
                            observer.deps.push(AutoRunTarget)
                        }
                    }
                    return self.ifClone(self.state[key])
                },
                set(value) {
                    throw new Error(CANNOT_SET_STATE_DIRECTLY(key))
                },
                enumerable: true,
                configurable: false
            })
        })
    }
    protected run() {
        const p = Promise.resolve()
        p.then(() => {
            while (this.toRun.length) {
                const autorun = this.toRun.shift()
                if (autorun) {
                    AutoRunTarget = autorun
                    autorun(this.reactData, false)
                    AutoRunTarget = null
                }
            }
        }).catch((err) => {
            console.error(err)
        })
    }
}

class Observer {
    public deps: Func[] = []
}
class Pipe {
    protected pipes: Func[]

    constructor(pipes: Func[]) {
        this.pipes = pipes
    }

    public publish(channel: string, ...args: any[]) {
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

const CHANNEL_VALID_REG = /[\w\-_\/\\\.\:\@]+/
const CHANNEL_PARSE_REG = /\s*(([\w\-_\.]+)\s*\:)?\s*([\w\-_\/\\\.]+)\s*/

// 内置

const DEFAULT_FIELD_ERR_MSG =
    'you should define the fields of store when instantiate MotX'
const NEW_STATE_UNDEFINED_ERR_MSG = '[MotX] new state should not be undefined'
const UNKNOWN_PIPE_NAME_MSG = (pipeName) =>
    `[MotX] the pipe or the motx instance is not found: ${pipeName}`
const INVALID_CHANNEL_MSG = (motxName, channel) =>
    `[MotX] unknown channel: ${channel}${motxName ? ' in ' + motxName : ''}`
const UNKNOWN_ACTION_MSG = (action) =>
    `[MotX] unknown action: ${action}, please register with options.actions before using it`
const CANNOT_SET_STATE_DIRECTLY = (key) =>
    `[MotX] please set state with motx.setState(${key}, newState, isolate, silent) or publish(set:${key}, newState)`
export type State = any

type RemoveAutorunFunc = () => void
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
    name: string
    store?: { [fileName: string]: any }
    hooks?: Hooks
    pipes?: { [pipeName: string]: (jsonStringifyed: string) => void }
    isolate?: boolean
    actions?: { [actionName: string]: (target: string, ...args: any[]) => void }
}

export interface PlainObject {
    [key: string]: any
}

type Func = (...args) => any
