const MotX = require('../dist').default

describe('Motx', () => {
    describe('autorun', () => {
        it('autorun init run', () => {
            return new Promise((done) => {
                let motx = new MotX({
                    store: { list: [] }
                })
            })
        })
    })
    describe('actions', () => {
        it('action push', () => {
            return new Promise((done) => {
                let motx = new MotX({
                    store: { list: [] },
                    actions: {
                        push(target, item) {
                            const oldState = this.getState(target)
                            if (!Array.isArray(oldState)) {
                                throw new Error(
                                    `[MotX] push action need a target type of Array`
                                )
                            }
                            this.store.state.list.push(item)
                            this.event.emit(
                                `${target}@change`,
                                this.getState(target),
                                oldState
                            )
                        }
                    }
                })
                motx.subscribe('list@change', (newState, oldState) => {
                    if (newState.length === 1 && oldState.length === 0) {
                        done()
                    }
                })
                motx.publish('push:list', { name: 'bean' })
            })
        })
    })
    describe('isolate', () => {
        it('options.isolate', () => {
            return new Promise((done) => {
                const store = { bean: { count: 1 } }
                let motx = new MotX({
                    store,
                    isolate: true
                })
                const state = {}
                motx.setState('bean', state)
                if (motx.getState('bean') !== state) {
                    motx.publish('setState:bean', state)
                    motx.getState('bean') !== state && done()
                }
            })
        })
        it('options.!isolate', () => {
            return new Promise((done) => {
                const store = { bean: { count: 1 } }
                let motx = new MotX({
                    store,
                    isolate: false
                })
                const state = {}
                motx.setState('bean', state)
                if (motx.getState('bean') === state) {
                    motx.publish('setState:bean', state)
                    motx.getState('bean') === state && done()
                }
            })
        })

        it('getState isolate', () => {
            return new Promise((done) => {
                const bean = {}
                let motx = new MotX({
                    store: { bean },
                    isolate: false
                })
                const state1 = motx.getState('bean', true)
                const state2 = motx.getState('bean', true)
                if (state1 !== bean && state1 !== state2) done()
            })
        })
        it('getState !isolate', () => {
            return new Promise((done) => {
                const bean = {}
                let motx = new MotX({
                    store: { bean },
                    isolate: true
                })
                const state1 = motx.getState('bean', false)
                const state2 = motx.getState('bean', false)
                if (state1 === state2) done()
            })
        })

        it('setState isolate', () => {
            return new Promise((done) => {
                const bean = {}
                let motx = new MotX({
                    store: { bean },
                    isolate: false
                })
                let i = 0
                motx.subscribe('bean@change', (state, old) => {
                    if (bean === state || old === bean) {
                        throw new Error('error in setState isolate')
                    }
                })
                motx.setState('bean', bean, true)

                done()
            })
        })

        it('setState !isolate', () => {
            return new Promise((done) => {
                const bean = {}
                let motx = new MotX({
                    store: { bean },
                    isolate: true
                })
                motx.subscribe('bean@change', (state, old) => {
                    if (bean !== state || old === bean) {
                        throw new Error('error in setState isolate')
                    }
                })
                motx.setState('bean', bean, false)
                if (motx.getState('bean', false) === bean) done()
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
                motx.subscribe('bean@change', ({ count }) => {
                    i += count
                })
                motx.setState('bean', { count: 2 })
                i === 2 && done()
            })
        })

        it('setState newState & oldState', () => {
            return new Promise((done) => {
                let motx = new MotX({
                    store: { bean: { count: 10 } }
                })
                let i = 1
                motx.subscribe('bean@change', (newState, oldState) => {
                    i += newState.count + oldState.count
                })
                motx.setState('bean', { count: 100 })
                i === 111 && done()
            })
        })

        it('setState silent', () => {
            return new Promise((done) => {
                let motx = new MotX({
                    store: { bean: { count: 1 } }
                })
                let i = 0
                motx.subscribe('bean@change', ({ count }) => {
                    i += count
                })
                motx.setState('bean', { count: 2 }, true, true)
                i === 0 && done()
            })
        })
    })
    describe('pipes & onReceive & name', () => {
        let toDespose = []

        afterEach(() => {
            toDespose.forEach((item) => {
                item.dispose()
            })
            toDespose = []
        })

        it('Pipe.publish', () => {
            return new Promise((done) => {
                let motx = new MotX({
                    pipes: {
                        ns1(stringifyed) {
                            const { channel, args } = JSON.parse(stringifyed)
                            channel === 'channel' && args.length === 0 && done()
                        }
                    }
                })
                motx.pipe('ns1').publish('channel')
                toDespose.push(motx)
            })
        })

        it('onReceive', () => {
            return new Promise((done) => {
                let motx = new MotX({
                    channels: ['channel']
                })
                motx.subscribe('channel', (arg1, arg2) => {
                    arg1 === 1 && arg2 === 2 && done()
                })
                motx.onReceive('{"channel":"channel","args":[1,2]}')
                toDespose.push(motx)
            })
        })

        it('pipes *', () => {
            return new Promise((done) => {
                let isOk = 0
                let motx1 = new MotX({
                    name: 'motx1',
                    channels: ['channel'],
                    pipes: {
                        ns1(stringifyed) {
                            const { channel, args } = JSON.parse(stringifyed)
                            if (
                                channel === 'channel' &&
                                args[0] === 1 &&
                                args[1] === 2
                            ) {
                                isOk++
                                if (isOk === 3) {
                                    done()
                                }
                            }
                        },
                        ns2(stringifyed) {
                            const { channel, args } = JSON.parse(stringifyed)
                            if (
                                channel === 'channel' &&
                                args[0] === 1 &&
                                args[1] === 2
                            ) {
                                isOk++
                                if (isOk === 3) {
                                    done()
                                }
                            }
                        }
                    }
                })
                let motx2 = new MotX({
                    name: 'motx2',
                    channels: ['channel']
                })
                motx2.subscribe('channel', (arg1, arg2) => {
                    if (arg1 === 1 && arg2 === 2) {
                        isOk++
                        if (isOk === 3) {
                            done()
                        }
                    }
                })
                motx1.pipe('*').publish('channel', 1, 2)

                toDespose.push(motx1, motx2)
            })
        })

        it('pipes !ns2,motx1', () => {
            return new Promise((done) => {
                let isOk = 0
                let motx1 = new MotX({
                    name: 'motx1',
                    channels: ['channel'],
                    pipes: {
                        ns1(stringifyed) {
                            const { channel, args } = JSON.parse(stringifyed)
                            if (
                                channel === 'channel' &&
                                args[0] === 1 &&
                                args[1] === 2
                            ) {
                                isOk++
                                setTimeout(() => {
                                    if (isOk === 2) {
                                        done()
                                    }
                                }, 10)
                            }
                        },
                        ns2(stringifyed) {
                            const { channel, args } = JSON.parse(stringifyed)
                            if (
                                channel === 'channel' &&
                                args[0] === 1 &&
                                args[1] === 2
                            ) {
                                throw new Error('Error in !ns2,motx1')
                            }
                        }
                    }
                })
                let motx2 = new MotX({
                    name: 'motx2',
                    channels: ['channel']
                })

                motx2.subscribe('channel', (arg1, arg2) => {
                    if (arg1 === 1 && arg2 === 2) {
                        isOk++
                        setTimeout(() => {
                            if (isOk === 2) {
                                done()
                            }
                        }, 10)
                    }
                })
                motx1.subscribe('channel', (arg1, arg2) => {
                    if (arg1 === 1 && arg2 === 2) {
                        throw new Error('Error in !ns2,motx1')
                    }
                })
                motx1.pipe('!ns2,motx1').publish('channel', 1, 2)

                toDespose.push(motx1, motx2)
            })
        })

        it('pipes ns2,motx1', () => {
            return new Promise((done) => {
                let isOk = 0
                let motx1 = new MotX({
                    name: 'motx1',
                    channels: ['channel'],
                    pipes: {
                        ns1(stringifyed) {
                            const { channel, args } = JSON.parse(stringifyed)
                            if (
                                channel === 'channel' &&
                                args[0] === 1 &&
                                args[1] === 2
                            ) {
                                isOk++
                                setTimeout(() => {
                                    if (isOk === 2) {
                                        done()
                                    }
                                }, 10)
                            }
                        },
                        ns2(stringifyed) {
                            const { channel, args } = JSON.parse(stringifyed)
                            if (
                                channel === 'channel' &&
                                args[0] === 1 &&
                                args[1] === 2
                            ) {
                                throw new Error('Error in !ns2,motx1')
                            }
                        }
                    }
                })
                let motx2 = new MotX({
                    name: 'motx2',
                    channels: ['channel']
                })

                motx2.subscribe('channel', (arg1, arg2) => {
                    if (arg1 === 1 && arg2 === 2) {
                        isOk++
                        setTimeout(() => {
                            if (isOk === 2) {
                                done()
                            }
                        }, 10)
                    }
                })
                motx1.subscribe('channel', (arg1, arg2) => {
                    if (arg1 === 1 && arg2 === 2) {
                        throw new Error('Error in !ns2,motx1')
                    }
                })
                motx1.pipe('ns1,motx2').publish('channel', 1, 2)

                toDespose.push(motx1, motx2)
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
                motx.publish('setState:fvck', [100])
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
                motx.subscribe('fvck@change', (data) => {
                    i += data
                })
                motx.publish('setState:fvck', [100])
                i === 100 && done()
            })
        })

        it('will not', () => {
            return new Promise((done) => {
                let i = 0
                motx.subscribe('fvck@change', () => {
                    i++
                })
                motx.publish('setState:fvck', [])
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
                channels: ['channel'],
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
    describe('hooks.didPublish', () => {
        it('did', () => {
            let i = 0
            let motx = new MotX({
                store: {
                    fvck: false
                },
                channels: ['channel'],
                hooks: {
                    didPublish(channel, [count]) {
                        i += count
                    }
                }
            })
            return new Promise((done) => {
                motx.subscribe('channel', (count) => {
                    i += count
                })
                motx.publish('channel', 100)
                i === 200 && done()
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
                },
                channels: ['channel']
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
        it('publish(setState:fvck, true)', () => {
            return new Promise((done) => {
                motx.subscribe('fvck@change', (data) => {
                    data === true && done()
                })
                motx.publish('setState:fvck', true)
            })
        })
        it('publish newState & oldState', () => {
            return new Promise((done) => {
                let motx = new MotX({
                    store: { bean: { count: 10 } }
                })
                let i = 1
                motx.subscribe('bean@change', (newState, oldState) => {
                    i += newState.count + oldState.count
                })
                motx.publish('setState:bean', { count: 100 })
                i === 111 && done()
            })
        })

        it('publish(setState:bean, {name})', () => {
            return new Promise((done) => {
                motx.subscribe('bean@change', (data) => {
                    data.name === 'bean' &&
                        typeof data.count === 'undefined' &&
                        done()
                })
                motx.publish('setState:bean', { name: 'bean' })
            })
        })
    })
})
