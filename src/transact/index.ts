import BigNumber from 'bignumber.js'

import {
  TokenReservesNormalized,
  TradeDetails,
  MethodArgument,
  ExecutionDetails,
  _SlippageBounds,
  _PartialExecutionDetails
} from '../types'
import { _0, _1, _10000, _MAX_UINT256, TRADE_TYPE, TRADE_EXACT, TRADE_METHODS, TRADE_METHOD_IDS } from '../constants'
import { normalizeAddress } from '../_utils'

function removeUndefined(methodArguments: (MethodArgument | undefined)[]): MethodArgument[] {
  return methodArguments.filter((a: MethodArgument | undefined): boolean => a !== undefined) as MethodArgument[]
}

function calculateSlippage(value: BigNumber, maxSlippage: number): _SlippageBounds {
  const offset: BigNumber = value.multipliedBy(maxSlippage).dividedBy(_10000)
  const minimum: BigNumber = value.minus(offset).integerValue(BigNumber.ROUND_FLOOR)
  const maximum: BigNumber = value.plus(offset).integerValue(BigNumber.ROUND_CEIL)
  return {
    minimum: minimum.isLessThan(_0) ? _0 : minimum,
    maximum: maximum.isGreaterThan(_MAX_UINT256) ? _MAX_UINT256 : maximum
  }
}

function getReserves(trade: TradeDetails): TokenReservesNormalized {
  switch (trade.tradeType) {
    case TRADE_TYPE.ETH_TO_TOKEN: {
      return trade.marketDetailsPre.outputReserves as TokenReservesNormalized
    }
    case TRADE_TYPE.TOKEN_TO_ETH: {
      return trade.marketDetailsPre.inputReserves as TokenReservesNormalized
    }
    case TRADE_TYPE.TOKEN_TO_TOKEN: {
      return trade.marketDetailsPre.inputReserves as TokenReservesNormalized
    }
    default: {
      throw Error(`tradeType ${trade.tradeType} is invalid.`)
    }
  }
}

function getMethodName(trade: TradeDetails, transfer: boolean = false): string {
  switch (trade.tradeType) {
    case TRADE_TYPE.ETH_TO_TOKEN: {
      if (trade.tradeExact === TRADE_EXACT.INPUT && !transfer) {
        return TRADE_METHODS.ethToTokenSwapInput
      } else if (trade.tradeExact === TRADE_EXACT.INPUT && transfer) {
        return TRADE_METHODS.ethToTokenTransferInput
      } else if (trade.tradeExact === TRADE_EXACT.OUTPUT && !transfer) {
        return TRADE_METHODS.ethToTokenSwapOutput
      } else {
        return TRADE_METHODS.ethToTokenTransferOutput
      }
    }
    case TRADE_TYPE.TOKEN_TO_ETH: {
      if (trade.tradeExact === TRADE_EXACT.INPUT && !transfer) {
        return TRADE_METHODS.tokenToEthSwapInput
      } else if (trade.tradeExact === TRADE_EXACT.INPUT && transfer) {
        return TRADE_METHODS.tokenToEthTransferInput
      } else if (trade.tradeExact === TRADE_EXACT.OUTPUT && !transfer) {
        return TRADE_METHODS.tokenToEthSwapOutput
      } else {
        return TRADE_METHODS.tokenToEthTransferOutput
      }
    }
    case TRADE_TYPE.TOKEN_TO_TOKEN: {
      if (trade.tradeExact === TRADE_EXACT.INPUT && !transfer) {
        return TRADE_METHODS.tokenToTokenSwapInput
      } else if (trade.tradeExact === TRADE_EXACT.INPUT && transfer) {
        return TRADE_METHODS.tokenToTokenTransferInput
      } else if (trade.tradeExact === TRADE_EXACT.OUTPUT && !transfer) {
        return TRADE_METHODS.tokenToTokenSwapOutput
      } else {
        return TRADE_METHODS.tokenToTokenTransferOutput
      }
    }
    default: {
      throw Error(`tradeType ${trade.tradeType} is invalid.`)
    }
  }
}

