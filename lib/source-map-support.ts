import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { install, wrapCallSite } from 'source-map-support'

install({
    environment: 'node',
    hookRequire: false,
})

if (!process.env['STACK_TRACE_FULL_PATH']) {
    Error.prepareStackTrace = (error, stack) => {
        const cwd = process.cwd()
        const name = error.name ?? 'Error'
        const message = error.message ?? ''
        const errorString = `${name}: ${message}`

        const state = { nextPosition: null, curPosition: null }
        const newLine = '\n    at '
        const processedStack = []
        for (let i = stack.length - 1; i >= 0; i--) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
            const cs = wrapCallSite(stack[i] as any, state)
            // eslint-disable-next-line @typescript-eslint/unbound-method
            const inner = cs.getScriptNameOrSourceURL
            if (inner) {
                cs.getScriptNameOrSourceURL = () => {
                    const original = inner.call(cs)
                    if (original.startsWith('file://')) {
                        return relative(cwd, fileURLToPath(original))
                    }
                    return original
                }
            }
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            processedStack.push(cs.toString())
            state.nextPosition = state.curPosition
        }
        state.curPosition = state.nextPosition = null
        return `${errorString}${newLine}${processedStack.reverse().join(newLine)}`
    }
}
