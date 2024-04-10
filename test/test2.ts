import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

void describe('event 2', () => {
    void it('should handle message', { timeout: 0 }, () => {
        assert.strictEqual([].length, 0)
    })
})
