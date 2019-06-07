import BigNumber from 'bignumber.js'

import {
  TokenAmount,
  TokenAmountNormalized,
  TokenReserves,
  areTokenReserves,
  areETHReserves,
  OptionalReserves,
  TokenReservesNormalized,
  _ParsedOptionalReserves,
  _DecimalRate,
  _AnyRate
} from '../types'
import { _1, _10, _10000, TRADE_TYPE, ETH_TOKEN } from '../constants'
import { ensureAllUInt8, ensureAllUInt256, normalizeBigNumberish } from '../_utils'

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
  if (tokenReserves.exchange) {
    ensureAllUInt8([tokenReserves.exchange.decimals])
  }

  return {
    token: { ...tokenReserves.token },
    ...(tokenReserves.exchange ? { ...tokenReserves.exchange } : {}),
    ethReserve: normalizeTokenAmount(tokenReserves.ethReserve),
    tokenReserve: normalizeTokenAmount(tokenReserves.tokenReserve)
  }
}

function ensureTradeTypesMatch(computedTradeType: TRADE_TYPE, passedTradeType?: TRADE_TYPE): never | void {
  if (passedTradeType && passedTradeType !== computedTradeType) {
    throw Error(`passedTradeType '${passedTradeType}' does not match computedTradeType '${computedTradeType}'.`)
  }
}

export function parseOptionalReserves(
  optionalReservesInput: OptionalReserves,
  optionalReservesOutput: OptionalReserves,
  passedTradeType?: TRADE_TYPE
): _ParsedOptionalReserves {
  if (areTokenReserves(optionalReservesInput) && areTokenReserves(optionalReservesOutput)) {
    const computedTradeType: TRADE_TYPE = TRADE_TYPE.TOKEN_TO_TOKEN
    ensureTradeTypesMatch(computedTradeType, passedTradeType)

    return {
      tradeType: computedTradeType,
      inputReserves: normalizeTokenReserves(optionalReservesInput),
      outputReserves: normalizeTokenReserves(optionalReservesOutput)
    }
  } else if (areTokenReserves(optionalReservesInput) && !areTokenReserves(optionalReservesOutput)) {
    const computedTradeType: TRADE_TYPE = TRADE_TYPE.TOKEN_TO_ETH
    ensureTradeTypesMatch(computedTradeType, passedTradeType)

    return {
      tradeType: computedTradeType,
      inputReserves: normalizeTokenReserves(optionalReservesInput),
      outputReserves: {
        token: ETH_TOKEN(areETHReserves(optionalReservesOutput) ? optionalReservesOutput.token.chainId : undefined)
      }
    }
  } else if (!areTokenReserves(optionalReservesInput) && areTokenReserves(optionalReservesOutput)) {
    const computedTradeType: TRADE_TYPE = TRADE_TYPE.ETH_TO_TOKEN
    ensureTradeTypesMatch(computedTradeType, passedTradeType)

    return {
      tradeType: computedTradeType,
      inputReserves: {
        token: ETH_TOKEN(areETHReserves(optionalReservesInput) ? optionalReservesInput.token.chainId : undefined)
      },
      outputReserves: normalizeTokenReserves(optionalReservesOutput)
    }
  } else {
    throw Error('optionalReservesInput, optionalReservesOutput, or both must be defined.')
  }
}

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

// slippage in basis points, to 18 decimals
export function calculateSlippage(baseRate: BigNumber, newRate: BigNumber): BigNumber {
  const difference: BigNumber = baseRate.minus(newRate).absoluteValue()
  return difference.multipliedBy(_10000).dividedBy(baseRate)
}
