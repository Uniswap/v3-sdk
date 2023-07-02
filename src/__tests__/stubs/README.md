# Automatic Swap Tests

The test framework includes a test runner that runs a given set of tests and validates expected outputs. Below you can see the expected format of the stub files.

## Swap Stub Format

To automatically generate new test cases for a given pool, `scripts/generate-swap-tests.js` in this repository can be used.

Example Usage:

```bash
node scripts/generate-swap-tests.js -P https://mainnet.chainnodes.org/api_key -p 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640 -n 100 --reversed
```

`--reversed` is optional and sets `zeroForOne` to false, which is true by default.

You can generate test cases from any chain with Uniswap V3 pools.
Just pass the correct provider to `-P`. You can get a free RPC URL for this at [Chainnodes](https://www.chainnodes.org/).
And of course a correct pool for the network you are in for `-p`.
If the Diamond API doesn't support the given network, we will fallback to RPC calls, which is less accurate and slower.

The following JSON format is used for tests:

```JSON
{
  "poolName": "USDC - WETH 0.05%",
  "ticks": [
    {
      "index": 1,
      "liquidityGross": "1234",
      "liquidityNet": "123"
    }
  ],
  "tokenA": {
    "chainId": 1,
    "address": "0x...",
    "decimals": 18
  },
  "tokenB": {
    "chainId": 1,
    "address": "0x...",
    "decimals": 18
  },
  "fee": 100,
  "sqrtRatioX96": "123456",
  "liquidity": "123456789",
  "tickCurrent": 15,
  "tests": [
    {
      "amountSpecified": "12345678",
      "exactInput": true,
      "expectedAmountCalculated": "123456789"
    }
  ]
}
```

You can add any number of files and include any number of tests. Filenames are not relevant. `poolName` is used to identify failing tests.

Files for swap tests are added to the `src/__tests___/stubs/swap/` directory.
