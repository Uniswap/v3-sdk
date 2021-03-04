import invariant from 'tiny-invariant'

import { ChainId, Currency, ETHER, Token, WETH } from '@uniswap/sdk-core'
import { Pool } from './pool'

export class Route {
  public readonly pools: Pool[]
  public readonly tokenPath: Token[]
  public readonly input: Currency
  public readonly output: Currency
  // public readonly midPrice: Price

  public constructor(pools: Pool[], input: Currency, output?: Currency) {
    invariant(pools.length > 0, 'POOLS: none provided')

    const allOnSameChain = pools.every(pool => pool.chainId === pools[0].chainId)
    invariant(allOnSameChain, 'CHAIN_IDS: must be the same for all pools')

    const inputTokenIsInFirstPool = input instanceof Token && pools[0].involvesToken(input)
    const inputWethIsInFirstPool = input === ETHER && pools[0].involvesToken(WETH[pools[0].chainId])
    const inputIsValid = inputTokenIsInFirstPool || inputWethIsInFirstPool
    invariant(inputIsValid, 'INPUT: not in first pool')

    const noOutput = typeof output === 'undefined'
    const outputTokenIsInLastPool = output instanceof Token && pools[pools.length - 1].involvesToken(output)
    const outputWethIsInLastPool = output === ETHER && pools[pools.length - 1].involvesToken(WETH[pools[0].chainId])
    const outputIsValid = noOutput || outputTokenIsInLastPool || outputWethIsInLastPool
    invariant(outputIsValid, 'OUTPUT: not in last pool')

    /**
     * Normalizes token0-token1 order and selects the next token/fee step to add to the path
     * */
    const tokenPath: Token[] = [input instanceof Token ? input : WETH[pools[0].chainId]]
    for (const [i, pool] of pools.entries()) {
      const currentInputToken = tokenPath[i]
      invariant(
        currentInputToken.equals(pool.token0) || currentInputToken.equals(pool.token1),
        'PATH: token is not in the next pool'
      )
      const nextToken = currentInputToken.equals(pool.token0) ? pool.token1 : pool.token0
      tokenPath.push(nextToken)
    }

    this.pools = pools
    this.tokenPath = tokenPath
    this.input = input
    this.output = output ?? tokenPath[tokenPath.length - 1]
  }

  public get chainId(): ChainId {
    return this.pools[0].chainId
  }
}
