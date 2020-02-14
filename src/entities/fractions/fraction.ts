import invariant from 'tiny-invariant'
import JSBI from 'jsbi'
import _Decimal from 'decimal.js-light'
import _Big, { RoundingMode } from 'big.js'
import toFormat from 'toformat'

import { BigintIsh, Rounding } from '../../types'
import { ONE } from '../../constants'
import { parseBigintIsh } from '../../utils'

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
  public readonly numerator: JSBI
  public readonly denominator: JSBI

  public constructor(numerator: BigintIsh, denominator: BigintIsh = ONE) {
    this.numerator = parseBigintIsh(numerator)
    this.denominator = parseBigintIsh(denominator)
  }

  // performs floor division
  public get quotient(): JSBI {
    return JSBI.divide(this.numerator, this.denominator)
  }

  public invert(): Fraction {
    return new Fraction(this.denominator, this.numerator)
  }

  public multiply(other: Fraction | BigintIsh): Fraction {
    const otherParsed = other instanceof Fraction ? other : new Fraction(parseBigintIsh(other))
    return new Fraction(
      JSBI.multiply(this.numerator, otherParsed.numerator),
      JSBI.multiply(this.denominator, otherParsed.denominator)
    )
  }

  public toSignificant(
    significantDigits: number,
    format: object = { groupSeparator: '' },
    rounding: Rounding = Rounding.ROUND_HALF_UP,
    maximumDecimalPlaces: number = Number.MAX_SAFE_INTEGER // should only be used to properly bound token amounts
  ): string {
    invariant(Number.isInteger(significantDigits), `${significantDigits} is not a positive integer.`)
    invariant(significantDigits > 0, `${significantDigits} is not positive.`)
    invariant(Number.isInteger(maximumDecimalPlaces), `${maximumDecimalPlaces} is not an integer.`)
    invariant(maximumDecimalPlaces >= 0, `maximumDecimalPlaces ${maximumDecimalPlaces} is negative.`)

    Decimal.set({ precision: significantDigits + 1, rounding: toSignificantRounding[rounding] })
    const quotient = new Decimal(this.numerator.toString())
      .div(this.denominator.toString())
      .toSignificantDigits(significantDigits)
    const decimalPlaces =
      quotient.decimalPlaces() === 0
        ? 0 // 0 decimal places for integer quotients
        : quotient.precision(true) >= significantDigits
        ? quotient.decimalPlaces() // else, the default number of decimal plcaes if there's enough precision already
        : significantDigits - (quotient.precision(true) - quotient.decimalPlaces()) // else, pad with 0s
    return quotient.toFormat(Math.min(decimalPlaces, maximumDecimalPlaces), format) // while respecting max
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
