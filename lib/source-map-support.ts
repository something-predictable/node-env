/* eslint-disable unicorn/no-null */
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { install, wrapCallSite, type CallSite } from 'source-map-support'

install({
    environment: 'node',
    hookRequire: false,
})

if (!process.env.STACK_TRACE_FULL_PATH) {
    const cwd = process.env.PROJECT_DIRECTORY ?? process.cwd()
    Error.prepareStackTrace = (error, stack) => {
        const errorString = `${error.name}: ${error.message}`

        const state = { nextPosition: null, curPosition: null }
        const processedStack: string[] = []
        stack.toReversed().forEach(inner => {
            const wrapped = wrapCallSite(inner as CallSite, state) as CallSite & {
                toString: () => string
            }
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
            processedStack.push(wrapped.toString())
            state.nextPosition = state.curPosition
        })
        state.curPosition = state.nextPosition = null
        processedStack.reverse()
        const newLine = '\n    at '
        return `${errorString}${newLine}${processedStack.join(newLine)}`
    }
}
