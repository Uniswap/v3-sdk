import BigInteger from 'bignumber.js'

import { FlexibleFormat, FormatSignificantOptions, FormatFixedOptions } from '../types'
import { formatSignificant, formatSignificantDecimals, formatFixed, formatFixedDecimals } from '../format'
import { FIXED_UNDERFLOW_BEHAVIOR, _ROUNDING_MODE } from '../constants'

function constructFormatSignificantOptions(
  significantDigits: number,
  roundingMode: BigInteger.RoundingMode = _ROUNDING_MODE,
  forceIntegerSignificance: boolean = false,
  format: FlexibleFormat = false
): FormatSignificantOptions {
  return {
    significantDigits,
    roundingMode,
    forceIntegerSignificance,
    format
  }
}

function constructFormatFixedOptions(
  decimalPlaces: number,
  roundingMode: BigInteger.RoundingMode = _ROUNDING_MODE,
  dropTrailingZeros: boolean = true,
  underflowBehavior: FIXED_UNDERFLOW_BEHAVIOR = FIXED_UNDERFLOW_BEHAVIOR.ONE_DIGIT,
  format: FlexibleFormat = false
): FormatFixedOptions {
  return {
    decimalPlaces,
    roundingMode,
    dropTrailingZeros,
    underflowBehavior,
    format
  }
}

describe('formatSignificant', (): void => {
  test('regular', (): void => {
    const formatted = formatSignificant('1.234', constructFormatSignificantOptions(2))
    expect(formatted).toBe('1.2')
  })

  test('decimal', (): void => {
    const formatted = formatSignificantDecimals('1234', 3, constructFormatSignificantOptions(2))
    expect(formatted).toBe('1.2')
  })
})

describe('formatFixed', (): void => {
  test('regular', (): void => {
    const formatted = formatFixed('1.234', constructFormatFixedOptions(1))
    expect(formatted).toBe('1.2')
  })

  test('regular', (): void => {
    const formatted = formatFixedDecimals('1234', 3, constructFormatFixedOptions(1))
    expect(formatted).toBe('1.2')
  })
})
