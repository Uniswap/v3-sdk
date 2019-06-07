import BigNumber from 'bignumber.js'

import { BigNumberish, FlexibleFormat, isFormat, FormatSignificantOptions, FormatFixedOptions } from '../types'
import { _0, _10, MAX_DECIMAL_PLACES, ROUNDING_MODE, FIXED_UNDERFLOW_BEHAVIOR } from '../constants'
import { normalizeBigNumberish, ensureBoundedInteger, ensureAllUInt256, ensureAllUInt8 } from '../_utils'

function _format(
  bigNumber: BigNumber,
  decimalPlaces: number,
  roundingMode: BigNumber.RoundingMode = ROUNDING_MODE,
  format: FlexibleFormat
): string {
  return isFormat(format) || format
    ? bigNumber.toFormat(decimalPlaces, roundingMode, isFormat(format) ? format : undefined)
    : bigNumber.toFixed(decimalPlaces, roundingMode)
}

// bignumberish is converted to significantDigits, then cast back as a bignumber and formatted, dropping trailing 0s
export function formatSignificant(bigNumberish: BigNumberish, options?: FormatSignificantOptions): string {
  const { significantDigits = 6, roundingMode = ROUNDING_MODE, forceIntegerSignificance = true, format = false } =
    options || {}

  const bigNumber: BigNumber = normalizeBigNumberish(bigNumberish)
  ensureBoundedInteger(significantDigits, [1, MAX_DECIMAL_PLACES])

  const minimumSignificantDigits: number = forceIntegerSignificance ? bigNumber.integerValue().toFixed().length : 0
  const preciseBigNumber: BigNumber = new BigNumber(
    bigNumber.toPrecision(Math.max(minimumSignificantDigits, significantDigits))
  )

  return _format(preciseBigNumber, preciseBigNumber.decimalPlaces(), roundingMode, format)
}

export function formatFixed(bigNumberish: BigNumberish, options?: FormatFixedOptions): string {
  const {
    decimalPlaces = 4,
    roundingMode = ROUNDING_MODE,
    dropTrailingZeros = true,
    underflowBehavior = FIXED_UNDERFLOW_BEHAVIOR.ONE_DIGIT,
    format = false
  } = options || {}

  const bigNumber: BigNumber = normalizeBigNumberish(bigNumberish)
  ensureBoundedInteger(decimalPlaces, MAX_DECIMAL_PLACES)

  const minimumNonZeroValue: BigNumber = new BigNumber(decimalPlaces === 0 ? '0.5' : `0.${'0'.repeat(decimalPlaces)}5`)
  if (bigNumber.isLessThan(minimumNonZeroValue)) {
    switch (underflowBehavior) {
      case FIXED_UNDERFLOW_BEHAVIOR.ZERO: {
        return _format(_0, dropTrailingZeros ? 0 : decimalPlaces, undefined, format)
      }
      case FIXED_UNDERFLOW_BEHAVIOR.LESS_THAN: {
        return `<${_format(minimumNonZeroValue, minimumNonZeroValue.decimalPlaces(), undefined, format)}`
      }
      case FIXED_UNDERFLOW_BEHAVIOR.ONE_DIGIT: {
        const newBigNumber = new BigNumber(bigNumber.toPrecision(1))
        return _format(newBigNumber, newBigNumber.decimalPlaces(), undefined, format)
      }
      default: {
        throw Error(`Passed FIXED_UNDERFLOW_BEHAVIOR ${underflowBehavior} is not valid.`)
      }
    }
  } else {
    const newDecimalPlaces = dropTrailingZeros
      ? new BigNumber(bigNumber.toFixed(decimalPlaces, roundingMode)).decimalPlaces()
      : decimalPlaces

    return _format(bigNumber, newDecimalPlaces, roundingMode, format)
  }
}

function decimalize(bigNumberish: BigNumberish, decimals: number): BigNumber {
  const bigNumber: BigNumber = normalizeBigNumberish(bigNumberish)
  ensureAllUInt256([bigNumber])

  ensureAllUInt8([decimals])

  if (decimals > MAX_DECIMAL_PLACES) {
    throw Error(`This function does not support decimals greater than ${MAX_DECIMAL_PLACES}.`)
  }

  return bigNumber.dividedBy(_10.exponentiatedBy(decimals))
}

export function formatSignificantDecimals(
  bigNumberish: BigNumberish,
  decimals: number,
  options?: FormatSignificantOptions
): string {
  return formatSignificant(decimalize(bigNumberish, decimals), options)
}

export function formatFixedDecimals(
  bigNumberish: BigNumberish,
  decimals: number,
  options?: FormatFixedOptions
): string {
  return formatFixed(decimalize(bigNumberish, decimals), options)
}
