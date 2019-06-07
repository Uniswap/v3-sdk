import BigNumber from 'bignumber.js'

import { TradeDetails } from '../types'
import { _10, ETH, TRADE_TYPE, TRADE_EXACT } from '../constants'
import { getTrade } from '../orchestration'

describe('getTrade', (): void => {
  test('DAI', async (done: jest.DoneCallback): Promise<void> => {
    jest.setTimeout(10000) // 10 seconds
    const tradeDetails: TradeDetails = await getTrade(
      ETH,
      '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359',
      TRADE_TYPE.ETH_TO_TOKEN,
      TRADE_EXACT.OUTPUT,
      new BigNumber(100).multipliedBy(_10.exponentiatedBy(18))
    )
    expect(tradeDetails.inputAmount).toBeTruthy()
    done()
  })
})
