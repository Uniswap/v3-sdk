import { POOL_INIT_CODE_HASH, POOL_INIT_CODE_HASH_OPTIMISM } from './constants'

import { bytecode } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import { bytecode as SwapRouterBytecode } from '@uniswap/v3-periphery-optimism/artifacts-ovm/contracts/SwapRouter.sol/SwapRouter.json'
import { keccak256 } from '@ethersproject/solidity'

// this _could_ go in constants, except that it would cost every consumer of the sdk the CPU to compute the hash
// and load the JSON.
const COMPUTED_INIT_CODE_HASH = keccak256(['bytes'], [bytecode])

describe('constants', () => {
  describe('INIT_CODE_HASH', () => {
    it('matches computed bytecode hash', () => {
      expect(COMPUTED_INIT_CODE_HASH).toEqual(POOL_INIT_CODE_HASH)
    })

    it('optimism', () => {
      // bit of a hack, but the SwapRouter consumes the PoolAddress library, which contains the bytecode hash...
      // we can't get it from core because the hash depends on library addresses
      expect(SwapRouterBytecode).toMatch(new RegExp(`.*${POOL_INIT_CODE_HASH_OPTIMISM.slice(2)}.*`))
    })
  })
})
