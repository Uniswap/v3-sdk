import invariant from 'tiny-invariant'
import _Decimal from 'decimal.js-light'
import _Big, { RoundingMode } from 'big.js'
import toFormat from 'toformat'

import { BigintIsh } from '../types'
import { parseBigintIsh } from './parseInputs'

const Decimal = toFormat(_Decimal)
const Big = toFormat(_Big)

export function formatSignificant(
  numerator: BigintIsh,
  denominator: BigintIsh,
  significantDigits: number,
  format: object = { groupSeparator: '' },
  roundingMode: number = Decimal.ROUND_HALF_UP,
  minimumDecimalPlaces: number = 0
): string {
  invariant(Number.isInteger(significantDigits), `${significantDigits} is not an integer.`)
  invariant(significantDigits > 0, `${significantDigits} isn't positive.`)
  const numeratorParsed = parseBigintIsh(numerator)
  const denominatorParsed = parseBigintIsh(denominator)

  Decimal.set({ precision: significantDigits + 1, rounding: roundingMode })
  const quotient = new Decimal(numeratorParsed.toString())
    .div(denominatorParsed.toString())
    .toSignificantDigits(significantDigits)
  return quotient.toFormat(
    minimumDecimalPlaces > quotient.decimalPlaces() ? minimumDecimalPlaces : quotient.decimalPlaces(),
    format
  )
}

export function formatFixed(
  numerator: BigintIsh,
  denominator: BigintIsh,
  decimalPlaces: number,
  format: object = { groupSeparator: '' },
  roundingMode: RoundingMode = RoundingMode.RoundHalfUp
): string {
  invariant(Number.isInteger(decimalPlaces), `${decimalPlaces} is not an integer.`)
  invariant(decimalPlaces >= 0, `${decimalPlaces} is negative.`)
  const numeratorParsed = parseBigintIsh(numerator)
  const denominatorParsed = parseBigintIsh(denominator)

  Big.DP = decimalPlaces
  Big.RM = roundingMode
  return new Big(numeratorParsed.toString()).div(denominatorParsed.toString()).toFormat(decimalPlaces, format)
}
