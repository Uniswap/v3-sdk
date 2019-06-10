import BigNumber from 'bignumber.js'

import { TokenAmountNormalized, _DecimalRate, _AnyRate } from '../types'
import { _1, _10 } from '../constants'

export function calculateDecimalRate(
  numerator: TokenAmountNormalized,
  denominator: TokenAmountNormalized,
  keepAsDecimal: boolean = false
): _AnyRate {
  const largerScalar: BigNumber = _10.exponentiatedBy(
    new BigNumber(Math.abs(numerator.token.decimals - denominator.token.decimals))
  )
  // since exponentiating with negative numbers rounds, we have to manually calculate the smaller of the scalars
  const smallerScalar: BigNumber = largerScalar.isEqualTo(_1)
    ? _1
    : new BigNumber(`0.${'0'.repeat(largerScalar.toFixed().length - 2)}1`)

  const invertedIsLarger: boolean = numerator.token.decimals - denominator.token.decimals > 0

  const decimalRate: _DecimalRate = {
    numerator: numerator.amount,
    denominator: denominator.amount,
    decimalScalar: invertedIsLarger ? smallerScalar : largerScalar,
    decimalScalarInverted: invertedIsLarger ? largerScalar : smallerScalar
  }

  return keepAsDecimal
    ? decimalRate
    : {
        rate: decimalRate.numerator.multipliedBy(decimalRate.decimalScalar).dividedBy(decimalRate.denominator),
        rateInverted: decimalRate.denominator
          .multipliedBy(decimalRate.decimalScalarInverted)
          .dividedBy(decimalRate.numerator)
      }
}
