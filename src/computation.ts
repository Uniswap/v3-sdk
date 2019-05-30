import BigNumber from 'bignumber.js'

import { TokenAmount, TokenReservesOptional } from './types'
import { _0, _1, _10, _997, _1000, TRADE_TYPE } from './constants'
import { ensureAllUInt8, ensureAllUInt256, normalizeBigNumberish } from './utils'

export function getInputPrice(inputAmount: BigNumber, inputReserve: BigNumber, outputReserve: BigNumber): BigNumber {
  ensureAllUInt256([inputAmount, inputReserve, outputReserve])

  if (inputReserve.isLessThanOrEqualTo(_0) || outputReserve.isLessThanOrEqualTo(_0)) {
    throw Error(`Both inputReserve '${inputReserve}' and outputReserve '${outputReserve}' must be non-zero.`)
  }

  const inputAmountWithFee: BigNumber = inputAmount.multipliedBy(_997)
  const numerator: BigNumber = inputAmountWithFee.multipliedBy(outputReserve)
  const denominator: BigNumber = inputReserve.multipliedBy(_1000).plus(inputAmountWithFee)
  const outputAmount = numerator.dividedToIntegerBy(denominator)

  ensureAllUInt256([inputAmountWithFee, numerator, denominator, outputAmount])

  return outputAmount
}

export function getOutputPrice(outputAmount: BigNumber, inputReserve: BigNumber, outputReserve: BigNumber): BigNumber {
  ensureAllUInt256([outputAmount, inputReserve, outputReserve])

  if (inputReserve.isLessThanOrEqualTo(_0) || outputReserve.isLessThanOrEqualTo(_0)) {
    throw Error(`Both inputReserve '${inputReserve}' and outputReserve '${outputReserve}' must be non-zero.`)
  }

  const numerator: BigNumber = inputReserve.multipliedBy(outputAmount).multipliedBy(_1000)
  const denominator: BigNumber = outputReserve.minus(outputAmount).multipliedBy(_997)
  const inputAmount: BigNumber = numerator.dividedToIntegerBy(denominator).plus(_1)

  ensureAllUInt256([numerator, denominator, inputAmount])

  return inputAmount
}

function _getMarketRate(tokenReserves: TokenReservesOptional, tradeType: TRADE_TYPE, invert: boolean): BigNumber {
  if (tokenReserves === null) {
    throw Error('outputTokenReserves must be non-null.')
  } else {
    const numerator: TokenAmount =
      tradeType === TRADE_TYPE.ETH_TO_TOKEN ? tokenReserves.ethReserve : tokenReserves.tokenReserve
    const denominator: TokenAmount =
      tradeType === TRADE_TYPE.ETH_TO_TOKEN ? tokenReserves.tokenReserve : tokenReserves.ethReserve

    const numeratorAmount: BigNumber = normalizeBigNumberish(numerator.amount)
    const denominatorAmount: BigNumber = normalizeBigNumberish(denominator.amount)
    ensureAllUInt256([numeratorAmount, denominatorAmount])

    const numeratorDecimals: number = numerator.token.decimals
    const denominatorDecimals: number = denominator.token.decimals
    ensureAllUInt8([numeratorDecimals, denominatorDecimals])

    if (!invert) {
      const decimalScalar = _10.exponentiatedBy(denominatorDecimals - numeratorDecimals)
      return numeratorAmount.multipliedBy(decimalScalar).div(denominatorAmount)
    } else {
      const decimalScalar = _10.exponentiatedBy(numeratorDecimals - denominatorDecimals)
      return denominatorAmount.multipliedBy(decimalScalar).div(numeratorAmount)
    }
  }
}

export function getMarketRate(
  inputTokenReserves: TokenReservesOptional,
  outputTokenReserves: TokenReservesOptional,
  tradeType: TRADE_TYPE,
  invert: boolean = false
): BigNumber {
  if (tradeType === TRADE_TYPE.TOKEN_TO_TOKEN) {
    if (inputTokenReserves === null || outputTokenReserves === null) {
      throw Error('Both inputTokenReserves and outputTokenReserves must be non-null.')
    } else {
      const inputMarketRate: BigNumber = _getMarketRate(inputTokenReserves, TRADE_TYPE.TOKEN_TO_ETH, invert)
      const outputMarketRate: BigNumber = _getMarketRate(outputTokenReserves, TRADE_TYPE.ETH_TO_TOKEN, invert)
      return inputMarketRate.multipliedBy(outputMarketRate)
    }
  } else {
    return _getMarketRate(
      tradeType === TRADE_TYPE.ETH_TO_TOKEN ? outputTokenReserves : inputTokenReserves,
      tradeType,
      invert
    )
  }
}
