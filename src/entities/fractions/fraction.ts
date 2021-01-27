import invariant from 'tiny-invariant'
import _Decimal from 'decimal.js-light'
import _Big, { RoundingMode } from 'big.js'
import toFormat from 'toformat'
import { parseBigintIsh } from '../../utils/parseBigintish'

import { BigintIsh, Rounding } from '../../constants'
import { ONE } from '../../constants'

const Decimal = toFormat(_Decimal)
const Big = toFormat(_Big)

const toSignificantRounding = {
  [Rounding.ROUND_DOWN]: Decimal.ROUND_DOWN,
  [Rounding.ROUND_HALF_UP]: Decimal.ROUND_HALF_UP,
  [Rounding.ROUND_UP]: Decimal.ROUND_UP
}

const toFixedRounding = {
  [Rounding.ROUND_DOWN]: RoundingMode.RoundDown,
  [Rounding.ROUND_HALF_UP]: RoundingMode.RoundHalfUp,
  [Rounding.ROUND_UP]: RoundingMode.RoundUp
}

export class Fraction {
  public readonly numerator: bigint
  public readonly denominator: bigint

  public constructor(numerator: BigintIsh, denominator: BigintIsh = ONE) {
    this.numerator = parseBigintIsh(numerator)
    this.denominator = parseBigintIsh(denominator)
  }

  // performs floor division
  public get quotient(): bigint {
    return this.numerator / this.denominator
  }

  // remainder after floor division
  public get remainder(): Fraction {
    return new Fraction(this.numerator % this.denominator, this.denominator)
  }

  public invert(): Fraction {
    return new Fraction(this.denominator, this.numerator)
  }

  public add(other: Fraction | BigintIsh): Fraction {
    const otherParsed = other instanceof Fraction ? other : new Fraction(parseBigintIsh(other))
    if (this.denominator === otherParsed.denominator) {
      return new Fraction(this.numerator + otherParsed.numerator, this.denominator)
    }
    return new Fraction(
      this.numerator * otherParsed.denominator + otherParsed.numerator * this.denominator,
      this.denominator * otherParsed.denominator
    )
  }

  public subtract(other: Fraction | BigintIsh): Fraction {
    const otherParsed = other instanceof Fraction ? other : new Fraction(parseBigintIsh(other))
    if (this.denominator === otherParsed.denominator) {
      return new Fraction(this.numerator - otherParsed.numerator, this.denominator)
    }
    return new Fraction(
      this.numerator * otherParsed.denominator - otherParsed.numerator * this.denominator,
      this.denominator * otherParsed.denominator
    )
  }

  public lessThan(other: Fraction | BigintIsh): boolean {
    const otherParsed = other instanceof Fraction ? other : new Fraction(parseBigintIsh(other))
    return this.numerator * otherParsed.denominator < otherParsed.numerator * this.denominator
  }

  public equalTo(other: Fraction | BigintIsh): boolean {
    const otherParsed = other instanceof Fraction ? other : new Fraction(parseBigintIsh(other))
    return this.numerator * otherParsed.denominator === otherParsed.numerator * this.denominator
  }

  public greaterThan(other: Fraction | BigintIsh): boolean {
    const otherParsed = other instanceof Fraction ? other : new Fraction(parseBigintIsh(other))
    return this.numerator * otherParsed.denominator > otherParsed.numerator * this.denominator
  }

  public multiply(other: Fraction | BigintIsh): Fraction {
    const otherParsed = other instanceof Fraction ? other : new Fraction(parseBigintIsh(other))
    return new Fraction(this.numerator * otherParsed.numerator, this.denominator * otherParsed.denominator)
  }

  public divide(other: Fraction | BigintIsh): Fraction {
    const otherParsed = other instanceof Fraction ? other : new Fraction(parseBigintIsh(other))
    return new Fraction(this.numerator * otherParsed.denominator, this.denominator * otherParsed.numerator)
  }

  public toSignificant(
    significantDigits: number,
    format: object = { groupSeparator: '' },
    rounding: Rounding = Rounding.ROUND_HALF_UP
  ): string {
    invariant(Number.isInteger(significantDigits), `${significantDigits} is not an integer.`)
    invariant(significantDigits > 0, `${significantDigits} is not positive.`)

    Decimal.set({ precision: significantDigits + 1, rounding: toSignificantRounding[rounding] })
    const quotient = new Decimal(this.numerator.toString())
      .div(this.denominator.toString())
      .toSignificantDigits(significantDigits)
    return quotient.toFormat(quotient.decimalPlaces(), format)
  }

  public toFixed(
    decimalPlaces: number,
    format: object = { groupSeparator: '' },
    rounding: Rounding = Rounding.ROUND_HALF_UP
  ): string {
    invariant(Number.isInteger(decimalPlaces), `${decimalPlaces} is not an integer.`)
    invariant(decimalPlaces >= 0, `${decimalPlaces} is negative.`)

    Big.DP = decimalPlaces
    Big.RM = toFixedRounding[rounding]
    return new Big(this.numerator.toString()).div(this.denominator.toString()).toFormat(decimalPlaces, format)
  }
}
