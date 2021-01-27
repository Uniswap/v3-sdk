# Uniswap V3 SDK

[![Unit Tests](https://github.com/Uniswap/uniswap-v3-sdk/workflows/Unit%20Tests/badge.svg)](https://github.com/Uniswap/uniswap-v3-sdk/actions?query=workflow%3A%22Unit+Tests%22)
[![Lint](https://github.com/Uniswap/uniswap-v3-sdk/workflows/Lint/badge.svg)](https://github.com/Uniswap/uniswap-v3-sdk/actions?query=workflow%3ALint)
[![npm version](https://img.shields.io/npm/v/@uniswap/v3-sdk/latest.svg)](https://www.npmjs.com/package/@uniswap/v3-sdk/v/latest)
[![npm bundle size (scoped version)](https://img.shields.io/bundlephobia/minzip/@uniswap/v3-sdk/latest.svg)](https://bundlephobia.com/result?p=@uniswap/v3-sdk@latest)

In-depth documentation on this SDK is available at [uniswap.org](https://uniswap.org/docs/v3/SDK/getting-started/).

## Running tests

To run the tests, follow these steps. You must have at least node v10 and [yarn](https://yarnpkg.com/) installed.

First clone the repository:

```sh
git clone https://github.com/Uniswap/uniswap-v3-sdk.git
```

Move into the `uniswap-v3-sdk` working directory

```sh
cd uniswap-v3-sdk/
```

Install dependencies

```sh
yarn
```

Run tests

```sh
yarn test
```

You should see output like the following:

```sh
yarn run v1.22.4
$ tsdx test
 PASS  test/constants.test.ts
 PASS  test/pair.test.ts
 PASS  test/fraction.test.ts
 PASS  test/miscellaneous.test.ts
 PASS  test/entities.test.ts
 PASS  test/trade.test.ts

Test Suites: 1 skipped, 6 passed, 6 of 7 total
Tests:       3 skipped, 82 passed, 85 total
Snapshots:   0 total
Time:        5.091s
Ran all test suites.
✨  Done in 6.61s.
```
