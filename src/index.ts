import * as EventEmitter from 'eventemitter3'

export default class MotX {
    protected event: EventEmitter
    protected store: Store
    protected hooks: Hooks
    protected pipes: { [pipeName: string]: (jsonStringifyed: string) => void }
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
            store = {},
            hooks = {},
            isolate = true,
            pipes = {},
            channels = [],
            actions = {}
        } = options
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

        if (!store) throw new Error(`[MotX] ${DEFAULT_FIELD_ERR_MSG}`)
        this.store = this.ifClone(store) as Store
    }

    public onReceive(jsonStringifyed: string) {
        const { channel, args } = JSON.parse(jsonStringifyed)
        this.publish(channel, ...args)
    }

    public getState(fieldName: string): State {
        this.checkFieldName(fieldName)
        return this.ifClone(this.store[fieldName])
    }

    public setState(
        fieldName: string,
        newState: State,
        silent?: boolean
    ): void {
        this.checkFieldName(fieldName)
        const oldState = this.ifClone(this.store[fieldName], true)
        if (this.updateStore('set', fieldName, newState) && !silent) {
            this.event.emit(
                this.stringifyChannel({
                    target: fieldName,
                    event: 'change'
                }),
                newState,
                oldState
            )
        }
    }

    public publish(channel: string, ...args: any[]) {
        if (
            this.hooks.willPublish &&
            !!this.hooks.willPublish.call(this, channel, args)
        ) {
            const parsed = this.parseChannel(channel)
            if (parsed.pipeName) {
                if (parsed.pipeName === '*') {
                    Object.keys(this.pipes).forEach((item) => {
                        this.send(
                            parsed.pipeName,
                            this.stringifyChannel(parsed),
                            args
                        )
                    })
                } else {
                    this.send(
                        parsed.pipeName,
                        this.stringifyChannel(parsed),
                        args
                    )
                }
            } else if (parsed.target && parsed.action) {
                if (Actions.includes(parsed.action)) {
                    if (
                        this.updateStore(parsed.action, parsed.target, args[0])
                    ) {
                        const oldState = this.getState(parsed.target)
                        this.event.emit(
                            this.stringifyChannel({
                                target: parsed.target,
                                event: 'change'
                            }),
                            this.ifClone(this.store[parsed.target]),
                            oldState
                        )
                    }
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
                throw new Error(UNKNOWN_CHANNEL_MSG(channel))
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
            throw new Error(UNKNOWN_CHANNEL_MSG(channel))
        }
    }

    public unsubscribe(channel: string, handler?: (...args: any[]) => void) {
        if (
            this.channels.includes(channel) ||
            EVENT_CHANNEL_VALID_REG.test(channel)
        ) {
            this.event.off(channel, handler)
        } else {
            throw new Error(UNKNOWN_CHANNEL_MSG(channel))
        }
    }

    public dispose() {
        ;(this.store as any) = null
        this.event.removeAllListeners()
        ;(this.event as any) = null
    }

    protected checkFieldName(fieldName) {
        if (typeof this.store[fieldName] === 'undefined') {
            throw new Error(
                `[MotX] unknown field name: ${Object.keys(
                    this.store
                )}, ${DEFAULT_FIELD_ERR_MSG}`
            )
        }
    }

    protected updateStore(action: string, fieldName: string, newState: any) {
        this.checkFieldName(fieldName)
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
        if (typeof newStat === 'undefined') {
            return false
        }
        switch (action) {
            case 'set':
                this.store[fieldName] = this.ifClone(newStat)
                break
            case 'merge':
                this.store[fieldName] = Object.assign(
                    this.store[fieldName],
                    this.ifClone(newStat)
                )
                break
        }
        this.hooks.didSetState &&
            this.hooks.didSetState.call(
                this,
                fieldName,
                newStat,
                this.isolate,
                this.store
            )
        return true
    }

    protected send(pipeName, channel, args: any[]) {
        if (!this.pipes[pipeName]) {
            throw new Error(`[MotX] the pipe is not found: ${pipeName}`)
        }
        this.pipes[pipeName](JSON.stringify({ channel, args }))
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
    //`channel >> pipeName`    ` set:fieldName >> pipeName`    `merge:fieldName >> pipeName`
    protected parseChannel(cnn: string) {
        const [
            matched,
            hasAction,
            action,
            target,
            hasPipe,
            pipeName
        ]: string[] = CHANNEL_PARSE_REG.exec(cnn) || []
        if (!matched) {
            throw new Error(`[MotX] illegal channel: ${cnn}`)
        }

        if (hasAction) {
            return {
                pipeName,
                action,
                target
            }
        } else {
            return {
                pipeName,
                channel: target
            }
        }
    }

    protected ifClone(state: State | Store, isolate?: boolean): State | Store {
        if (typeof isolate === 'undefined' ? !this.isolate : !isolate) {
            return state
        }
        if (state && typeof state === 'object') {
            return JSON.parse(JSON.stringify(state))
        } else return state
    }
}

const CHANNEL_VALID_REG = /[\w\-_\/\\\.]+/
const EVENT_CHANNEL_VALID_REG = /[\w\-_\/\\\.]+\s*\@\s*[\w\-_\/\\\.]+/
const CHANNEL_PARSE_REG = /\s*(([\w\-_\.]+)\s*\:)?\s*([\w\-_\/\\\.]+)\s*(\>\>\s*([\w\-_\d\*]+))?/

// 内置
const Actions = ['set', 'merge']

const DEFAULT_FIELD_ERR_MSG =
    'you should define the fields of store when instantiate MotX'
const NEW_STATE_UNDEFINED_ERR_MSG = '[MotX] new state should not be undefined'
const UNKNOWN_CHANNEL_MSG = (channel) =>
    `[MotX] unknown channel: ${channel}, please register with options.channels before using it`
const UNKNOWN_ACTION_MSG = (action) =>
    `[MotX] unknown action: ${action}, please register with options.actions before using it`
const INVALID_REGISTER_CHANNEL_ERR_MSG = (channel) =>
    `[MotX] invalid channel: ${channel}, please check for /[\w\-_]+/`

export type Store = { [fieldName: string]: State }
export type State = any

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
    store?: Store
    hooks?: Hooks
    pipes?: { [pipeName: string]: (jsonStringifyed: string) => void }
    isolate?: boolean
    channels?: string[]
    actions?: { [actionName: string]: (target: string, ...args: any[]) => void }
}

export interface PlainObject {
    [key: string]: any
}
