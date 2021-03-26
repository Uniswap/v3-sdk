import { ChainId, Token } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { FeeAmount } from '../constants'
import { encodeSqrtRatioX96 } from '../utils/encodeSqrtRatioX96'
import { Pool } from './pool'
import { Position } from './position'
import { TickList } from './tickList'

describe('Position', () => {
  const USDC = new Token(ChainId.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin')
  const DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
  const EMPTY_POOL = new Pool(
    DAI,
    USDC,
    FeeAmount.LOW,
    encodeSqrtRatioX96(100e6, 100e18),
    0,
    new TickList({ ticks: [] })
  )

  it('can be constructed', () => {
    const position = new Position({
      pool: EMPTY_POOL,
      liquidity: 1,
      tickLower: -10,
      tickUpper: 10
    })
    expect(position.liquidity).toEqual(JSBI.BigInt(1))
  })
})
