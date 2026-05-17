import assert from 'node:assert/strict'
import json from './data/data.json' with { type: 'json' }
import { list } from './lib/data.js'

describe('event 1', () => {
    it('should handle message', async () => {
        await using _ = asyncDisposable
        const x: any = 3
        assert.strictEqual(x?.y, undefined)
        assert.strictEqual(x, 3)
        assert.strictEqual(list.length, 1)
        assert.deepStrictEqual(list, json)
    })
})

const asyncDisposable = {
    [Symbol.asyncDispose]: () => Promise.resolve(),
}
