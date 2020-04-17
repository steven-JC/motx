import Motx, { MotXOptions } from './index'

declare interface PlainObject {
    [key: string]: any
}

export const State = (stateName): any => {
    if (stateName.includes('.')) {
        throw new Error('[motx-vue] sub path is not supported.')
    }
    return function (target, property: string) {
        console.log(arguments)
        target.$MotxState = target.$MotxState || {}
        target.$MotxState[property] = stateName
    }
}

export default class MotxVue extends Motx {
    protected connections: { [key: string]: PlainObject[] } = {}
    protected options: MotXOptions
    constructor(options: MotXOptions) {
        super(options)
        if (options.hooks && options.hooks.didSetState) {
            const didSetState = this.hooks.didSetState
            const connections = this.connections
            this.hooks.didSetState = (fieldName, newState, isolate, store) => {
                didSetState(fieldName, newState, isolate, store)
                const cnns = connections[fieldName]
                if (cnns && cnns.length) {
                    for (var i = 0, l = cnns.length; i < l; i++) {
                        if (cnns[i]) {
                            cnns[i].comp[cnns[i].propName] = this.getState(
                                cnns[i].statePath
                            )
                        }
                    }
                }
            }
        }
        this.options = { ...options }
    }
    protected install(Vue) {
        const connections = this.connections
        const me = this
        Vue.mixin({
            created() {
                if (this.$data) {
                    const motxOpts = this.$data.$MotxState
                    console.log(motxOpts, this)
                    if (motxOpts) {
                        for (const x in motxOpts) {
                            if (motxOpts.hasOwnProperty(x)) {
                                Vue.util.defineReactive(
                                    this,
                                    x,
                                    me.connectState(this, x, motxOpts[x])
                                )
                            }
                        }
                    }
                }
            },
            beforeDestroy() {
                if (this.$data.$MotxState) {
                    const stateOption = this.$data.$MotxState
                    let tmp
                    for (var x in stateOption) {
                        tmp = []
                        for (
                            var i = 0, l = connections[stateOption[x]].length;
                            i < l;
                            i++
                        ) {
                            if (connections[stateOption[x]][i].comp !== this)
                                tmp.push(connections[stateOption[x]][i])
                        }
                        connections[stateOption[x]] = tmp
                    }
                }
            }
        })
    }
    protected connectState(targetObject, propName, statePath) {
        const connections = this.connections
        if (!statePath) throw '[tunk]:unknown module name:' + statePath
        connections[statePath] = connections[statePath] || []
        connections[statePath].push({
            comp: targetObject,
            propName: propName,
            statePath: statePath
        })
        //返回组件默认数据
        return this.getState(statePath)
    }
}
