import BigNumber from 'bignumber.js'

import { MAX_DECIMAL_PLACES, ROUNDING_MODE, FIXED_UNDERFLOW_BEHAVIOR, _0 } from './constants'
import { BigNumberish, FlexibleFormat, FormatSignificantOptions, FormatFixedOptions } from './types'
import { normalizeBigNumberish, ensureBoundedInteger } from './utils'

function _format(bigNumber: BigNumber, format: FlexibleFormat, decimalPlaces: number): string {
  return typeof format === 'boolean' && format === false
    ? bigNumber.toFixed(decimalPlaces)
    : bigNumber.toFormat(
        decimalPlaces,
        ROUNDING_MODE,
        typeof format === 'boolean' && format === true ? undefined : format
      )
}

// bignumberish is converted to significantDigits, then cast back as a bignumber and formatted, dropping trailing 0s
export function formatSignificant(
  bigNumberish: BigNumberish,
  { significantDigits = 6, forceIntegerSignificance = false, format = false }: FormatSignificantOptions
): string {
  const bigNumber: BigNumber = normalizeBigNumberish(bigNumberish)
  ensureBoundedInteger(significantDigits, [1, MAX_DECIMAL_PLACES])

  const minimumSignificantDigits: number = forceIntegerSignificance ? bigNumber.integerValue().toFixed().length : 0
  const preciseBigNumber: BigNumber = new BigNumber(
    bigNumber.toPrecision(Math.max(minimumSignificantDigits, significantDigits))
  )

  return _format(preciseBigNumber, format, preciseBigNumber.decimalPlaces())
}

export function formatFixed(
  bigNumberish: BigNumberish,
  {
    decimalPlaces = 4,
    dropTrailingZeros = true,
    format = false,
    underflowBehavior = FIXED_UNDERFLOW_BEHAVIOR.ONE_DIGIT
  }: FormatFixedOptions
): string {
  const bigNumber: BigNumber = normalizeBigNumberish(bigNumberish)
  ensureBoundedInteger(decimalPlaces, MAX_DECIMAL_PLACES)

  // this works because we've specified the rounding mode
  const minimumNonZeroValue: BigNumber = new BigNumber(decimalPlaces === 0 ? '0.5' : `0.${'0'.repeat(decimalPlaces)}5`)
  if (bigNumber.isLessThan(minimumNonZeroValue)) {
    switch (underflowBehavior) {
      case FIXED_UNDERFLOW_BEHAVIOR.ZERO: {
        return _format(_0, format, dropTrailingZeros ? 0 : decimalPlaces)
      }
      case FIXED_UNDERFLOW_BEHAVIOR.LESS_THAN: {
        return `<${_format(minimumNonZeroValue, format, minimumNonZeroValue.decimalPlaces())}`
      }
      case FIXED_UNDERFLOW_BEHAVIOR.ONE_DIGIT: {
        const newBigNumber = new BigNumber(bigNumber.toPrecision(1))
        return _format(newBigNumber, format, newBigNumber.decimalPlaces())
      }
      case FIXED_UNDERFLOW_BEHAVIOR.MAX_DECIMAL_PLACES: {
        const newBigNumber = new BigNumber(bigNumber.toFixed(MAX_DECIMAL_PLACES))
        return _format(newBigNumber, format, dropTrailingZeros ? newBigNumber.decimalPlaces() : MAX_DECIMAL_PLACES)
      }
      default: {
        throw Error(`Passed FIXED_UNDERFLOW_BEHAVIOR ${underflowBehavior} is not valid.`)
      }
    }
  } else {
    const newDecimalPlaces = dropTrailingZeros
      ? new BigNumber(bigNumber.toFixed(decimalPlaces)).decimalPlaces()
      : decimalPlaces

    return _format(bigNumber, format, newDecimalPlaces)
  }
}
