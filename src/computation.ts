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

// returns [numerator, decimal scalar, denominator]
function getRawMarketRate(
  tokenReserves: TokenReservesOptional,
  tradeType: TRADE_TYPE,
  invert: boolean
): [BigNumber, BigNumber, BigNumber] {
  if (tokenReserves === null) {
    throw Error('outputTokenReserves must be non-null.')
  } else {
    const numerator: TokenAmount =
      tradeType === TRADE_TYPE.ETH_TO_TOKEN ? tokenReserves.tokenReserve : tokenReserves.ethReserve
    const denominator: TokenAmount =
      tradeType === TRADE_TYPE.ETH_TO_TOKEN ? tokenReserves.ethReserve : tokenReserves.tokenReserve

    const numeratorAmount: BigNumber = normalizeBigNumberish(numerator.amount)
    const denominatorAmount: BigNumber = normalizeBigNumberish(denominator.amount)
    ensureAllUInt256([numeratorAmount, denominatorAmount])

    const numeratorDecimals: number = numerator.token.decimals
    const denominatorDecimals: number = denominator.token.decimals
    ensureAllUInt8([numeratorDecimals, denominatorDecimals])

    if (!invert) {
      const decimalScalar: BigNumber = _10.exponentiatedBy(denominatorDecimals - numeratorDecimals)
      return [numeratorAmount, decimalScalar, denominatorAmount]
    } else {
      const decimalScalar: BigNumber = _10.exponentiatedBy(numeratorDecimals - denominatorDecimals)
      return [denominatorAmount, decimalScalar, numeratorAmount]
    }
  }
}

function getRawMarketRateOneSided(
  tokenReserves: TokenReservesOptional,
  tradeType: TRADE_TYPE,
  invert: boolean
): BigNumber {
  const [numerator, decimalScalar, denominator]: [BigNumber, BigNumber, BigNumber] = getRawMarketRate(
    tokenReserves,
    tradeType,
    invert
  )
  return numerator.multipliedBy(decimalScalar).dividedBy(denominator)
}

// rounds output rates to 18 decimal places
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
      const [inputNumerator, inputDecimalScalar, inputDenominator]: [
        BigNumber,
        BigNumber,
        BigNumber
      ] = getRawMarketRate(inputTokenReserves, TRADE_TYPE.TOKEN_TO_ETH, invert)

      const [outputNumerator, outputDecimalScalar, outputDenominator]: [
        BigNumber,
        BigNumber,
        BigNumber
      ] = getRawMarketRate(outputTokenReserves, TRADE_TYPE.ETH_TO_TOKEN, invert)

      return inputNumerator
        .multipliedBy(inputDecimalScalar)
        .multipliedBy(outputNumerator)
        .multipliedBy(outputDecimalScalar)
        .dividedBy(inputDenominator.multipliedBy(outputDenominator))
    }
  } else {
    return getRawMarketRateOneSided(
      tradeType === TRADE_TYPE.ETH_TO_TOKEN ? outputTokenReserves : inputTokenReserves,
      tradeType,
      invert
    )
  }
}
