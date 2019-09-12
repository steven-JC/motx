const MotX = require('../dist').default

describe('Motx', () => {
    describe('isolate', () => {
        it('isolate', () => {
            return new Promise((r) => {
                const store = { bean: { count: 1 } }
                let motx = new MotX({
                    store,
                    isolate: true
                })
                if (motx.getState('bean') !== store.bean) {
                    const state = {}
                    motx.setState('bean', state)
                    if (motx.getState('bean') !== state) {
                        motx.publish('set:bean', state)
                        motx.getState('bean') !== state && r()
                    }
                }
            })
        })
        it('!isolate', () => {
            return new Promise((r) => {
                const store = { bean: { count: 1 } }
                let motx = new MotX({
                    store,
                    isolate: false
                })
                if (motx.getState('bean') === store.bean) {
                    const state = {}
                    motx.setState('bean', state)
                    if (motx.getState('bean') === state) {
                        motx.publish('set:bean', state)
                        motx.getState('bean') === state && r()
                    }
                }
            })
        })
    })
    describe('getState && setState', () => {
        it('getState', () => {
            return new Promise((r) => {
                let motx = new MotX({
                    store: { bean: { count: 1 } }
                })
                motx.getState('bean').count === 1 && r()
            })
        })
        it('setState !silent', () => {
            return new Promise((r) => {
                let motx = new MotX({
                    store: { bean: { count: 1 } }
                })
                let i = 0
                motx.subscribe('bean:change', ({ count }) => {
                    i += count
                })
                motx.setState('bean', { count: 2 })
                i === 2 && r()
            })
        })

        it('setState silent', () => {
            return new Promise((r) => {
                let motx = new MotX({
                    store: { bean: { count: 1 } }
                })
                let i = 0
                motx.subscribe('bean:change', ({ count }) => {
                    i += count
                })
                motx.setState('bean', { count: 2 }, true)
                i === 0 && r()
            })
        })
    })
    describe('pipes & onReceive', () => {
        it('publish(pipe#channel)', () => {
            return new Promise((r) => {
                let motx = new MotX({
                    store: {},
                    pipes: {
                        ns1(stringifyed) {
                            const { channel, args } = JSON.parse(stringifyed)
                            channel === 'channel' && args.length === 0 && r()
                        }
                    }
                })
                motx.publish('ns1#channel')
            })
        })

        it('onReceive', () => {
            return new Promise((r) => {
                let motx = new MotX({ store: {} })
                motx.subscribe('channel', (arg1, arg2) => {
                    arg1 === 1 && arg2 === 2 && r()
                })
                motx.onReceive('{"channel":"channel","args":[1,2]}')
            })
        })
    })
    describe('hooks.didSetState', () => {
        it('did', () => {
            return new Promise((r) => {
                let motx = new MotX({
                    store: { fvck: 1 },
                    hooks: {
                        willSetState(channel, state) {
                            return state[0]
                        },
                        didSetState(channel, state) {
                            state === 100 && r()
                        }
                    }
                })
                motx.publish('set:fvck', [100])
            })
        })
    })
    describe('hooks.willSetState', () => {
        let motx
        beforeEach(() => {
            motx = new MotX({
                store: {
                    fvck: false
                },
                hooks: {
                    willSetState(channel, state) {
                        return state[0]
                    }
                }
            })
        })

        it('will', () => {
            return new Promise((r) => {
                let i = 0
                motx.subscribe('fvck:change', (data) => {
                    i += data
                })
                motx.publish('set:fvck', [100])
                i === 100 && r()
            })
        })

        it('will not', () => {
            return new Promise((r) => {
                let i = 0
                motx.subscribe('fvck:change', () => {
                    i++
                })
                motx.publish('set:fvck', [])
                i === 0 && r()
            })
        })
    })
    describe('hooks.willPublish', () => {
        let motx
        beforeEach(() => {
            motx = new MotX({
                store: {
                    fvck: false
                },
                hooks: {
                    willPublish(channel, args) {
                        return args[0]
                    }
                }
            })
        })
        it('will', () => {
            return new Promise((r) => {
                let i = 0
                motx.subscribe('channel', () => {
                    i++
                })
                motx.publish('channel', true)
                i === 1 && r()
            })
        })

        it('will not', () => {
            return new Promise((r) => {
                let i = 0
                motx.subscribe('channel', () => {
                    i++
                })
                motx.publish('channel', false)
                i === 0 && r()
            })
        })
    })
    describe('publish & subscribe', () => {
        let motx
        beforeEach(() => {
            motx = new MotX({
                store: {
                    fvck: false,
                    bee: [1, 2, 3, 4],
                    bean: { count: 1 }
                }
            })
        })
        it('publish(channel)', () => {
            return new Promise((r) => {
                motx.subscribe('channel', () => {
                    r()
                })
                motx.publish('channel')
            })
        })
        it('publish(channel, simple)', () => {
            return new Promise((r) => {
                motx.subscribe('channel', (data) => {
                    data === true && r()
                })
                motx.publish('channel', true)
            })
        })
        it('publish(channel, object)', () => {
            return new Promise((r) => {
                motx.subscribe('channel', (data) => {
                    data.fvck === true && r()
                })
                motx.publish('channel', { fvck: true })
            })
        })
        it('publish(channel, array)', () => {
            return new Promise((r) => {
                motx.subscribe('channel', (data) => {
                    data[0].fvck === true && r()
                })
                motx.publish('channel', [{ fvck: true }])
            })
        })
        it('publish(channel, ...args)', () => {
            return new Promise((r) => {
                motx.subscribe('channel', (arg1, arg2, arg3) => {
                    arg1 === 1 && arg2 === 2 && arg3 === 3 && r()
                })
                motx.publish('channel', 1, 2, 3)
            })
        })
        it('publish(set:fvck, true)', () => {
            return new Promise((r) => {
                motx.subscribe('fvck:change', (data) => {
                    data === true && r()
                })
                motx.publish('set:fvck', true)
            })
        })
        it('publish(merge:bean, {name})', () => {
            return new Promise((r) => {
                motx.subscribe('bean:change', (data) => {
                    data.count === 1 && data.name === 'beanbean' && r()
                })
                motx.publish('merge:bean', { name: 'beanbean' })
            })
        })
        it('publish(set:bean, {name})', () => {
            return new Promise((r) => {
                motx.subscribe('bean:change', (data) => {
                    data.name === 'bean' &&
                        typeof data.count === 'undefined' &&
                        r()
                })
                motx.publish('set:bean', { name: 'bean' })
            })
        })
    })
})