function getValueAndMethodArguments(
  trade: TradeDetails,
  methodName: string,
  maxSlippage: number,
  deadline: number,
  recipient?: string
): _PartialExecutionDetails {
  switch (methodName) {
    case TRADE_METHODS.ethToTokenSwapInput:
    case TRADE_METHODS.ethToTokenTransferInput: {
      return {
        value: trade.inputAmount.amount,
        methodArguments: removeUndefined([
          calculateSlippage(trade.outputAmount.amount, maxSlippage).minimum,
          deadline,
          recipient
        ])
      }
    }
    case TRADE_METHODS.ethToTokenSwapOutput:
    case TRADE_METHODS.ethToTokenTransferOutput: {
      return {
        value: calculateSlippage(trade.inputAmount.amount, maxSlippage).maximum,
        methodArguments: removeUndefined([trade.outputAmount.amount, deadline, recipient])
      }
    }
    case TRADE_METHODS.tokenToEthSwapInput:
    case TRADE_METHODS.tokenToEthTransferInput: {
      return {
        value: _0,
        methodArguments: removeUndefined([
          trade.inputAmount.amount,
          calculateSlippage(trade.outputAmount.amount, maxSlippage).minimum,
          deadline,
          recipient
        ])
      }
    }
    case TRADE_METHODS.tokenToEthSwapOutput:
    case TRADE_METHODS.tokenToEthTransferOutput: {
      return {
        value: _0,
        methodArguments: removeUndefined([
          trade.outputAmount.amount,
          calculateSlippage(trade.inputAmount.amount, maxSlippage).maximum,
          deadline,
          recipient
        ])
      }
    }
    case TRADE_METHODS.tokenToTokenSwapInput:
    case TRADE_METHODS.tokenToTokenTransferInput: {
      if (!trade.outputAmount.token.address) {
        throw Error('trade does not include output token address.')
      }
      return {
        value: _0,
        methodArguments: removeUndefined([
          trade.inputAmount.amount,
          calculateSlippage(trade.outputAmount.amount, maxSlippage).minimum,
          _1,
          deadline,
          recipient,
          trade.outputAmount.token.address
        ])
      }
    }
    case TRADE_METHODS.tokenToTokenSwapOutput:
    case TRADE_METHODS.tokenToTokenTransferOutput: {
      if (!trade.outputAmount.token.address) {
        throw Error('trade does not include output token address.')
      }
      return {
        value: _0,
        methodArguments: removeUndefined([
          trade.outputAmount.amount,
          calculateSlippage(trade.inputAmount.amount, maxSlippage).maximum,
          _MAX_UINT256,
          deadline,
          recipient,
          trade.outputAmount.token.address
        ])
      }
    }
    default: {
      throw Error(`methodName ${methodName} is invalid.`)
    }
  }
}

export function getExecutionDetails(
  trade: TradeDetails,
  maxSlippage?: number,
  deadline?: number,
  recipient?: string
): ExecutionDetails {
  const reserves: TokenReservesNormalized = getReserves(trade)
  if (!reserves.exchange || !reserves.exchange.address) {
    throw Error('trade does not include exchange address.')
  }

  const methodName: string = getMethodName(trade, !!recipient)
  const methodId: string = TRADE_METHOD_IDS[methodName]

  const { value, methodArguments }: _PartialExecutionDetails = getValueAndMethodArguments(
    trade,
    methodName,
    maxSlippage || 200,
    deadline || Math.round(Date.now() / 1000 + 60 * 10),
    recipient && normalizeAddress(recipient)
  )

  return {
    exchangeAddress: reserves.exchange.address,
    methodName,
    methodId,
    value,
    methodArguments: methodArguments
  }
}
