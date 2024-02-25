export type Reporter = {
    status(text: string): void
    error(message: string, file?: string, line?: number, column?: number): void
    fatal(message: string, error: unknown, file?: string): void
    done(): void
}

export function signaled(inner: Reporter, signal: AbortSignal) {
    return {
        status: (message: string) => {
            if (signal.aborted) {
                return
            }
            inner.status(message)
        },
        error: (message: string, file?: string, line?: number, column?: number) => {
            if (signal.aborted) {
                return
            }
            inner.error(message, file, line, column)
        },
        fatal: (message: string, error: unknown, file?: string) => {
            if (signal.aborted) {
                return
            }
            inner.fatal(message, error, file)
        },
        done: () => {
            if (signal.aborted) {
                return
            }
            inner.done()
        },
    }
}
