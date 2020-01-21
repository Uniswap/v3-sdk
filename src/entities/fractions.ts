import invariant from 'tiny-invariant'
import JSBI from 'jsbi'

import { ZERO, ONE, TEN, _100 } from '../constants'
import { BigintIsh } from '../types'
import { parseBigintIsh } from '../utils/parseInputs'
import { formatSignificant, formatFixed } from '../utils/formatOutputs'
import { Route } from './route'

export class Fraction {
  public readonly numerator: JSBI
  public readonly denominator: JSBI

  constructor(numerator: BigintIsh, denominator: BigintIsh = ONE) {
    this.numerator = parseBigintIsh(numerator)
    this.denominator = parseBigintIsh(denominator)
  }

  // warning: this can truncate!
  get quotient() {
    return JSBI.divide(this.numerator, this.denominator)
  }

  public invert(): Fraction {
    return new Fraction(this.denominator, this.numerator)
  }

  public multiply(other: Fraction): Fraction {
    return new Fraction(
      JSBI.multiply(this.numerator, other.numerator),
      JSBI.multiply(this.denominator, other.denominator)
    )
  }

  public formatSignificant(significantDigits: number, ...rest: any[]): string {
    return formatSignificant(this.numerator, this.denominator, significantDigits, ...rest)
  }

  public formatFixed(decimalPlaces: number, ...rest: any[]): string {
    return formatFixed(this.numerator, this.denominator, decimalPlaces, ...rest)
  }
}

export class Price {
  public readonly price: Fraction // normalized
  public readonly scalar: Fraction // used to convert back to raw balances

  static fromRoute(route: Route): Price {
    const prices: Fraction[] = route.exchanges.map((exchange, i) => {
      const input = route.path[i]
      const baseIndex = input.address === exchange.pair[0].address ? 0 : 1
      const quoteIndex = input.address === exchange.pair[0].address ? 1 : 0
      return new Fraction(
        JSBI.multiply(
          exchange.balances[quoteIndex],
          JSBI.exponentiate(TEN, JSBI.BigInt(exchange.pair[baseIndex].decimals))
        ),
        JSBI.multiply(
          exchange.balances[baseIndex],
          JSBI.exponentiate(TEN, JSBI.BigInt(exchange.pair[quoteIndex].decimals))
        )
      )
    })
    const price = prices.reduce((accumulator, currentValue) => accumulator.multiply(currentValue), new Fraction(ONE))
    const scalar = new Fraction(
      JSBI.exponentiate(TEN, JSBI.BigInt(route.output.decimals)),
      JSBI.exponentiate(TEN, JSBI.BigInt(route.input.decimals))
    )
    return new Price(price, scalar)
  }

  constructor(price: Fraction, scalar: Fraction) {
    this.price = price
    this.scalar = scalar
  }

  public invert(): Price {
    return new Price(this.price.invert(), this.scalar.invert())
  }

  public quote(amount: BigintIsh): JSBI {
    const amountParsed = parseBigintIsh(amount)
    invariant(JSBI.greaterThan(amountParsed, ZERO), `${amountParsed} isn't positive.`)

    return this.price.multiply(this.scalar).multiply(new Fraction(amount)).quotient
  }

  public formatSignificant(significantDigits = 6, ...rest: any[]): string {
    return this.price.formatSignificant(significantDigits, ...rest)
  }

  public formatFixed(decimalPlaces = 6, ...rest: any[]): string {
    return this.price.formatFixed(decimalPlaces, ...rest)
  }
}

export class Percent {
  public readonly percent: Fraction

  constructor(percent: Fraction) {
    this.percent = percent
  }

  public formatSignificant(significantDigits = 5, ...rest: any[]): string {
    return this.percent.multiply(new Fraction(_100)).formatSignificant(significantDigits, ...rest)
  }

  public formatFixed(decimalPlaces = 2, ...rest: any[]): string {
    return this.percent.multiply(new Fraction(_100)).formatFixed(decimalPlaces, ...rest)
  }
}
