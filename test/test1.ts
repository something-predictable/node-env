import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { list } from './lib/data.js'

void describe('event 1', () => {
    void it('should handle message', () => {
        const x = 3
        assert.strictEqual(x, 3)
        assert.strictEqual(list.length, 0)
    })
})
