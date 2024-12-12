import js from '@eslint/js'
import node from 'eslint-plugin-n'
import arrow from 'eslint-plugin-prefer-arrow-functions'
import promise from 'eslint-plugin-promise'
import unicorn from 'eslint-plugin-unicorn'
import globals from 'globals'
import ts from 'typescript-eslint'

export function configuration(dir: string) {
    return [
        {
            ignores: ['**/eslint.config.mjs', '**/*.js', '**/*.d.ts', 'node_modules/**'],
        },
        ...ts.config(
            {
                languageOptions: {
                    sourceType: 'module',
                    ecmaVersion: 2023,
                    globals: globals.node,
                    parserOptions: {
                        projectService: true,
                        tsconfigRootDir: dir,
                    },
                },
            },
            js.configs.recommended,
            {
                rules: {
                    'no-console': 'error',
                    'no-debugger': 'error',
                    'no-promise-executor-return': 'error',
                    'no-self-compare': 'error',
                    'no-template-curly-in-string': 'error',
                    'no-unmodified-loop-condition': 'error',
                    'no-unreachable-loop': 'error',
                    'no-unused-private-class-members': 'error',
                    'require-atomic-updates': 'error',
                    'guard-for-in': 'error',
                    'no-eval': 'error',
                    'no-new-wrappers': 'error',
                    'object-shorthand': 'error',
                    'one-var': ['error', 'never'],
                    radix: 'error',
                    'valid-typeof': 'off',
                    camelcase: 'error',
                    'consistent-this': ['error', 'self'],
                    curly: 'error',
                    'default-case-last': 'error',
                    eqeqeq: 'error',
                    'no-alert': 'error',
                    'no-object-constructor': 'error',
                    'no-array-constructor': 'error',
                    'new-cap': 'error',
                    'no-bitwise': 'error',
                    'no-delete-var': 'error',

                    'no-implicit-coercion': [
                        'error',
                        {
                            allow: ['!!'],
                        },
                    ],

                    'no-return-assign': 'error',
                    'no-sequences': 'error',
                    'no-shadow': 'error',
                    'no-undef-init': 'error',
                    'no-unneeded-ternary': 'error',
                    'no-unused-expressions': 'error',
                    'no-useless-call': 'error',
                    'no-useless-catch': 'error',
                    'no-useless-computed-key': 'error',
                    'no-useless-constructor': 'error',
                    'no-useless-escape': 'error',
                    'no-useless-backreference': 'error',
                    'no-useless-rename': 'error',
                    'no-useless-return': 'error',
                    'no-var': 'error',
                    'no-void': 'error',
                    'prefer-arrow-callback': 'error',
                    'prefer-const': 'error',
                    'prefer-destructuring': 'error',
                    'prefer-numeric-literals': 'error',
                    'prefer-object-has-own': 'error',
                    'prefer-object-spread': 'error',
                    'prefer-promise-reject-errors': ['error', { allowThrowingUnknown: true }],
                    'prefer-regex-literals': 'error',
                    'prefer-rest-params': 'error',
                    'prefer-spread': 'error',
                    'require-await': 'error',
                    'require-unicode-regexp': 'error',
                    yoda: 'error',
                    'no-restricted-imports': [
                        'error',
                        {
                            paths: [
                                {
                                    name: 'assert',
                                    message: 'Please use node:assert/strict instead.',
                                },
                                {
                                    name: 'assert/strict',
                                    message: 'Please use node:assert/strict instead.',
                                },
                                {
                                    name: 'node:assert',
                                    message: 'Please use node:assert/strict instead.',
                                },
                                {
                                    name: 'async_hooks',
                                    message: 'Please use node:async_hooks instead.',
                                },
                                {
                                    name: 'buffer',
                                    message: 'Please use node:buffer instead.',
                                },
                                {
                                    name: 'child_process',
                                    message: 'Please use node:child_process instead.',
                                },
                                {
                                    name: 'cluster',
                                    message: 'Please use node:cluster instead.',
                                },
                                {
                                    name: 'console',
                                    message: 'Please use node:console instead.',
                                },
                                {
                                    name: 'constants',
                                    message:
                                        'Please use constants property exposed by the relevant module instead.',
                                },
                                {
                                    name: 'node:constants',
                                    message:
                                        'Please use constants property exposed by the relevant module instead.',
                                },
                                {
                                    name: 'crypto',
                                    message: 'Please use node:crypto instead.',
                                },
                                {
                                    name: 'dgram',
                                    message: 'Please use node:dgram instead.',
                                },
                                {
                                    name: 'diagnostics_channel',
                                    message: 'Please use node:diagnostics_channel instead.',
                                },
                                {
                                    name: 'dns',
                                    message: 'Please use node:dns/promise instead.',
                                },
                                {
                                    name: 'dns/promises',
                                    message: 'Please use node:dns/promises instead.',
                                },
                                {
                                    name: 'node:dns',
                                    message: 'Please use node:dns/promises instead.',
                                },
                                {
                                    name: 'domains',
                                    message: 'Module is pending deprecation.',
                                },
                                {
                                    name: 'node:domains',
                                    message: 'Module is pending deprecation.',
                                },
                                {
                                    name: 'events',
                                    message: 'Please use node:events instead.',
                                },
                                {
                                    name: 'fs',
                                    message: 'Please use node:fs/promises instead.',
                                },
                                {
                                    name: 'node:fs',
                                    message: 'Please use node:fs/promises instead.',
                                },
                                {
                                    name: 'fs/promises',
                                    message: 'Please use node:fs/promises instead.',
                                },
                                {
                                    name: 'os',
                                    message: 'Please use node:os instead.',
                                },
                                {
                                    name: 'http',
                                    message: 'Please use node:http instead.',
                                },
                                {
                                    name: 'http2',
                                    message: 'Please use node:https instead.',
                                },
                                {
                                    name: 'https',
                                    message: 'Please use node:http2 instead.',
                                },
                                {
                                    name: 'path',
                                    message: 'Please use node:path instead.',
                                },
                                {
                                    name: 'process',
                                    message: 'Please use node:process instead.',
                                },
                                {
                                    name: 'readline',
                                    message: 'Please use node:readline/promises instead.',
                                },
                                {
                                    name: 'readline/promises',
                                    message: 'Please use node:readline/promises instead.',
                                },
                                {
                                    name: 'node:readline',
                                    message: 'Please use node:readline/promises instead.',
                                },
                                {
                                    name: 'stream',
                                    message: 'Please use node:stream/promises instead.',
                                },
                                {
                                    name: 'stream/promises',
                                    message: 'Please use node:stream/promises instead.',
                                },
                                {
                                    name: 'node:stream',
                                    message: 'Please use node:stream/promises instead.',
                                },
                                {
                                    name: 'node:stream/web',
                                    message: 'This module is experimental.',
                                },
                                {
                                    name: 'timers',
                                    message: 'Please use node:timers/promises instead.',
                                },
                                {
                                    name: 'timers/promises',
                                    message: 'Please use node:timers/promises instead.',
                                },
                                {
                                    name: 'node:timers',
                                    message: 'Please use node:timers/promises instead.',
                                },
                                {
                                    name: 'querystring',
                                    message: 'Please use URLSearchParams API instead.',
                                },
                                {
                                    name: 'url',
                                    message: 'Please use node:url instead.',
                                },
                                {
                                    name: 'util',
                                    message: 'Please use node:util instead.',
                                },
                                {
                                    name: 'wasi',
                                    message: 'This module is experimental.',
                                },
                                {
                                    name: 'node:wasi',
                                    message: 'This module is experimental.',
                                },
                                {
                                    name: 'zlib',
                                    message: 'Please use node:zlib instead.',
                                },
                            ],
                        },
                    ],
                },
            },
            promise.configs['flat/recommended'],
            {
                plugins: {
                    'prefer-arrow': arrow,
                },
                rules: {
                    'prefer-arrow/prefer-arrow-functions': [
                        'error',
                        { allowNamedFunctions: true, singleReturnOnly: true },
                    ],
                },
            },
            ...ts.configs.strictTypeChecked,
            ...ts.configs.stylisticTypeChecked,
            {
                rules: {
                    '@typescript-eslint/restrict-template-expressions': [
                        'error',
                        {
                            allowAny: false,
                            allowBoolean: false,
                            allowNullish: false,
                            allowNumber: true,
                            allowRegExp: false,
                            allowNever: false,
                        },
                    ],
                    '@typescript-eslint/prefer-readonly': 'error',
                    '@typescript-eslint/no-restricted-types': [
                        'error',
                        {
                            types: {
                                Object: {
                                    message:
                                        'Avoid using the `Object` type. Did you mean `object`?',
                                },
                                Function: {
                                    message:
                                        'Avoid using the `Function` type. Prefer a specific function type, like `() => void`.',
                                },
                                Boolean: {
                                    message:
                                        'Avoid using the `Boolean` type. Did you mean `boolean`?',
                                },
                                Number: {
                                    message:
                                        'Avoid using the `Number` type. Did you mean `number`?',
                                },
                                String: {
                                    message:
                                        'Avoid using the `String` type. Did you mean `string`?',
                                },
                                Symbol: {
                                    message:
                                        'Avoid using the `Symbol` type. Did you mean `symbol`?',
                                },
                            },
                        },
                    ],
                    '@typescript-eslint/no-invalid-void-type': 'off',
                    '@typescript-eslint/no-unused-vars': 'off',
                    '@typescript-eslint/no-dynamic-delete': 'off',
                    '@typescript-eslint/consistent-indexed-object-style': [
                        'error',
                        'index-signature',
                    ],
                    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
                    '@typescript-eslint/prefer-nullish-coalescing': 'error',
                },
            },
            node.configs['flat/recommended-module'],
            {
                rules: {
                    'n/no-process-exit': 'off',
                    'n/hashbang': 'off',
                    'n/no-missing-import': 'off',
                    'n/no-unpublished-import': 'off',
                    'n/no-deprecated-api': ['error'],
                    'n/prefer-global/buffer': 'error',
                    'n/prefer-global/console': 'error',
                    'n/prefer-global/process': 'error',
                    'n/prefer-global/text-decoder': 'error',
                    'n/prefer-global/text-encoder': 'error',
                    'n/prefer-global/url-search-params': 'error',
                    'n/prefer-global/url': 'error',
                    'n/prefer-promises/dns': 'error',
                    'n/prefer-promises/fs': 'error',
                    'n/no-unsupported-features/es-builtins': 'off',
                    'n/no-unsupported-features/es-syntax': 'off',
                    'n/no-unsupported-features/node-builtins': 'off',
                    'n/file-extension-in-import': 'off',
                    'n/no-extraneous-import': 'off',
                },
            },
            unicorn.configs['flat/all'],
            {
                rules: {
                    'unicorn/no-array-callback-reference': 'off',
                    'unicorn/catch-error-name': 'off',
                    'unicorn/consistent-destructuring': 'off',
                    'unicorn/explicit-length-check': ['error', { 'non-zero': 'not-equal' }],
                    'unicorn/import-style': 'off',
                    'unicorn/no-array-for-each': 'off',
                    'unicorn/no-array-reduce': 'off',
                    'unicorn/no-await-expression-member': 'off',
                    'unicorn/no-keyword-prefix': 'off',
                    'unicorn/no-lonely-if': 'off',
                    'unicorn/no-useless-undefined': 'off',
                    'unicorn/number-literal-case': 'off',
                    'unicorn/prefer-string-raw': 'off',
                    'unicorn/prefer-ternary': 'off',
                    'unicorn/prevent-abbreviations': 'off',
                    'unicorn/switch-case-braces': ['error', 'avoid'],
                    'unicorn/text-encoding-identifier-case': 'off',
                    'unicorn/no-unreadable-array-destructuring': 'off',
                },
            },
            {
                files: ['test/**/*.ts', 'example/test/**/*.ts'],
                languageOptions: {
                    globals: globals.mocha,
                },
                rules: {
                    'no-debugger': 'off',
                    '@typescript-eslint/no-unsafe-return': 'off',
                    '@typescript-eslint/no-unsafe-call': 'off',
                    '@typescript-eslint/restrict-template-expressions': 'off',
                    '@typescript-eslint/restrict-plus-operands': 'off',
                    '@typescript-eslint/no-unsafe-assignment': 'off',
                    '@typescript-eslint/no-explicit-any': 'off',
                    '@typescript-eslint/no-unsafe-argument': 'off',
                    '@typescript-eslint/no-unsafe-member-access': 'off',
                },
            },
            {
                files: ['bin/**/*.ts'],
                rules: {
                    'no-console': 'off',
                    'no-process-exit': 'off',
                    '@typescript-eslint/restrict-template-expressions': [
                        'error',
                        {
                            allowBoolean: true,
                            allowNumber: true,
                        },
                    ],
                    'n/no-unpublished-bin': 'error',
                    'unicorn/no-process-exit': 'off',
                },
            },
        ),
    ]
}
