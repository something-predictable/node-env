import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'

describe('event 2', () => {
    it('should handle message', async () => {
        await setTimeout(10)
        assert.strictEqual([].length, 0)
    })
})
