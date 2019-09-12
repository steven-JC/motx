const MotX = require('../dist').default

describe('Motx', () => {
    describe('isolate', () => {
        it('isolate', () => {
            return new Promise((done) => {
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
                        motx.getState('bean') !== state && done()
                    }
                }
            })
        })
        it('!isolate', () => {
            return new Promise((done) => {
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
                        motx.getState('bean') === state && done()
                    }
                }
            })
        })
    })
    describe('getState && setState', () => {
        it('getState', () => {
            return new Promise((done) => {
                let motx = new MotX({
                    store: { bean: { count: 1 } }
                })
                motx.getState('bean').count === 1 && done()
            })
        })
        it('setState !silent', () => {
            return new Promise((done) => {
                let motx = new MotX({
                    store: { bean: { count: 1 } }
                })
                let i = 0
                motx.subscribe('bean:change', ({ count }) => {
                    i += count
                })
                motx.setState('bean', { count: 2 })
                i === 2 && done()
            })
        })

        it('setState silent', () => {
            return new Promise((done) => {
                let motx = new MotX({
                    store: { bean: { count: 1 } }
                })
                let i = 0
                motx.subscribe('bean:change', ({ count }) => {
                    i += count
                })
                motx.setState('bean', { count: 2 }, true)
                i === 0 && done()
            })
        })
    })
    describe('pipes & onReceive', () => {
        it('publish(pipe#channel)', () => {
            return new Promise((done) => {
                let motx = new MotX({
                    store: {},
                    pipes: {
                        ns1(stringifyed) {
                            const { channel, args } = JSON.parse(stringifyed)
                            channel === 'channel' && args.length === 0 && done()
                        }
                    }
                })
                motx.publish('ns1#channel')
            })
        })

        it('onReceive', () => {
            return new Promise((done) => {
                let motx = new MotX({ store: {} })
                motx.subscribe('channel', (arg1, arg2) => {
                    arg1 === 1 && arg2 === 2 && done()
                })
                motx.onReceive('{"channel":"channel","args":[1,2]}')
            })
        })
    })
    describe('hooks.didSetState', () => {
        it('did', () => {
            return new Promise((done) => {
                let motx = new MotX({
                    store: { fvck: 1 },
                    hooks: {
                        willSetState(channel, state) {
                            return state[0]
                        },
                        didSetState(channel, state) {
                            state === 100 && done()
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
            return new Promise((done) => {
                let i = 0
                motx.subscribe('fvck:change', (data) => {
                    i += data
                })
                motx.publish('set:fvck', [100])
                i === 100 && done()
            })
        })

        it('will not', () => {
            return new Promise((done) => {
                let i = 0
                motx.subscribe('fvck:change', () => {
                    i++
                })
                motx.publish('set:fvck', [])
                i === 0 && done()
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
            return new Promise((done) => {
                let i = 0
                motx.subscribe('channel', () => {
                    i++
                })
                motx.publish('channel', true)
                i === 1 && done()
            })
        })

        it('will not', () => {
            return new Promise((done) => {
                let i = 0
                motx.subscribe('channel', () => {
                    i++
                })
                motx.publish('channel', false)
                i === 0 && done()
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
            return new Promise((done) => {
                motx.subscribe('channel', () => {
                    done()
                })
                motx.publish('channel')
            })
        })
        it('publish(channel, simple)', () => {
            return new Promise((done) => {
                motx.subscribe('channel', (data) => {
                    data === true && done()
                })
                motx.publish('channel', true)
            })
        })
        it('publish(channel, object)', () => {
            return new Promise((done) => {
                motx.subscribe('channel', (data) => {
                    data.fvck === true && done()
                })
                motx.publish('channel', { fvck: true })
            })
        })
        it('publish(channel, array)', () => {
            return new Promise((done) => {
                motx.subscribe('channel', (data) => {
                    data[0].fvck === true && done()
                })
                motx.publish('channel', [{ fvck: true }])
            })
        })
        it('publish(channel, ...args)', () => {
            return new Promise((done) => {
                motx.subscribe('channel', (arg1, arg2, arg3) => {
                    arg1 === 1 && arg2 === 2 && arg3 === 3 && done()
                })
                motx.publish('channel', 1, 2, 3)
            })
        })
        it('publish(set:fvck, true)', () => {
            return new Promise((done) => {
                motx.subscribe('fvck:change', (data) => {
                    data === true && done()
                })
                motx.publish('set:fvck', true)
            })
        })
        it('publish(merge:bean, {name})', () => {
            return new Promise((done) => {
                motx.subscribe('bean:change', (data) => {
                    data.count === 1 && data.name === 'beanbean' && done()
                })
                motx.publish('merge:bean', { name: 'beanbean' })
            })
        })
        it('publish(set:bean, {name})', () => {
            return new Promise((done) => {
                motx.subscribe('bean:change', (data) => {
                    data.name === 'bean' &&
                        typeof data.count === 'undefined' &&
                        done()
                })
                motx.publish('set:bean', { name: 'bean' })
            })
        })
    })
})
