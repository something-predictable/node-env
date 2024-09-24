declare module 'eslint-plugin-promise' {
    const configs: {
        ['flat/recommended']: object
    }
}

declare module 'eslint-plugin-prefer-arrow-functions' {
    const rules: {
        readonly [rule: string]: RuleEntry
    }
    const rulesConfig: object
}
