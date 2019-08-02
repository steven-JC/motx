export default class MotX {
    protected subscribers: { [key: string]: Subscriber[] } = {}
    protected store: Store
    protected hooks: Hooks
    protected isolate: boolean

    constructor(store: Store, hooks?: Hooks, isolate: boolean = true) {
        this.isolate = isolate
        this.hooks = {
            willPublish: (channel: string, data: State, isolate?: boolean) =>
                true,
            willSetState: (
                actionName: string,
                fieldName: string,
                newState: State,
                isolate: boolean
            ) => newState,
            didSetState: (
                actionName: string,
                fieldName: string,
                newState: State,
                store: Store
            ) => {},
            ...hooks
        }
        if (!store) throw DEFAULT_DATA_ERR_MSG
        this.store = this.clone(store) as Store
    }

    public getState(fieldName: string, isolate: boolean = true) {
        return this.clone(this.store[fieldName], isolate)
    }

    public setState(
        actionName: string,
        fieldName: string,
        newState: State | StateHandler,
        isolate: boolean = true
    ) {
        if (typeof this.store[fieldName] === 'undefined') {
            throw new Error(
                `[MotX] field name should be one of ${Object.keys(this.store)}`
            )
        }

        const set = (newState) => {
            const newStat: State | undefined =
                this.hooks.willSetState &&
                this.hooks.willSetState.call(
                    this,
                    actionName,
                    fieldName,
                    newState,
                    isolate
                )
            if (typeof newStat === 'undefined') {
                return
            }
            this.store[fieldName] = this.clone(newStat, isolate)
            const subscribers = this.subscribers[actionName] || []
            let i = subscribers.length
            while (i--) subscribers[i](this.clone(newStat, isolate))
            this.hooks.didSetState &&
                this.hooks.didSetState.call(
                    this,
                    actionName,
                    fieldName,
                    newState,
                    this.store
                )
        }

        let res
        if (typeof newState === 'function') {
            res = newState(this.clone(this.store[fieldName], isolate))
        } else {
            res = newState
        }
        if (res && res.then) {
            res.then((newState) => {
                if (typeof newState === 'undefined') throw UNDEFINED_ERR_MSG
                set(newState)
            })
        } else {
            set(res)
        }
    }

    public pub(channel: string, data: State, isolate: boolean = true) {
        const subscribers = this.subscribers[channel] || []
        if (
            this.hooks.willPublish &&
            !!this.hooks.willPublish.call(this, channel, data, isolate)
        ) {
            let i = subscribers.length
            while (i--) subscribers[i](this.clone(data, isolate))
        }
    }

    public sub(channel: string, subscriber: Subscriber) {
        const subscribers = (this.subscribers[channel] =
            this.subscribers[channel] || [])
        subscribers.push(subscriber)
    }

    public destroy() {
        this.store = {}
        this.subscribers = {}
    }

    protected clone(
        state: State | Store,
        isolate: boolean = true
    ): State | Store {
        if (!this.isolate || !isolate) {
            return state
        }
        if (state && typeof state === 'object') {
            return JSON.parse(JSON.stringify(state))
        } else return state
    }
}

const DEFAULT_DATA_ERR_MSG =
    '[MotX] you should define the fields of store when instantiate MotX'
const UNDEFINED_ERR_MSG = '[MotX] new state should not be undefined'
declare type Store = { [fieldName: string]: State }
declare type State =
    | number
    | number[]
    | string
    | string[]
    | PlainObject
    | PlainObject[]
    | boolean
    | boolean[]
    | null
    | null[]

declare interface Hooks {
    willPublish?(channel: string, data: State, isolate?: boolean): boolean
    willSetState?(
        actionName: string,
        fieldName: string,
        newState: State,
        isolate?: boolean
    ): State | undefined
    didSetState?(
        actionName: string,
        fieldName: string,
        newState: State,
        store?: Store
    ): void
}
declare interface StateHandler {
    (data: State): State
}
declare interface Subscriber {
    (data: State): void
}

declare interface PlainObject {
    [key: string]: any
}
