import * as EventEmitter from 'eventemitter3'
export default class MotX {
    public readonly onReceive: ReceiveHanler
    protected event: EventEmitter
    protected store: Store
    protected hooks: Hooks
    protected pipes: { [pipeName: string]: Pipe }
    protected isolate: boolean

    constructor(options: MotXOptions) {
        const {
            store,
            hooks = {},
            isolate = true,
            pipes = {},
            onReceive = (jsonStringifyed: string) => {
                const { channel, args } = JSON.parse(jsonStringifyed)
                this.publish(channel, ...args)
            }
        } = options
        this.event = new EventEmitter()
        this.isolate = isolate
        this.onReceive = onReceive
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

    public setState(
        fieldName: string,
        newState: State,
        silent?: boolean
    ): void {
        this.updateStore('set', fieldName, newState)
        if (!silent) {
            this.event.emit(
                this.stringify({
                    fieldName: fieldName,
                    event: 'change'
                }),
                newState
            )
        }
    }

    public publish(channel: string, ...args: any[]) {
        if (
            this.hooks.willPublish &&
            !!this.hooks.willPublish.call(this, channel, args)
        ) {
            const parsed = this.parse(channel)
            if (parsed.pipeName) {
                this.send(parsed.pipeName, this.stringify(parsed), args)
            } else if (parsed.mutation) {
                this.updateStore(parsed.mutation, parsed.fieldName, args[0])
                this.event.emit(
                    this.stringify({
                        fieldName: parsed.fieldName,
                        event: 'change'
                    }),
                    this.ifClone(args[0])
                )
            } else {
                this.event.emit(channel, ...args)
            }
        }
    }

    public subscribe(channel: string, handler: Handler) {
        this.event.on(channel, handler)
    }

    public unsubscribe(channel: string, handler?: Handler) {
        this.event.off(channel, handler)
    }

    public dispose() {
        ;(this.store as any) = null
        this.event.removeAllListeners()
        ;(this.event as any) = null
    }

    protected updateStore(mutation: string, fieldName: string, newState: any) {
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
        switch (mutation) {
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
    }

    protected send(pipeName, channel, args: any[]) {
        if (!this.pipes[pipeName]) {
            throw new Error(`[MotX] the pipe is not found: ${pipeName}`)
        }
        this.pipes[pipeName](JSON.stringify({ channel, args }))
    }

    protected stringify({ mutation, fieldName, event, channel }: any) {
        if (mutation) {
            return `${mutation}:${fieldName}`
        } else if (event) {
            return `${fieldName}:${event}`
        } else {
            return channel
        }
    }
    //`pipeName#channel`    `pipeName#set:fieldName`    `pipeName#merge:fieldName`     `fieldName:changed`
    protected parse(cnn: string) {
        const [matched, hasPipe, pipeName, hasMutation, mutation, fieldName] =
            /(([\w\-_\d\.]+)\s*\#)?\s*(([\w\-_\d\.]+)\s*\:)?\s*([\w\-_\d\.]+)/.exec(
                cnn
            ) || []
        if (!matched) {
            throw new Error(`[MotX] illegal channel: ${cnn}`)
        }

        if (!Mutation.includes(mutation)) {
            throw new Error(
                `[MotX] illegal mutation: ${mutation}, should be one of ${Mutation}`
            )
        }

        if (hasMutation) {
            return {
                pipeName,
                mutation,
                fieldName
            }
        } else {
            return {
                pipeName,
                channel: fieldName
            }
        }
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

const Mutation = ['set', 'merge']

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
    onReceive?: ReceiveHanler
}
declare interface Pipe {
    (jsonStringifyed: string): void
}
declare interface ReceiveHanler {
    (jsonStringifyed: string): void
}
declare interface Handler {
    (...args: any[]): void
}

declare interface PlainObject {
    [key: string]: any
}
