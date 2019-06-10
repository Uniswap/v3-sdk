import BigNumber from 'bignumber.js'
import cloneDeepWith from 'lodash.clonedeepwith'

import {
  BigNumberish,
  TokenAmountNormalized,
  areTokenReservesNormalized,
  NormalizedReserves,
  Rate,
  MarketDetails,
  TradeDetails,
  _PartialTradeDetails
} from '../types'
import { _0, _1, _997, _1000, TRADE_TYPE, TRADE_EXACT, _10000 } from '../constants'
import { normalizeBigNumberish, ensureAllUInt256 } from '../_utils'
import { calculateDecimalRate } from './_utils'
import { getMarketDetails } from './market'

// emulates the uniswap smart contract logic
function getInputPrice(inputAmount: BigNumber, inputReserve: BigNumber, outputReserve: BigNumber): BigNumber {
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

// emulates the uniswap smart contract logic
function getOutputPrice(outputAmount: BigNumber, inputReserve: BigNumber, outputReserve: BigNumber): BigNumber {
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

function getSingleTradeTransput(
  tradeType: TRADE_TYPE,
  tradeExact: TRADE_EXACT,
  tradeAmount: BigNumber,
  reserves: NormalizedReserves
): BigNumber {
  if (!areTokenReservesNormalized(reserves)) {
    throw Error
  }

  const inputReserve: BigNumber =
    tradeType === TRADE_TYPE.ETH_TO_TOKEN ? reserves.ethReserve.amount : reserves.tokenReserve.amount
  const outputReserve: BigNumber =
    tradeType === TRADE_TYPE.ETH_TO_TOKEN ? reserves.tokenReserve.amount : reserves.ethReserve.amount

  const calculatedAmount: BigNumber =
    tradeExact === TRADE_EXACT.INPUT
      ? getInputPrice(tradeAmount, inputReserve, outputReserve)
      : getOutputPrice(tradeAmount, inputReserve, outputReserve)

  return calculatedAmount
}

function customizer(value: BigNumber): BigNumber | void {
  if (BigNumber.isBigNumber(value)) {
    return new BigNumber(value)
  }
}

// gets the corresponding input/output amount for the passed output/input amount
function getTradeTransput(
  tradeType: TRADE_TYPE,
  tradeExact: TRADE_EXACT,
  tradeAmount: BigNumber,
  inputReserves: NormalizedReserves,
  outputReserves: NormalizedReserves
): _PartialTradeDetails {
  const inputReservesPost: NormalizedReserves = cloneDeepWith(inputReserves, customizer)
  const outputReservesPost: NormalizedReserves = cloneDeepWith(outputReserves, customizer)

  if (tradeType === TRADE_TYPE.TOKEN_TO_TOKEN) {
    if (!areTokenReservesNormalized(inputReservesPost) || !areTokenReservesNormalized(outputReservesPost)) {
      throw Error
    }

    if (tradeExact === TRADE_EXACT.INPUT) {
      const intermediateTransput: BigNumber = getSingleTradeTransput(
        TRADE_TYPE.TOKEN_TO_ETH,
        TRADE_EXACT.INPUT,
        tradeAmount,
        inputReserves
      )
      const finalTransput: BigNumber = getSingleTradeTransput(
        TRADE_TYPE.ETH_TO_TOKEN,
        TRADE_EXACT.INPUT,
        intermediateTransput,
        outputReserves
      )

      inputReservesPost.ethReserve.amount = inputReservesPost.ethReserve.amount.minus(intermediateTransput)
      inputReservesPost.tokenReserve.amount = inputReservesPost.tokenReserve.amount.plus(tradeAmount)
      outputReservesPost.ethReserve.amount = outputReservesPost.ethReserve.amount.plus(intermediateTransput)
      outputReservesPost.tokenReserve.amount = outputReservesPost.tokenReserve.amount.minus(finalTransput)

      return {
        transput: finalTransput,
        inputReservesPost,
        outputReservesPost
      }
    } else {
      const intermediateTransput: BigNumber = getSingleTradeTransput(
        TRADE_TYPE.ETH_TO_TOKEN,
        TRADE_EXACT.OUTPUT,
        tradeAmount,
        outputReserves
      )
      const finalTransput: BigNumber = getSingleTradeTransput(
        TRADE_TYPE.TOKEN_TO_ETH,
        TRADE_EXACT.OUTPUT,
        intermediateTransput,
        inputReserves
      )

      inputReservesPost.ethReserve.amount = inputReservesPost.ethReserve.amount.minus(intermediateTransput)
      inputReservesPost.tokenReserve.amount = inputReservesPost.tokenReserve.amount.plus(finalTransput)
      outputReservesPost.ethReserve.amount = outputReservesPost.ethReserve.amount.plus(intermediateTransput)
      outputReservesPost.tokenReserve.amount = outputReservesPost.tokenReserve.amount.minus(tradeAmount)

      return {
        transput: finalTransput,
        inputReservesPost,
        outputReservesPost
      }
    }
  } else {
    const reserves: NormalizedReserves = tradeType === TRADE_TYPE.ETH_TO_TOKEN ? outputReserves : inputReserves

    const finalTransput: BigNumber = getSingleTradeTransput(tradeType, tradeExact, tradeAmount, reserves)

    if (tradeType === TRADE_TYPE.ETH_TO_TOKEN) {
      if (!areTokenReservesNormalized(outputReservesPost)) {
        throw Error
      }

      outputReservesPost.ethReserve.amount = outputReservesPost.ethReserve.amount.plus(
        tradeExact === TRADE_EXACT.INPUT ? tradeAmount : finalTransput
      )
      outputReservesPost.tokenReserve.amount = outputReservesPost.tokenReserve.amount.minus(
        tradeExact === TRADE_EXACT.INPUT ? finalTransput : tradeAmount
      )
    } else {
      if (!areTokenReservesNormalized(inputReservesPost)) {
        throw Error
      }

      inputReservesPost.ethReserve.amount = inputReservesPost.ethReserve.amount.minus(
        tradeExact === TRADE_EXACT.INPUT ? finalTransput : tradeAmount
      )
      inputReservesPost.tokenReserve.amount = inputReservesPost.tokenReserve.amount.plus(
        tradeExact === TRADE_EXACT.INPUT ? tradeAmount : finalTransput
      )
    }

    return {
      transput: finalTransput,
      inputReservesPost,
      outputReservesPost
    }
  }
}

// slippage in basis points, to 18 decimals
function calculateSlippage(baseRate: BigNumber, newRate: BigNumber): BigNumber {
  const difference: BigNumber = baseRate.minus(newRate).absoluteValue()
  return difference.multipliedBy(_10000).dividedBy(baseRate)
}

export function getTradeDetails(
  tradeExact: TRADE_EXACT,
  _tradeAmount: BigNumberish,
  marketDetails: MarketDetails
): TradeDetails {
  const tradeAmount: BigNumber = normalizeBigNumberish(_tradeAmount)

  // get other input/output amount
  const { transput, inputReservesPost, outputReservesPost }: _PartialTradeDetails = getTradeTransput(
    marketDetails.tradeType,
    tradeExact,
    tradeAmount,
    marketDetails.inputReserves,
    marketDetails.outputReserves
  )

  // get input and output amounts
  const inputAmount: TokenAmountNormalized = {
    token: marketDetails.inputReserves.token,
    amount: tradeExact === TRADE_EXACT.INPUT ? tradeAmount : transput
  }
  const outputAmount: TokenAmountNormalized = {
    token: marketDetails.outputReserves.token,
    amount: tradeExact === TRADE_EXACT.INPUT ? transput : tradeAmount
  }

  const marketDetailsPost: MarketDetails = getMarketDetails(inputReservesPost, outputReservesPost)

  const executionRate: Rate = calculateDecimalRate(outputAmount, inputAmount) as Rate

  const marketRateSlippage: BigNumber = calculateSlippage(
    marketDetails.marketRate.rate,
    marketDetailsPost.marketRate.rate
  )
  const executionRateSlippage: BigNumber = calculateSlippage(marketDetails.marketRate.rate, executionRate.rate)

  return {
    marketDetailsPre: marketDetails,
    marketDetailsPost,
    tradeType: marketDetails.tradeType,
    tradeExact,
    inputAmount,
    outputAmount,
    executionRate,
    marketRateSlippage,
    executionRateSlippage
  }
}
