import invariant from 'tiny-invariant'

import { ChainId, Currency, ETHER, Token, WETH9 } from '@uniswap/sdk-core'
import { Pool } from './pool'

export class Route {
  public readonly pools: Pool[]
  public readonly tokenPath: Token[]
  public readonly input: Currency
  public readonly output: Currency

  public constructor(pools: Pool[], input: Currency, output?: Currency) {
    invariant(pools.length > 0, 'POOLS: none provided')

    const chainId = pools[0].chainId
    const allOnSameChain = pools.every(pool => pool.chainId === chainId)
    invariant(allOnSameChain, 'CHAIN_IDS: must be the same for all pools')

    const weth: Token | undefined = WETH9[chainId as ChainId]

    const inputTokenIsInFirstPool = input instanceof Token && pools[0].involvesToken(input)
    const inputWethIsInFirstPool = input === ETHER && weth && pools[0].involvesToken(weth)
    const inputIsValid = inputTokenIsInFirstPool || inputWethIsInFirstPool
    invariant(inputIsValid, 'INPUT: not in first pool')

    const noOutput = typeof output === 'undefined'
    const outputTokenIsInLastPool = output instanceof Token && pools[pools.length - 1].involvesToken(output)
    const outputWethIsInLastPool = output === ETHER && weth && pools[pools.length - 1].involvesToken(weth)
    const outputIsValid = noOutput || outputTokenIsInLastPool || outputWethIsInLastPool
    invariant(outputIsValid, 'OUTPUT: not in last pool')

    /**
     * Normalizes token0-token1 order and selects the next token/fee step to add to the path
     * */
    const tokenPath: Token[] = [input instanceof Token ? input : weth]
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

  public get chainId(): ChainId | number {
    return this.pools[0].chainId
  }
}
