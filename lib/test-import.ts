import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { wrapCallSite, type CallSite } from 'source-map-support'

const path = process.env.RIDDANCE_SUB_PROJECT_URL
    ? fileURLToPath(process.env.RIDDANCE_SUB_PROJECT_URL)
    : process.cwd()
Error.prepareStackTrace = (error, stack) => {
    const name = error.name ?? 'Error'
    const message = error.message ?? ''
    const errorString = `${name}: ${message}`

    const state = { nextPosition: null, curPosition: null }
    const newLine = '\n    at '
    const processedStack: string[] = []
    stack.toReversed().forEach(inner => {
        const wrapped = wrapCallSite(inner as CallSite, state)
        const innerSourceUrl = wrapped.getScriptNameOrSourceURL?.bind(wrapped)
        if (wrapped !== inner && innerSourceUrl) {
            wrapped.getScriptNameOrSourceURL = function () {
                const original = innerSourceUrl()
                if (original.startsWith('file://')) {
                    return relative(path, fileURLToPath(original))
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
