const MotX = require('../dist').default
describe('autorun', () => {
    it('autorun init run', () => {
        return new Promise((done) => {
            let motx = new MotX({
                store: { list: [] }
            })
            motx.autorun((state, isIntRun) => {
                const list = state.list
                if (isIntRun) {
                    done()
                }
            })
        })
    })

    it('autorun auto run and throttle', () => {
        return new Promise((done) => {
            let motx = new MotX({
                store: { list: [], count: 0 }
            })
            let run = 0
            motx.autorun(({ list, count }, isIntRun) => {
                run++
                setTimeout(() => {
                    if (run == 2) {
                        done()
                    }
                }, 10)
            })
            motx.setState('list', [0])
            for (let i = 0; i < 10; i++) {
                motx.setState('count', 1)
            }
        })
    })

    it('autorun destroy autorun', () => {
        return new Promise((done) => {
            let motx = new MotX({
                store: { count: 0 }
            })
            let run = 0
            const destroy = motx.autorun(({ count }, isIntRun) => {
                run++
            })
            destroy()
            motx.setState('count', 1)
            setTimeout(() => {
                if (run == 1) {
                    done()
                }
            }, 10)
        })
    })
})
