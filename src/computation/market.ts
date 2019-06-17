import BigNumber from 'bignumber.js'

import {
  TokenAmount,
  TokenAmountNormalized,
  TokenReserves,
  TokenReservesNormalized,
  areTokenReservesNormalized,
  areETHReserves,
  areTokenReserves,
  OptionalReserves,
  NormalizedReserves,
  Rate,
  MarketDetails,
  _ParsedOptionalReserves,
  _DecimalRate,
  _AnyRate
} from '../types'
import { TRADE_TYPE } from '../constants'
import { normalizeBigNumberish, ensureAllUInt8, ensureAllUInt256, getEthToken } from '../_utils'
import { calculateDecimalRate } from './_utils'

function normalizeTokenAmount(tokenAmount: TokenAmount): TokenAmountNormalized {
  ensureAllUInt8([tokenAmount.token.decimals])

  const normalizedAmount: BigNumber = normalizeBigNumberish(tokenAmount.amount)
  ensureAllUInt256([normalizedAmount])

  return {
    token: { ...tokenAmount.token },
    amount: normalizedAmount
  }
}

function normalizeTokenReserves(tokenReserves: TokenReserves): TokenReservesNormalized {
  ensureAllUInt8([tokenReserves.token.decimals])

  return {
    token: { ...tokenReserves.token },
    ...(tokenReserves.exchange ? { exchange: { ...tokenReserves.exchange } } : {}),
    ethReserve: normalizeTokenAmount(tokenReserves.ethReserve),
    tokenReserve: normalizeTokenAmount(tokenReserves.tokenReserve)
  }
}

function parseOptionalReserves(
  optionalReservesInput: OptionalReserves,
  optionalReservesOutput: OptionalReserves
): _ParsedOptionalReserves {
  if (areTokenReserves(optionalReservesInput) && areTokenReserves(optionalReservesOutput)) {
    return {
      tradeType: TRADE_TYPE.TOKEN_TO_TOKEN,
      inputReserves: normalizeTokenReserves(optionalReservesInput),
      outputReserves: normalizeTokenReserves(optionalReservesOutput)
    }
  } else if (areTokenReserves(optionalReservesInput) && !areTokenReserves(optionalReservesOutput)) {
    return {
      tradeType: TRADE_TYPE.TOKEN_TO_ETH,
      inputReserves: normalizeTokenReserves(optionalReservesInput),
      outputReserves: areETHReserves(optionalReservesOutput)
        ? optionalReservesOutput
        : {
            token: getEthToken(optionalReservesInput.token.chainId)
          }
    }
  } else if (!areTokenReserves(optionalReservesInput) && areTokenReserves(optionalReservesOutput)) {
    return {
      tradeType: TRADE_TYPE.ETH_TO_TOKEN,
      inputReserves: areETHReserves(optionalReservesInput)
        ? optionalReservesInput
        : {
            token: getEthToken(optionalReservesOutput.token.chainId)
          },
      outputReserves: normalizeTokenReserves(optionalReservesOutput)
    }
  } else {
    throw Error('optionalReservesInput, optionalReservesOutput, or both must be defined.')
  }
}

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
  optionalReservesInput: OptionalReserves,
  optionalReservesOutput: OptionalReserves
): MarketDetails {
  const { tradeType, inputReserves, outputReserves }: _ParsedOptionalReserves = parseOptionalReserves(
    optionalReservesInput,
    optionalReservesOutput
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
