import { ChainId, CurrencyAmount, ETHER, Percent, sqrt, Token, TokenAmount, TradeType, WETH9 } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { FeeAmount, TICK_SPACINGS } from '../constants'
import { encodeSqrtRatioX96 } from '../utils/encodeSqrtRatioX96'
import { nearestUsableTick } from '../utils/nearestUsableTick'
import { TickMath } from '../utils/tickMath'
import { Pool } from './pool'
import { Route } from './route'
import { Trade } from './trade'

describe('Trade', () => {
  const token0 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000001', 18, 't0', 'token0')
  const token1 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000002', 18, 't1', 'token1')
  const token2 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000003', 18, 't2', 'token2')
  const token3 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000004', 18, 't3', 'token3')

  function v2StylePool(reserve0: TokenAmount, reserve1: TokenAmount, feeAmount: FeeAmount = FeeAmount.MEDIUM) {
    const sqrtRatioX96 = encodeSqrtRatioX96(reserve1.raw, reserve0.raw)
    const liquidity = sqrt(JSBI.multiply(reserve0.raw, reserve1.raw))
    return new Pool(
      reserve0.token,
      reserve1.token,
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
          liquidityNet: JSBI.multiply(liquidity, JSBI.BigInt(-1)),
          liquidityGross: liquidity
        }
      ]
    )
  }

  const pool_0_1 = v2StylePool(new TokenAmount(token0, 100000), new TokenAmount(token1, 100000))
  const pool_0_2 = v2StylePool(new TokenAmount(token0, 100000), new TokenAmount(token2, 110000))
  const pool_0_3 = v2StylePool(new TokenAmount(token0, 100000), new TokenAmount(token3, 90000))
  const pool_1_2 = v2StylePool(new TokenAmount(token1, 120000), new TokenAmount(token2, 100000))
  const pool_1_3 = v2StylePool(new TokenAmount(token1, 120000), new TokenAmount(token3, 130000))

  const pool_weth_0 = v2StylePool(
    new TokenAmount(WETH9[ChainId.MAINNET], JSBI.BigInt(100000)),
    new TokenAmount(token0, JSBI.BigInt(100000))
  )

  it('can be constructed with ETHER as input', () => {
    const trade = new Trade(
      new Route([pool_weth_0], ETHER),
      CurrencyAmount.ether(JSBI.BigInt(10000)),
      TradeType.EXACT_INPUT
    )
    expect(trade.inputAmount.currency).toEqual(ETHER)
    expect(trade.outputAmount.currency).toEqual(token0)
  })
  it('can be constructed with ETHER as input for exact output', () => {
    const trade = new Trade(
      new Route([pool_weth_0], ETHER, token0),
      new TokenAmount(token0, JSBI.BigInt(10000)),
      TradeType.EXACT_OUTPUT
    )
    expect(trade.inputAmount.currency).toEqual(ETHER)
    expect(trade.outputAmount.currency).toEqual(token0)
  })

  it('can be constructed with ETHER as output', () => {
    const trade = new Trade(
      new Route([pool_weth_0], token0, ETHER),
      CurrencyAmount.ether(JSBI.BigInt(10000)),
      TradeType.EXACT_OUTPUT
    )
    expect(trade.inputAmount.currency).toEqual(token0)
    expect(trade.outputAmount.currency).toEqual(ETHER)
  })
  it('can be constructed with ETHER as output for exact input', () => {
    const trade = new Trade(
      new Route([pool_weth_0], token0, ETHER),
      new TokenAmount(token0, JSBI.BigInt(10000)),
      TradeType.EXACT_INPUT
    )
    expect(trade.inputAmount.currency).toEqual(token0)
    expect(trade.outputAmount.currency).toEqual(ETHER)
  })

  describe('#bestTradeExactIn', () => {
    it('throws with empty pools', () => {
      expect(() => Trade.bestTradeExactIn([], new TokenAmount(token0, JSBI.BigInt(10000)), token2)).toThrow('POOLS')
    })
    it('throws with max hops of 0', () => {
      expect(() =>
        Trade.bestTradeExactIn([pool_0_2], new TokenAmount(token0, JSBI.BigInt(10000)), token2, { maxHops: 0 })
      ).toThrow('MAX_HOPS')
    })

    it('provides best route', () => {
      const result = Trade.bestTradeExactIn([pool_0_1, pool_0_2, pool_1_2], new TokenAmount(token0, 10000), token2)
      expect(result).toHaveLength(2)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
      expect(result[0].inputAmount).toEqual(new TokenAmount(token0, JSBI.BigInt(10000)))
      expect(result[0].outputAmount).toEqual(new TokenAmount(token2, JSBI.BigInt(9971)))
      expect(result[1].route.pools).toHaveLength(2) // 0 -> 1 -> 2 at 12:12:10
      expect(result[1].route.tokenPath).toEqual([token0, token1, token2])
      expect(result[1].inputAmount).toEqual(new TokenAmount(token0, JSBI.BigInt(10000)))
      expect(result[1].outputAmount).toEqual(new TokenAmount(token2, JSBI.BigInt(7004)))
    })

    it('respects maxHops', () => {
      const result = Trade.bestTradeExactIn(
        [pool_0_1, pool_0_2, pool_1_2],
        new TokenAmount(token0, JSBI.BigInt(10)),
        token2,
        { maxHops: 1 }
      )
      expect(result).toHaveLength(1)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
    })

    it('insufficient input for one pool', () => {
      const result = Trade.bestTradeExactIn([pool_0_1, pool_0_2, pool_1_2], new TokenAmount(token0, 1), token2)
      expect(result).toHaveLength(2)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
      expect(result[0].outputAmount).toEqual(new TokenAmount(token2, 0))
    })

    it('respects n', () => {
      const result = Trade.bestTradeExactIn(
        [pool_0_1, pool_0_2, pool_1_2],
        new TokenAmount(token0, JSBI.BigInt(10)),
        token2,
        { maxNumResults: 1 }
      )

      expect(result).toHaveLength(1)
    })

    it('no path', () => {
      const result = Trade.bestTradeExactIn(
        [pool_0_1, pool_0_3, pool_1_3],
        new TokenAmount(token0, JSBI.BigInt(10)),
        token2
      )
      expect(result).toHaveLength(0)
    })

    it('works for ETHER currency input', () => {
      const result = Trade.bestTradeExactIn(
        [pool_weth_0, pool_0_1, pool_0_3, pool_1_3],
        CurrencyAmount.ether(JSBI.BigInt(100)),
        token3
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(ETHER)
      expect(result[0].route.tokenPath).toEqual([WETH9[ChainId.MAINNET], token0, token1, token3])
      expect(result[0].outputAmount.currency).toEqual(token3)
      expect(result[1].inputAmount.currency).toEqual(ETHER)
      expect(result[1].route.tokenPath).toEqual([WETH9[ChainId.MAINNET], token0, token3])
      expect(result[1].outputAmount.currency).toEqual(token3)
    })

    it('works for ETHER currency output', () => {
      const result = Trade.bestTradeExactIn(
        [pool_weth_0, pool_0_1, pool_0_3, pool_1_3],
        new TokenAmount(token3, JSBI.BigInt(100)),
        ETHER
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(token3)
      expect(result[0].route.tokenPath).toEqual([token3, token0, WETH9[ChainId.MAINNET]])
      expect(result[0].outputAmount.currency).toEqual(ETHER)
      expect(result[1].inputAmount.currency).toEqual(token3)
      expect(result[1].route.tokenPath).toEqual([token3, token1, token0, WETH9[ChainId.MAINNET]])
      expect(result[1].outputAmount.currency).toEqual(ETHER)
    })
  })

  describe('#maximumAmountIn', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = new Trade(
        new Route([pool_0_1, pool_1_2], token0),
        new TokenAmount(token0, JSBI.BigInt(100)),
        TradeType.EXACT_INPUT
      )
      it('throws if less than 0', () => {
        expect(() => exactIn.maximumAmountIn(new Percent(JSBI.BigInt(-1), JSBI.BigInt(100)))).toThrow(
          'SLIPPAGE_TOLERANCE'
        )
      })
      it('returns exact if 0', () => {
        expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(exactIn.inputAmount)
      })
      it('returns exact if nonzero', () => {
        expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token0, JSBI.BigInt(100))
        )
        expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token0, JSBI.BigInt(100))
        )
        expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token0, JSBI.BigInt(100))
        )
      })
    })

    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = new Trade(
        new Route([pool_0_1, pool_1_2], token0),
        new TokenAmount(token2, 10000),
        TradeType.EXACT_OUTPUT
      )

      it('throws if less than 0', () => {
        expect(() => exactOut.maximumAmountIn(new Percent(JSBI.BigInt(-1), 10000))).toThrow('SLIPPAGE_TOLERANCE')
      })

      it('returns exact if 0', () => {
        expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(0), 10000))).toEqual(exactOut.inputAmount)
      })

      it('returns slippage amount if nonzero', () => {
        expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(0), 100))).toEqual(new TokenAmount(token0, 15488))
        expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token0, 16262)
        )
        expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token0, 46464)
        )
      })
    })
  })

  describe('#minimumAmountOut', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = new Trade(
        new Route([pool_0_1, pool_1_2], token0),
        new TokenAmount(token0, 10000),
        TradeType.EXACT_INPUT
      )

      it('throws if less than 0', () => {
        expect(() => exactIn.minimumAmountOut(new Percent(JSBI.BigInt(-1), 100))).toThrow('SLIPPAGE_TOLERANCE')
      })

      it('returns exact if 0', () => {
        expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(0), 10000))).toEqual(exactIn.outputAmount)
      })

      it('returns exact if nonzero', () => {
        expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(0), 100))).toEqual(new TokenAmount(token2, 7004))
        expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(5), 100))).toEqual(new TokenAmount(token2, 6670))
        expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(200), 100))).toEqual(new TokenAmount(token2, 2334))
      })
    })
    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = new Trade(
        new Route([pool_0_1, pool_1_2], token0),
        new TokenAmount(token2, JSBI.BigInt(100)),
        TradeType.EXACT_OUTPUT
      )

      it('throws if less than 0', () => {
        expect(() => exactOut.minimumAmountOut(new Percent(JSBI.BigInt(-1), JSBI.BigInt(100)))).toThrow(
          'SLIPPAGE_TOLERANCE'
        )
      })
      it('returns exact if 0', () => {
        expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(exactOut.outputAmount)
      })
      it('returns slippage amount if nonzero', () => {
        expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token2, JSBI.BigInt(100))
        )
        expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token2, JSBI.BigInt(100))
        )
        expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
          new TokenAmount(token2, JSBI.BigInt(100))
        )
      })
    })
  })

  describe('#bestTradeExactOut', () => {
    it('throws with empty pools', () => {
      expect(() => Trade.bestTradeExactOut([], token0, new TokenAmount(token2, JSBI.BigInt(100)))).toThrow('POOLS')
    })
    it('throws with max hops of 0', () => {
      expect(() =>
        Trade.bestTradeExactOut([pool_0_2], token0, new TokenAmount(token2, JSBI.BigInt(100)), { maxHops: 0 })
      ).toThrow('MAX_HOPS')
    })

    it('provides best route', () => {
      const result = Trade.bestTradeExactOut([pool_0_1, pool_0_2, pool_1_2], token0, new TokenAmount(token2, 10000))
      expect(result).toHaveLength(2)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
      expect(result[0].inputAmount).toEqual(new TokenAmount(token0, 10032))
      expect(result[0].outputAmount).toEqual(new TokenAmount(token2, 10000))
      expect(result[1].route.pools).toHaveLength(2) // 0 -> 1 -> 2 at 12:12:10
      expect(result[1].route.tokenPath).toEqual([token0, token1, token2])
      expect(result[1].inputAmount).toEqual(new TokenAmount(token0, 15488))
      expect(result[1].outputAmount).toEqual(new TokenAmount(token2, 10000))
    })

    it('respects maxHops', () => {
      const result = Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        new TokenAmount(token2, JSBI.BigInt(10)),
        { maxHops: 1 }
      )
      expect(result).toHaveLength(1)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
    })

    it.skip('insufficient liquidity', () => {
      const result = Trade.bestTradeExactOut([pool_0_1, pool_0_2, pool_1_2], token0, new TokenAmount(token2, 1200))
      expect(result).toHaveLength(0)
    })

    it.skip('insufficient liquidity in one pool but not the other', () => {
      const result = Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        new TokenAmount(token2, JSBI.BigInt(1050))
      )
      expect(result).toHaveLength(1)
    })

    it('respects n', () => {
      const result = Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        new TokenAmount(token2, JSBI.BigInt(10)),
        { maxNumResults: 1 }
      )

      expect(result).toHaveLength(1)
    })

    it('no path', () => {
      const result = Trade.bestTradeExactOut(
        [pool_0_1, pool_0_3, pool_1_3],
        token0,
        new TokenAmount(token2, JSBI.BigInt(10))
      )
      expect(result).toHaveLength(0)
    })

    it('works for ETHER currency input', () => {
      const result = Trade.bestTradeExactOut(
        [pool_weth_0, pool_0_1, pool_0_3, pool_1_3],
        ETHER,
        new TokenAmount(token3, 10000)
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(ETHER)
      expect(result[0].route.tokenPath).toEqual([WETH9[ChainId.MAINNET], token0, token1, token3])
      expect(result[0].outputAmount.currency).toEqual(token3)
      expect(result[1].inputAmount.currency).toEqual(ETHER)
      expect(result[1].route.tokenPath).toEqual([WETH9[ChainId.MAINNET], token0, token3])
      expect(result[1].outputAmount.currency).toEqual(token3)
    })
    it('works for ETHER currency output', () => {
      const result = Trade.bestTradeExactOut(
        [pool_weth_0, pool_0_1, pool_0_3, pool_1_3],
        token3,
        CurrencyAmount.ether(JSBI.BigInt(100))
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(token3)
      expect(result[0].route.tokenPath).toEqual([token3, token0, WETH9[ChainId.MAINNET]])
      expect(result[0].outputAmount.currency).toEqual(ETHER)
      expect(result[1].inputAmount.currency).toEqual(token3)
      expect(result[1].route.tokenPath).toEqual([token3, token1, token0, WETH9[ChainId.MAINNET]])
      expect(result[1].outputAmount.currency).toEqual(ETHER)
    })
  })
})
