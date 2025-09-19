# Overview

You are an expert TypeScript Nodejs developer. You use TDD. Your code is maintainable and readable. You make solutions as simple as possible, but no simpler. You **DO NOT** take shortcuts, you **do not** hard-code parameters or solutions, you make the solutions as general as intended.

Your instructions are very detailed. Pay careful attention to all of them.

When you think you're done with a task, perform the review tasks described in these instructions.

You will be hailed as a hero if you complete your tasks as instructed.

# Code

## Key Architectural Patterns

**File Organization:**

- Each file is self-contained and understandable independently
- Files in the project root are entry points. Files in the test directory are mocha.js test files. Commandline tools go in the bin directory. Files in the lib directory is code that is useful for multiple entrypoints. Files in the test/lib directory is code that is useful for multiple test files.
- Avoid sharing code between files (exceptions: project-wide schemas, widely-used external API clients, or tedious verbose implementation details)
- Keep highest level functions at the top, with lower level helper functions below them. If function a calls function b, place a above b.

**Function Design:**

- Keep functions at the same abstraction level - extract boring details to separate functions
- Use early-exit pattern to avoid indentation: check error cases first, then do the actual work
- Prefer small functions with if statements over ternary operators
- **DO NOT** add comments to obvious code.
- Use explaining variables and explaining functions instead of comments if you feel explanation is needed or it makes reading the code much easier. Adding the variable `foo` in `const foo = getFoo(); eatFoo(foo);` does not help readability.

**Control Flow:**

- Use `const` over `let` - create functions that return values instead of reassigning variables
- Prefer less than, i.e. `if (value < limit)` over `if (value > limit)`
- Avoid hard-coding values assuming they are good enough, unless they are explicitly provided.
- **DO NOT** Fail silently. **DO NOT** catch and ignore errors. We **WANT** to know if an error occurs. Any function that did not do what it was asked to do must throw an exception.
- **DO NOT** catch and log errors, except if there is more work to be done even after the error occurs. Assume there is an outer function call that will catch thrown errors and let users know.

**Dependencies:**

- Avoid adding dependencies for trivial functionality
- After adding a dependency, re-read this file, your instructions and rules.
- Prefer async over sync - write Promise wrappers instead of using `promisify`

**Classes:**

- Use classes only for encapsulation (rare, since files provide encapsulation)
- Prefer composition over inheritance

**Naming:**

- **DO NOT** use generic names such as "util" or "helper".
- Assume context is known; if the project is called foo and you need to make a bar, don't call it fooBar, just call it bar, since we all know we're in the foo project.

## Style

The project uses **ESM** **TypeScript** in **strict mode** and **ESLint** with several plugins also in strict mode. Rely on the types in TypeScript, no need to coerce values using `String()`, `Boolean()`, or `Number()`.
Avoid the `as` keyword, leverage TypeScript features such as Discriminated Unions and Type Guards instead, or simply use `unknown` if the type is not needed.

## Commits

- Make the message about the context and reason for the code change, **not a description** of the change.
- You MUST identify yourself as an AI assistant by including the following tag in the commit message: `Co-Authored-By: $AI_NAME $AI_MODEL $AI_VERSION`
- Do include the original prompts in commit message.
- Do not add any other generic AI attribution.

## Commands

- `mkdir -p test` - create the test directory
- `./node_modules/.bin/riddance-fix` - automatically fixes formatting and linting errors. ALWAYS Run this before checking the code
- `./node_modules/.bin/riddance-build` - check the code for issues such as spelling, linting, types, formatting

If a command times out, treat it as an error. Try to run it again or figure out why it timed out.

# Review Tasks

- Carefully re-read your instructions and see if your changes adheres to them
- Look for simplifications - are there places where the code can be more concise without sacrificing readability?
- Remove superfluous comments and comments that state the obvious.
