import assert from 'node:assert/strict'
import { list } from './lib/data.js'

describe('event 1', () => {
    it('should handle message', () => {
        const x: any = 3
        assert.strictEqual(x?.y, undefined)
        assert.strictEqual(x, 3)
        assert.strictEqual(list.length, 0)
    })
})
