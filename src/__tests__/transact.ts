import { TradeDetails, ExecutionDetails } from '../types'
import { TRADE_METHODS, TRADE_METHOD_IDS } from '../constants'
import { tradeExactEthForTokens } from '../orchestration'
import { getExecutionDetails } from '../transact'

describe('tradeExactEthForTokens', (): void => {
  jest.setTimeout(10000) // 10 seconds

  test('DAI', async (done: jest.DoneCallback): Promise<void> => {
    const tradeDetails: TradeDetails = await tradeExactEthForTokens(
      '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359',
      '1000000000000000000'
    )

    const executionDetails: ExecutionDetails = getExecutionDetails(tradeDetails)

    expect(executionDetails.exchangeAddress).toEqual('0x09cabEC1eAd1c0Ba254B09efb3EE13841712bE14')
    expect(executionDetails.methodName).toEqual(TRADE_METHODS.ethToTokenSwapInput)
    expect(executionDetails.methodId).toEqual(TRADE_METHOD_IDS[TRADE_METHODS.ethToTokenSwapInput])
    expect(executionDetails.value.toFixed()).toEqual('1000000000000000000')

    done()
  })
})
