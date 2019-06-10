import { TradeDetails } from '../types'
import { tradeExactEthForTokens } from '../orchestration'
import { TRADE_TYPE, TRADE_EXACT } from '../constants'

describe('tradeExactEthForTokens', (): void => {
  jest.setTimeout(10000) // 10 seconds

  test('DAI', async (done: jest.DoneCallback): Promise<void> => {
    const tradeDetails: TradeDetails = await tradeExactEthForTokens(
      '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359',
      '1000000000000000000'
    )

    expect(tradeDetails.tradeType).toEqual(TRADE_TYPE.ETH_TO_TOKEN)
    expect(tradeDetails.tradeExact).toEqual(TRADE_EXACT.INPUT)
    expect(tradeDetails.inputAmount.amount.toFixed()).toEqual('1000000000000000000')
    expect(tradeDetails.outputAmount.amount).toBeTruthy()
    expect(tradeDetails.executionRate.rate).toBeTruthy()
    expect(tradeDetails.executionRate.rateInverted).toBeTruthy()
    expect(tradeDetails.marketRateSlippage).toBeTruthy()
    expect(tradeDetails.executionRateSlippage).toBeTruthy()

    done()
  })
})
