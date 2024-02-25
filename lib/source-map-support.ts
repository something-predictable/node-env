import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { install, wrapCallSite } from 'source-map-support'

install({
    environment: 'node',
    hookRequire: false,
})

if (!process.env['STACK_TRACE_FULL_PATH']) {
    const cwd = process.cwd()
    Error.prepareStackTrace = (error, stack) => {
        const name = error.name ?? 'Error'
        const message = error.message ?? ''
        const errorString = `${name}: ${message}`

        const state = { nextPosition: null, curPosition: null }
        const newLine = '\n    at '
        const processedStack: string[] = []
        ;[...stack].reverse().forEach(inner => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
            const wrapped = wrapCallSite(inner as any, state)
            const innerSourceUrl = wrapped.getScriptNameOrSourceURL?.bind(wrapped)
            if (wrapped !== inner && innerSourceUrl) {
                wrapped.getScriptNameOrSourceURL = function () {
                    const original = innerSourceUrl()
                    if (original.startsWith('file://')) {
                        return relative(cwd, fileURLToPath(original))
                    }
                    return original
                }
            }
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            processedStack.push(wrapped.toString())
            state.nextPosition = state.curPosition
        })
        state.curPosition = state.nextPosition = null
        return `${errorString}${newLine}${processedStack.reverse().join(newLine)}`
    }
}
