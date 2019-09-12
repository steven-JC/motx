import * as EventEmitter from 'eventemitter3'
export default class MotX {
    protected event: EventEmitter
    protected store: Store
    protected hooks: Hooks
    protected pipes: { [pipeName: string]: Pipe }
    protected isolate: boolean

    constructor(options: MotXOptions) {
        const { store, hooks = {}, isolate = true, pipes = {} } = options
        this.event = new EventEmitter()
        this.isolate = isolate
        this.hooks = {
            willPublish: (channel: string, args: any[]) => true,
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
        this.pipes = pipes
        if (!store) throw new Error(`[MotX] ${DEFAULT_FIELD_ERR_MSG}`)
        this.store = this.ifClone(store) as Store
    }

    public getState(fieldName: string): State {
        return this.ifClone(this.store[fieldName])
    }

    public setState(fieldName: string, newState: State): void {
        if (typeof this.store[fieldName] === 'undefined') {
            throw new Error(
                `[MotX] field name should be one of ${Object.keys(
                    this.store
                )}, ${DEFAULT_FIELD_ERR_MSG}`
            )
        }

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
            return
        }
        this.store[fieldName] = this.ifClone(newStat)
        this.event.emit(`${fieldName}-change`, this.ifClone(newStat))
        this.hooks.didSetState &&
            this.hooks.didSetState.call(
                this,
                fieldName,
                newState,
                this.isolate,
                this.store
            )
    }
    /**
     *
     * @param channel  `pipeName#channel`    `pipeName#set:fieldName`    `pipeName#assign:fieldName`     `fieldName:changed`
     * @param args
     */
    public publish(channel: string, ...args: any[]) {
        if (
            this.hooks.willPublish &&
            !!this.hooks.willPublish.call(this, channel, args)
        ) {
            this.event.emit(channel, ...args)
        }
    }

    public subscribe(channel: string, handler: Handler) {
        this.event.on(channel, handler)
    }

    public unsubscribe(channel, handler?: Handler) {
        this.event.off(channel, handler)
    }

    public dispose() {
        ;(this.store as any) = null
        this.event.removeAllListeners()
        ;(this.event as any) = null
    }

    protected ifClone(state: State | Store): State | Store {
        if (!this.isolate) {
            return state
        }
        if (state && typeof state === 'object') {
            return JSON.parse(JSON.stringify(state))
        } else return state
    }
}

const DEFAULT_FIELD_ERR_MSG =
    'you should define the fields of store when instantiate MotX'
const NEW_STATE_UNDEFINED_ERR_MSG = '[MotX] new state should not be undefined'
declare type Store = { [fieldName: string]: State }
declare type State = any

declare interface Hooks {
    willPublish?(channel: string, args: any[]): boolean
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
declare interface MotXOptions {
    store: Store
    hooks?: Hooks
    pipes?: { [pipeName: string]: Pipe }
    isolate?: boolean
}
declare interface Pipe {
    (channel, ...args: any[]): void
}
declare interface Handler {
    (...args: any[]): void
}

declare interface PlainObject {
    [key: string]: any
}
