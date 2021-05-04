import invariant from 'tiny-invariant'

import { ChainId, Currency, ETHER, Price, Token, WETH9 } from '@uniswap/sdk-core'
import { Pool } from './pool'

/**
 * Represents a list of pools through which a swap can occur
 */
export class Route {
  public readonly pools: Pool[]
  public readonly tokenPath: Token[]
  public readonly input: Currency
  public readonly output: Currency

  private _midPrice: Price | null = null

  public constructor(pools: Pool[], input: Currency, output?: Currency) {
    invariant(pools.length > 0, 'POOLS')

    const chainId = pools[0].chainId
    const allOnSameChain = pools.every(pool => pool.chainId === chainId)
    invariant(allOnSameChain, 'CHAIN_IDS')

    const weth: Token | undefined = WETH9[chainId as ChainId]

    const inputTokenIsInFirstPool = input instanceof Token && pools[0].involvesToken(input)
    const inputWethIsInFirstPool = input === ETHER && weth && pools[0].involvesToken(weth)
    const inputIsValid = inputTokenIsInFirstPool || inputWethIsInFirstPool
    invariant(inputIsValid, 'INPUT')

    const noOutput = typeof output === 'undefined'
    const outputTokenIsInLastPool = output instanceof Token && pools[pools.length - 1].involvesToken(output)
    const outputWethIsInLastPool = output === ETHER && weth && pools[pools.length - 1].involvesToken(weth)
    const outputIsValid = noOutput || outputTokenIsInLastPool || outputWethIsInLastPool
    invariant(outputIsValid, 'OUTPUT')

    /**
     * Normalizes token0-token1 order and selects the next token/fee step to add to the path
     * */
    const tokenPath: Token[] = [input instanceof Token ? input : weth]
    for (const [i, pool] of pools.entries()) {
      const currentInputToken = tokenPath[i]
      invariant(currentInputToken.equals(pool.token0) || currentInputToken.equals(pool.token1), 'PATH')
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

  /**
   * Returns the token representation of the input currency. If the input currency is Ether, returns the wrapped ether token.
   */
  public get inputToken(): Token {
    if (this.input instanceof Token) return this.input
    invariant(this.input === Currency.ETHER, 'ETHER')
    return WETH9[this.chainId as ChainId]
  }

  /**
   * Returns the token representation of the output currency. If the output currency is Ether, returns the wrapped ether token.
   */
  public get outputToken(): Token {
    if (this.output instanceof Token) return this.output
    invariant(this.output === Currency.ETHER, 'ETHER')
    return WETH9[this.chainId as ChainId]
  }

  /**
   * Returns the mid price of the route
   */
  public get midPrice(): Price {
    if (this._midPrice !== null) return this._midPrice

    const price = this.pools.slice(1).reduce(
      ({ nextInput, price }, pool) => {
        return nextInput.equals(pool.token0)
          ? {
              nextInput: pool.token1,
              price: price.multiply(pool.token0Price)
            }
          : {
              nextInput: pool.token0,
              price: price.multiply(pool.token1Price)
            }
      },
      this.pools[0].token0.equals(this.inputToken)
        ? {
            nextInput: this.pools[0].token1,
            price: this.pools[0].token0Price
          }
        : {
            nextInput: this.pools[0].token0,
            price: this.pools[0].token1Price
          }
    ).price

    return (this._midPrice = new Price(this.input, this.output, price.denominator, price.numerator))
  }
}
