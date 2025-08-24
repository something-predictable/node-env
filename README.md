# Code is a Liability

Too much code slows you down, creates risks, increases maintainability burdens, confuses AI. So let's commit less of it.

With just _one dev dependency_, you get

- **Testing** with built-in mocking support
- Strict **type checking**
- Strict **linting**
- **Formatting**
- **Spell checking**
- **LLM rules**
- customized **MCP server** (coming soon)
- Automatic **npm install**
- **IDE** setup
- **git** setup
- **Dev Container** setup
- all in a **hot-reloading** trigger-on-save setup

Using carefully curated and optimized well-established open source packages, so you don't have to commit and maintain all of that yourself. It's even opinionated, so you avoid wasting time bike-shedding.

## Get Started

Simply run

```sh
$ npm init riddance
```

Drop a `.ts` file in the directory, run

```sh
$ npm start
```

Try adding a type error, a spelling error, or some bad formatting, and see it react. Try adding a dependency to `package.json` and see it install automatically. Drop a Mocha test file in a `test` directory and see it run the tests.
