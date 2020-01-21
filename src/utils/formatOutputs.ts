import invariant from 'tiny-invariant'
import JSBI from 'jsbi'
import _Decimal from 'decimal.js-light'
import _Big, { RoundingMode } from 'big.js'
import toFormat from 'toformat'

const Decimal = toFormat(_Decimal)
const Big = toFormat(_Big)

export function formatSignificant(
  numerator: JSBI,
  denominator: JSBI,
  significantDigits: number,
  format: object = { groupSeparator: '' },
  roundingMode?: number
): string {
  invariant(Number.isInteger(significantDigits), `${significantDigits} is not an integer.`)
  invariant(significantDigits > 0, `${significantDigits} isn't positive.`)

  Decimal.set({ precision: significantDigits + 1, rounding: roundingMode ?? Decimal.ROUND_HALF_UP })
  const quotient = new Decimal(numerator.toString()).div(denominator.toString()).toSignificantDigits(significantDigits)
  return quotient.toFormat(quotient.decimalPlaces(), format)
}

export function formatFixed(
  numerator: JSBI,
  denominator: JSBI,
  decimalPlaces: number,
  format: object = { groupSeparator: '' },
  roundingMode?: RoundingMode
): string {
  invariant(Number.isInteger(decimalPlaces), `${decimalPlaces} is not an integer.`)
  invariant(decimalPlaces >= 0, `${decimalPlaces} is negative.`)

  Big.DP = decimalPlaces
  Big.RM = roundingMode ?? RoundingMode.RoundHalfUp
  return new Big(numerator.toString()).div(denominator.toString()).toFormat(decimalPlaces, format)
}
