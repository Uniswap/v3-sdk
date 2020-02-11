import invariant from 'tiny-invariant'
import JSBI from 'jsbi'
import { getNetwork } from '@ethersproject/networks'
import { getDefaultProvider } from '@ethersproject/providers'
import { Contract } from '@ethersproject/contracts'

import { FACTORY_ADDRESS, ZERO, ONE, _997, _1000 } from '../constants'
import UniswapV2Factory from '../abis/UniswapV2Factory.json'
import ERC20 from '../abis/ERC20.json'
import { validateAndParseAddress } from '../utils'
import { Token } from './token'
import { TokenAmount } from './fractions/tokenAmount'

export class Exchange {
  private readonly tokenAmounts: [TokenAmount, TokenAmount]
  public readonly address?: string

  static async fetchData(
    tokenA: Token,
    tokenB: Token,
    provider = getDefaultProvider(getNetwork(tokenA.chainId)),
    address?: string
  ): Promise<Exchange> {
    const parsedAddress =
      typeof address === 'string'
        ? address
        : await new Contract(FACTORY_ADDRESS[tokenA.chainId], UniswapV2Factory, provider).getExchange(
            tokenA.address,
            tokenB.address
          )
    const balances = await Promise.all([
      new Contract(tokenA.address, ERC20, provider).balanceOf(parsedAddress),
      new Contract(tokenB.address, ERC20, provider).balanceOf(parsedAddress)
    ])
    return new Exchange(new TokenAmount(tokenA, balances[0]), new TokenAmount(tokenB, balances[1]), parsedAddress)
  }

  constructor(tokenAmountA: TokenAmount, tokenAmountB: TokenAmount, address?: string) {
    invariant(tokenAmountA.token.chainId === tokenAmountB.token.chainId, 'CHAIN_IDS')
    const tokenAmounts: [TokenAmount, TokenAmount] =
      tokenAmountA.token.address < tokenAmountB.token.address
        ? [tokenAmountA, tokenAmountB]
        : [tokenAmountB, tokenAmountA]
    invariant(tokenAmounts[0].token.address < tokenAmounts[1].token.address, 'ADDRESSES')

    this.tokenAmounts = tokenAmounts
    if (typeof address === 'string') this.address = validateAndParseAddress(address)
  }

  public get reserve0(): TokenAmount {
    return this.tokenAmounts[0]
  }

  public get reserve1(): TokenAmount {
    return this.tokenAmounts[1]
  }

  public get token0(): Token {
    return this.tokenAmounts[0].token
  }

  public get token1(): Token {
    return this.tokenAmounts[1].token
  }

  public getOutputAmount(inputAmount: TokenAmount): [TokenAmount, Exchange] {
    invariant(inputAmount.token.equals(this.token0) || inputAmount.token.equals(this.token1), 'TOKEN')
    invariant(JSBI.greaterThan(inputAmount.raw, ZERO), 'ZERO')
    invariant(JSBI.greaterThan(this.reserve0.raw, ZERO), 'ZERO')
    invariant(JSBI.greaterThan(this.reserve1.raw, ZERO), 'ZERO')

    const inputReserve = inputAmount.token.equals(this.reserve0.token) ? this.reserve0 : this.reserve1
    const outputReserve = inputAmount.token.equals(this.reserve0.token) ? this.reserve1 : this.reserve0
    const inputAmountWithFee = JSBI.multiply(inputAmount.raw, _997)
    const numerator = JSBI.multiply(inputAmountWithFee, outputReserve.raw)
    const denominator = JSBI.add(JSBI.multiply(inputReserve.raw, _1000), inputAmountWithFee)
    const output = new TokenAmount(
      inputAmount.token.equals(this.token0) ? this.token1 : this.token0,
      JSBI.divide(numerator, denominator)
    )
    return [output, new Exchange(inputReserve.add(inputAmount), outputReserve.subtract(output), this.address)]
  }

  public getInputAmount(outputAmount: TokenAmount): [TokenAmount, Exchange] {
    invariant(outputAmount.token.equals(this.token0) || outputAmount.token.equals(this.token1), 'TOKEN')
    invariant(JSBI.greaterThan(outputAmount.raw, ZERO), 'ZERO')
    invariant(JSBI.greaterThan(this.reserve0.raw, ZERO), 'ZERO')
    invariant(JSBI.greaterThan(this.reserve1.raw, ZERO), 'ZERO')

    const inputReserve = outputAmount.token.equals(this.reserve0.token) ? this.reserve1 : this.reserve0
    const outputReserve = outputAmount.token.equals(this.reserve0.token) ? this.reserve0 : this.reserve1
    const numerator = JSBI.multiply(JSBI.multiply(inputReserve.raw, outputAmount.raw), _1000)
    const denominator = JSBI.multiply(JSBI.subtract(outputReserve.raw, outputAmount.raw), _997)
    const input = new TokenAmount(
      outputAmount.token.equals(this.token0) ? this.token1 : this.token0,
      JSBI.add(JSBI.divide(numerator, denominator), ONE)
    )
    return [input, new Exchange(inputReserve.add(input), outputReserve.subtract(outputAmount), this.address)]
  }
}
