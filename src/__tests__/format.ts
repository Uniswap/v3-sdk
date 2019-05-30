import { FlexibleFormat, FormatSignificantOptions, FormatFixedOptions } from '../types'
import { formatSignificant, formatFixed } from '../format'
import { FIXED_UNDERFLOW_BEHAVIOR } from '../constants'

function constructFormatSignificantOptions(
  significantDigits: number,
  forceIntegerSignificance: boolean = false,
  format: FlexibleFormat = false
): FormatSignificantOptions {
  return {
    significantDigits,
    forceIntegerSignificance,
    format
  }
}

function constructFormatFixedOptions(
  decimalPlaces: number,
  dropTrailingZeros: boolean = true,
  format: FlexibleFormat = false,
  underflowBehavior: FIXED_UNDERFLOW_BEHAVIOR = FIXED_UNDERFLOW_BEHAVIOR.ONE_DIGIT
): FormatFixedOptions {
  return {
    decimalPlaces,
    dropTrailingZeros,
    format,
    underflowBehavior
  }
}

describe('formatSignificant', (): void => {
  test('regular', (): void => {
    const formatted = formatSignificant('1.234', constructFormatSignificantOptions(2))
    expect(formatted).toBe('1.2')
  })
})

describe('formatFixed', (): void => {
  test('regular', (): void => {
    const formatted = formatFixed('1.234', constructFormatFixedOptions(1))
    expect(formatted).toBe('1.2')
  })
})
