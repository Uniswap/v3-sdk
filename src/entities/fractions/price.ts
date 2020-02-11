import invariant from 'tiny-invariant'
import JSBI from 'jsbi'

import { BigintIsh, Rounding } from '../../types'
import { TEN } from '../../constants'
import { Token } from '../token'
import { Route } from '../route'
import { Fraction } from './fraction'
import { TokenAmount } from './tokenAmount'

export class Price extends Fraction {
  public readonly baseToken: Token // input i.e. denominator
  public readonly quoteToken: Token // output i.e. numerator
  public readonly scalar: Fraction // used to adjust the raw fraction w/r/t the decimals of the {base,quote}Tokens

  static fromRoute(route: Route): Price {
    const prices: Price[] = []
    for (const [i, exchange] of route.exchanges.entries()) {
      prices.push(
        route.path[i].equals(exchange.token0)
          ? new Price(exchange.reserve0.token, exchange.reserve1.token, exchange.reserve0.raw, exchange.reserve1.raw)
          : new Price(exchange.reserve1.token, exchange.reserve0.token, exchange.reserve1.raw, exchange.reserve0.raw)
      )
    }
    return prices.slice(1).reduce((accumulator, currentValue) => accumulator.multiply(currentValue), prices[0])
  }

  // denominator and numerator _must be_ scaled in units of the {base,quote}Tokens
  constructor(baseToken: Token, quoteToken: Token, denominator: BigintIsh, numerator: BigintIsh) {
    super(numerator, denominator)

    this.baseToken = baseToken
    this.quoteToken = quoteToken
    this.scalar = new Fraction(
      JSBI.exponentiate(TEN, JSBI.BigInt(baseToken.decimals)),
      JSBI.exponentiate(TEN, JSBI.BigInt(quoteToken.decimals))
    )
  }

  public get raw(): Fraction {
    return new Fraction(this.numerator, this.denominator)
  }

  public get adjusted(): Fraction {
    return super.multiply(this.scalar)
  }

  public invert(): Price {
    return new Price(this.quoteToken, this.baseToken, this.numerator, this.denominator)
  }

  public multiply(other: Price): Price {
    invariant(this.quoteToken.equals(other.baseToken), 'BASE')
    const fraction = super.multiply(other)
    return new Price(this.baseToken, other.quoteToken, fraction.denominator, fraction.numerator)
  }

  // performs floor division on overflow
  public quote(tokenAmount: TokenAmount): TokenAmount {
    invariant(tokenAmount.token.equals(this.baseToken), 'TOKEN')
    return new TokenAmount(this.quoteToken, super.multiply(tokenAmount.raw).quotient)
  }

  public toSignificant(significantDigits: number = 6, format?: object, rounding?: Rounding): string {
    return this.adjusted.toSignificant(significantDigits, format, rounding)
  }

  public toFixed(decimalPlaces: number = 6, format?: object, rounding?: Rounding): string {
    return this.adjusted.toFixed(decimalPlaces, format, rounding)
  }
}
