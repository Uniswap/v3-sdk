import invariant from 'tiny-invariant'
import JSBI from 'jsbi'
import { getCreate2Address } from '@ethersproject/address'
import { keccak256 } from '@ethersproject/keccak256'
import { getNetwork } from '@ethersproject/networks'
import { getDefaultProvider } from '@ethersproject/providers'
import { Contract } from '@ethersproject/contracts'

import { FACTORY_ADDRESS, INIT_CODE_HASH, ZERO, ONE, _997, _1000 } from '../constants'
import ERC20 from '../abis/ERC20.json'
import { InsufficientReservesError, InsufficientInputAmountError } from '../errors'
import { Token } from './token'
import { TokenAmount } from './fractions/tokenAmount'

let CACHE: { [token0Address: string]: { [token1Address: string]: string } } = {}

export class Exchange {
  public readonly address: string
  private readonly tokenAmounts: [TokenAmount, TokenAmount]

  static getAddress(tokenA: Token, tokenB: Token): string {
    const tokens = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA] // does safety checks

    if (CACHE?.[tokens[0].address]?.[tokens[1].address] === undefined) {
      CACHE = {
        ...CACHE,
        [tokens[0].address]: {
          ...CACHE?.[tokens[0].address],
          [tokens[1].address]: getCreate2Address(
            FACTORY_ADDRESS[tokens[0].chainId],
            keccak256(`${tokens[0].address.toLowerCase()}${tokens[1].address.slice(2).toLowerCase()}`),
            INIT_CODE_HASH
          )
        }
      }
    }

    return CACHE[tokens[0].address][tokens[1].address]
  }

  static async fetchData(
    tokenA: Token,
    tokenB: Token,
    provider = getDefaultProvider(getNetwork(tokenA.chainId))
  ): Promise<Exchange> {
    const address = Exchange.getAddress(tokenA, tokenB)
    const balances = await Promise.all([
      new Contract(tokenA.address, ERC20, provider).balanceOf(address),
      new Contract(tokenB.address, ERC20, provider).balanceOf(address)
    ])
    return new Exchange(new TokenAmount(tokenA, balances[0]), new TokenAmount(tokenB, balances[1]))
  }

  constructor(tokenAmountA: TokenAmount, tokenAmountB: TokenAmount) {
    const tokenAmounts = tokenAmountA.token.sortsBefore(tokenAmountB.token) // does safety checks
      ? [tokenAmountA, tokenAmountB]
      : [tokenAmountB, tokenAmountA]
    this.address = Exchange.getAddress(tokenAmounts[0].token, tokenAmounts[1].token)
    this.tokenAmounts = tokenAmounts as [TokenAmount, TokenAmount]
  }

  get token0(): Token {
    return this.tokenAmounts[0].token
  }

  get token1(): Token {
    return this.tokenAmounts[1].token
  }

  get reserve0(): TokenAmount {
    return this.tokenAmounts[0]
  }

  get reserve1(): TokenAmount {
    return this.tokenAmounts[1]
  }

  reserveOf(token: Token): TokenAmount {
    invariant(token.equals(this.token0) || token.equals(this.token1), 'TOKEN')
    return token.equals(this.token0) ? this.reserve0 : this.reserve1
  }

  getOutputAmount(inputAmount: TokenAmount): [TokenAmount, Exchange] {
    invariant(inputAmount.token.equals(this.token0) || inputAmount.token.equals(this.token1), 'TOKEN')
    if (JSBI.equal(this.reserve0.raw, ZERO) || JSBI.equal(this.reserve1.raw, ZERO)) {
      throw new InsufficientReservesError()
    }
    const inputReserve = this.reserveOf(inputAmount.token)
    const outputReserve = this.reserveOf(inputAmount.token.equals(this.token0) ? this.token1 : this.token0)
    const inputAmountWithFee = JSBI.multiply(inputAmount.raw, _997)
    const numerator = JSBI.multiply(inputAmountWithFee, outputReserve.raw)
    const denominator = JSBI.add(JSBI.multiply(inputReserve.raw, _1000), inputAmountWithFee)
    const outputAmount = new TokenAmount(
      inputAmount.token.equals(this.token0) ? this.token1 : this.token0,
      JSBI.divide(numerator, denominator)
    )
    if (JSBI.equal(outputAmount.raw, ZERO)) {
      throw new InsufficientInputAmountError()
    }
    return [outputAmount, new Exchange(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount))]
  }

  getInputAmount(outputAmount: TokenAmount): [TokenAmount, Exchange] {
    invariant(outputAmount.token.equals(this.token0) || outputAmount.token.equals(this.token1), 'TOKEN')
    if (
      JSBI.equal(this.reserve0.raw, ZERO) ||
      JSBI.equal(this.reserve1.raw, ZERO) ||
      JSBI.greaterThanOrEqual(outputAmount.raw, this.reserveOf(outputAmount.token).raw)
    ) {
      throw new InsufficientReservesError()
    }

    const outputReserve = this.reserveOf(outputAmount.token)
    const inputReserve = this.reserveOf(outputAmount.token.equals(this.token0) ? this.token1 : this.token0)
    const numerator = JSBI.multiply(JSBI.multiply(inputReserve.raw, outputAmount.raw), _1000)
    const denominator = JSBI.multiply(JSBI.subtract(outputReserve.raw, outputAmount.raw), _997)
    const inputAmount = new TokenAmount(
      outputAmount.token.equals(this.token0) ? this.token1 : this.token0,
      JSBI.add(JSBI.divide(numerator, denominator), ONE)
    )
    return [inputAmount, new Exchange(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount))]
  }
}
