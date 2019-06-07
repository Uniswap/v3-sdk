import BigNumber from 'bignumber.js'

import {
  TokenAmountNormalized,
  OptionalReserves,
  TokenReservesNormalized,
  NormalizedReserves,
  areTokenReservesNormalized,
  Rate,
  MarketDetails,
  _ParsedOptionalReserves,
  _DecimalRate,
  _AnyRate
} from '../types'
import { TRADE_TYPE } from '../constants'
import { parseOptionalReserves, calculateDecimalRate } from './_utils'

// calculates the market rate for ETH_TO_TOKEN or TOKEN_TO_ETH trades
function getMarketRate(tradeType: TRADE_TYPE, reserves: NormalizedReserves, keepAsDecimal?: boolean): _AnyRate {
  if (!areTokenReservesNormalized(reserves)) {
    throw Error
  }

  const numerator: TokenAmountNormalized =
    tradeType === TRADE_TYPE.ETH_TO_TOKEN ? reserves.tokenReserve : reserves.ethReserve
  const denominator: TokenAmountNormalized =
    tradeType === TRADE_TYPE.ETH_TO_TOKEN ? reserves.ethReserve : reserves.tokenReserve

  return calculateDecimalRate(numerator, denominator, keepAsDecimal)
}

// note: rounds rates to 18 decimal places
export function getMarketDetails(
  tradeType: TRADE_TYPE,
  optionalReservesInput: OptionalReserves,
  optionalReservesOutput: OptionalReserves
): MarketDetails {
  const { inputReserves, outputReserves }: _ParsedOptionalReserves = parseOptionalReserves(
    optionalReservesInput,
    optionalReservesOutput,
    tradeType
  )

  if (tradeType === TRADE_TYPE.TOKEN_TO_TOKEN) {
    const {
      numerator: numeratorInput,
      denominator: denominatorInput,
      decimalScalar: decimalScalarInput,
      decimalScalarInverted: decimalScalarInvertedInput
    }: _DecimalRate = getMarketRate(TRADE_TYPE.TOKEN_TO_ETH, inputReserves, true) as _DecimalRate
    const {
      numerator: numeratorOutput,
      denominator: denominatorOutput,
      decimalScalar: decimalScalarOutput,
      decimalScalarInverted: decimalScalarInvertedOutput
    }: _DecimalRate = getMarketRate(TRADE_TYPE.ETH_TO_TOKEN, outputReserves, true) as _DecimalRate

    const marketRate: BigNumber = numeratorInput
      .multipliedBy(decimalScalarInput)
      .multipliedBy(numeratorOutput)
      .multipliedBy(decimalScalarOutput)
      .dividedBy(denominatorInput.multipliedBy(denominatorOutput))

    const marketRateInverted: BigNumber = denominatorInput
      .multipliedBy(decimalScalarInvertedInput)
      .multipliedBy(denominatorOutput)
      .multipliedBy(decimalScalarInvertedOutput)
      .dividedBy(numeratorInput.multipliedBy(numeratorOutput))

    return {
      tradeType,
      inputReserves,
      outputReserves,
      marketRate: { rate: marketRate, rateInverted: marketRateInverted }
    }
  } else {
    const reserves: TokenReservesNormalized = (tradeType === TRADE_TYPE.ETH_TO_TOKEN
      ? outputReserves
      : inputReserves) as TokenReservesNormalized

    return {
      tradeType,
      inputReserves,
      outputReserves,
      marketRate: getMarketRate(tradeType, reserves) as Rate
    }
  }
}
