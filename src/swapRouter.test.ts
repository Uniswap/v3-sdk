import { ChainId, CurrencyAmount, ETHER, Percent, Token, TokenAmount, TradeType, WETH9 } from '@uniswap/sdk-core'
import { FeeAmount, TICK_SPACINGS } from './constants'
import { Pool } from './entities/pool'
import { SwapRouter } from './swapRouter'
import { nearestUsableTick, TickMath } from './utils'
import { encodeSqrtRatioX96 } from './utils/encodeSqrtRatioX96'
import { Route, Trade } from './entities'

const RECIPIENT = '0x0000000000000000000000000000000000000003'

describe('NonfungiblePositionManager', () => {
  const token0 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000001', 18, 't0', 'token0')
  const token1 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000002', 18, 't1', 'token1')

  const feeAmount = FeeAmount.MEDIUM
  const sqrtRatioX96 = encodeSqrtRatioX96(1, 1)
  const liquidity = 1_000_000

  const pool_0_1 = new Pool(
    token0,
    token1,
    feeAmount,
    sqrtRatioX96,
    liquidity,
    TickMath.getTickAtSqrtRatio(sqrtRatioX96),
    [
      {
        index: nearestUsableTick(TickMath.MIN_TICK, TICK_SPACINGS[feeAmount]),
        liquidityNet: liquidity,
        liquidityGross: liquidity
      },
      {
        index: nearestUsableTick(TickMath.MAX_TICK, TICK_SPACINGS[feeAmount]),
        liquidityNet: -liquidity,
        liquidityGross: liquidity
      }
    ]
  )
  const pool_weth_0 = new Pool(
    WETH9[ChainId.MAINNET],
    token0,
    feeAmount,
    sqrtRatioX96,
    liquidity,
    TickMath.getTickAtSqrtRatio(sqrtRatioX96),
    [
      {
        index: nearestUsableTick(TickMath.MIN_TICK, TICK_SPACINGS[feeAmount]),
        liquidityNet: liquidity,
        liquidityGross: liquidity
      },
      {
        index: nearestUsableTick(TickMath.MAX_TICK, TICK_SPACINGS[feeAmount]),
        liquidityNet: -liquidity,
        liquidityGross: liquidity
      }
    ]
  )

  describe('#swapCallParameters', () => {
    it('works', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_0_1], token0),
        new TokenAmount(token0, 100),
        TradeType.EXACT_INPUT
      )
      const { calldata, value } = SwapRouter.swapCallParameters(trade, {
        slippageTolerance: new Percent(1, 100),
        recipient: RECIPIENT,
        deadline: 1
      })

      expect(calldata).toBe(
        '0x414bf389000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000bb800000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000610000000000000000000000000000000000000000000000000000000000000000'
      )
      expect(value).toBe('0x00')
    })

    it('works with ETH input', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_weth_0], ETHER),
        CurrencyAmount.ether(100),
        TradeType.EXACT_INPUT
      )
      const { calldata, value } = SwapRouter.swapCallParameters(trade, {
        slippageTolerance: new Percent(1, 100),
        recipient: RECIPIENT,
        deadline: 1
      })

      expect(calldata).toBe(
        '0x414bf389000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000bb800000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000610000000000000000000000000000000000000000000000000000000000000000'
      )
      expect(value).toBe('0x64')
    })
  })
})
