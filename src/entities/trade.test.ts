import { Percent, Price, sqrt, Token, CurrencyAmount, TradeType, WETH9, Ether } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { FeeAmount, TICK_SPACINGS } from '../constants'
import { encodeSqrtRatioX96 } from '../utils/encodeSqrtRatioX96'
import { nearestUsableTick } from '../utils/nearestUsableTick'
import { TickMath } from '../utils/tickMath'
import { Pool } from './pool'
import { Route } from './route'
import { Trade } from './trade'

describe('Trade', () => {
  const ETHER = Ether.onChain(1)
  const token0 = new Token(1, '0x0000000000000000000000000000000000000001', 18, 't0', 'token0')
  const token1 = new Token(1, '0x0000000000000000000000000000000000000002', 18, 't1', 'token1')
  const token2 = new Token(1, '0x0000000000000000000000000000000000000003', 18, 't2', 'token2')
  const token3 = new Token(1, '0x0000000000000000000000000000000000000004', 18, 't3', 'token3')

  function v2StylePool(
    reserve0: CurrencyAmount<Token>,
    reserve1: CurrencyAmount<Token>,
    feeAmount: FeeAmount = FeeAmount.MEDIUM
  ) {
    const sqrtRatioX96 = encodeSqrtRatioX96(reserve1.quotient, reserve0.quotient)
    const liquidity = sqrt(JSBI.multiply(reserve0.quotient, reserve1.quotient))
    return new Pool(
      reserve0.currency,
      reserve1.currency,
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

  const pool_0_1 = v2StylePool(
    CurrencyAmount.fromRawAmount(token0, 100000),
    CurrencyAmount.fromRawAmount(token1, 100000)
  )
  const pool_0_2 = v2StylePool(
    CurrencyAmount.fromRawAmount(token0, 100000),
    CurrencyAmount.fromRawAmount(token2, 110000)
  )
  const pool_0_3 = v2StylePool(
    CurrencyAmount.fromRawAmount(token0, 100000),
    CurrencyAmount.fromRawAmount(token3, 90000)
  )
  const pool_1_2 = v2StylePool(
    CurrencyAmount.fromRawAmount(token1, 120000),
    CurrencyAmount.fromRawAmount(token2, 100000)
  )
  const pool_1_3 = v2StylePool(
    CurrencyAmount.fromRawAmount(token1, 120000),
    CurrencyAmount.fromRawAmount(token3, 130000)
  )

  const pool_weth_0 = v2StylePool(
    CurrencyAmount.fromRawAmount(WETH9[1], JSBI.BigInt(100000)),
    CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(100000))
  )

  it('can be constructed with ETHER as input', async () => {
    const trade = await Trade.fromRoute(
      new Route([pool_weth_0], ETHER, token0),
      CurrencyAmount.fromRawAmount(Ether.onChain(1), JSBI.BigInt(10000)),
      TradeType.EXACT_INPUT
    )
    expect(trade.inputAmount.currency).toEqual(ETHER)
    expect(trade.outputAmount.currency).toEqual(token0)
  })
  it('can be constructed with ETHER as input for exact output', async () => {
    const trade = await Trade.fromRoute(
      new Route([pool_weth_0], ETHER, token0),
      CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(10000)),
      TradeType.EXACT_OUTPUT
    )
    expect(trade.inputAmount.currency).toEqual(ETHER)
    expect(trade.outputAmount.currency).toEqual(token0)
  })

  it('can be constructed with ETHER as output', async () => {
    const trade = await Trade.fromRoute(
      new Route([pool_weth_0], token0, ETHER),
      CurrencyAmount.fromRawAmount(Ether.onChain(1), JSBI.BigInt(10000)),
      TradeType.EXACT_OUTPUT
    )
    expect(trade.inputAmount.currency).toEqual(token0)
    expect(trade.outputAmount.currency).toEqual(ETHER)
  })
  it('can be constructed with ETHER as output for exact input', async () => {
    const trade = await Trade.fromRoute(
      new Route([pool_weth_0], token0, ETHER),
      CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(10000)),
      TradeType.EXACT_INPUT
    )
    expect(trade.inputAmount.currency).toEqual(token0)
    expect(trade.outputAmount.currency).toEqual(ETHER)
  })

  describe('#createUncheckedTrade', () => {
    it('throws if input currency does not match route', () => {
      expect(() =>
        Trade.createUncheckedTrade({
          route: new Route([pool_0_1], token0, token1),
          inputAmount: CurrencyAmount.fromRawAmount(token2, 10000),
          outputAmount: CurrencyAmount.fromRawAmount(token1, 10000),
          tradeType: TradeType.EXACT_INPUT
        })
      ).toThrow('INPUT_CURRENCY_MATCH')
    })
    it('throws if output currency does not match route', () => {
      expect(() =>
        Trade.createUncheckedTrade({
          route: new Route([pool_0_1], token0, token1),
          inputAmount: CurrencyAmount.fromRawAmount(token0, 10000),
          outputAmount: CurrencyAmount.fromRawAmount(token2, 10000),
          tradeType: TradeType.EXACT_INPUT
        })
      ).toThrow('OUTPUT_CURRENCY_MATCH')
    })
    it('can create an exact input trade without simulating', () => {
      Trade.createUncheckedTrade({
        route: new Route([pool_0_1], token0, token1),
        inputAmount: CurrencyAmount.fromRawAmount(token0, 10000),
        outputAmount: CurrencyAmount.fromRawAmount(token1, 100000),
        tradeType: TradeType.EXACT_INPUT
      })
    })
    it('can create an exact output trade without simulating', () => {
      Trade.createUncheckedTrade({
        route: new Route([pool_0_1], token0, token1),
        inputAmount: CurrencyAmount.fromRawAmount(token0, 10000),
        outputAmount: CurrencyAmount.fromRawAmount(token1, 100000),
        tradeType: TradeType.EXACT_OUTPUT
      })
    })
  })

  describe('#worstExecutionPrice', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = Trade.createUncheckedTrade({
        route: new Route([pool_0_1, pool_1_2], token0, token2),
        inputAmount: CurrencyAmount.fromRawAmount(token0, 100),
        outputAmount: CurrencyAmount.fromRawAmount(token2, 69),
        tradeType: TradeType.EXACT_INPUT
      })
      it('throws if less than 0', () => {
        expect(() => exactIn.minimumAmountOut(new Percent(-1, 100))).toThrow('SLIPPAGE_TOLERANCE')
      })
      it('returns exact if 0', () => {
        expect(exactIn.worstExecutionPrice(new Percent(0, 100))).toEqual(exactIn.executionPrice)
      })
      it('returns exact if nonzero', () => {
        expect(exactIn.worstExecutionPrice(new Percent(0, 100))).toEqual(new Price(token0, token2, 100, 69))
        expect(exactIn.worstExecutionPrice(new Percent(5, 100))).toEqual(new Price(token0, token2, 100, 65))
        expect(exactIn.worstExecutionPrice(new Percent(200, 100))).toEqual(new Price(token0, token2, 100, 23))
      })
    })
    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = Trade.createUncheckedTrade({
        route: new Route([pool_0_1, pool_1_2], token0, token2),
        inputAmount: CurrencyAmount.fromRawAmount(token0, 156),
        outputAmount: CurrencyAmount.fromRawAmount(token2, 100),
        tradeType: TradeType.EXACT_OUTPUT
      })

      it('throws if less than 0', () => {
        expect(() => exactOut.worstExecutionPrice(new Percent(-1, 100))).toThrow('SLIPPAGE_TOLERANCE')
      })
      it('returns exact if 0', () => {
        expect(exactOut.worstExecutionPrice(new Percent(0, 100))).toEqual(exactOut.executionPrice)
      })
      it('returns slippage amount if nonzero', () => {
        expect(exactOut.worstExecutionPrice(new Percent(0, 100))).toEqual(new Price(token0, token2, 156, 100))
        expect(exactOut.worstExecutionPrice(new Percent(5, 100))).toEqual(new Price(token0, token2, 163, 100))
        expect(exactOut.worstExecutionPrice(new Percent(200, 100))).toEqual(new Price(token0, token2, 468, 100))
      })
    })
  })

  describe('#priceImpact', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = Trade.createUncheckedTrade({
        route: new Route([pool_0_1, pool_1_2], token0, token2),
        inputAmount: CurrencyAmount.fromRawAmount(token0, 100),
        outputAmount: CurrencyAmount.fromRawAmount(token2, 69),
        tradeType: TradeType.EXACT_INPUT
      })
      it('is cached', () => {
        expect(exactIn.priceImpact === exactIn.priceImpact).toStrictEqual(true)
      })
      it('is correct', () => {
        expect(exactIn.priceImpact.toSignificant(3)).toEqual('17.2')
      })
    })
    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = Trade.createUncheckedTrade({
        route: new Route([pool_0_1, pool_1_2], token0, token2),
        inputAmount: CurrencyAmount.fromRawAmount(token0, 156),
        outputAmount: CurrencyAmount.fromRawAmount(token2, 100),
        tradeType: TradeType.EXACT_OUTPUT
      })

      it('is cached', () => {
        expect(exactOut.priceImpact === exactOut.priceImpact).toStrictEqual(true)
      })
      it('is correct', () => {
        expect(exactOut.priceImpact.toSignificant(3)).toEqual('23.1')
      })
    })
  })

  describe('#bestTradeExactIn', () => {
    it('throws with empty pools', async () => {
      await expect(
        Trade.bestTradeExactIn([], CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(10000)), token2)
      ).rejects.toThrow('POOLS')
    })
    it('throws with max hops of 0', async () => {
      await expect(
        Trade.bestTradeExactIn([pool_0_2], CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(10000)), token2, {
          maxHops: 0
        })
      ).rejects.toThrow('MAX_HOPS')
    })

    it('provides best route', async () => {
      const result = await Trade.bestTradeExactIn(
        [pool_0_1, pool_0_2, pool_1_2],
        CurrencyAmount.fromRawAmount(token0, 10000),
        token2
      )
      expect(result).toHaveLength(2)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
      expect(result[0].inputAmount).toEqual(CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(10000)))
      expect(result[0].outputAmount).toEqual(CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(9971)))
      expect(result[1].route.pools).toHaveLength(2) // 0 -> 1 -> 2 at 12:12:10
      expect(result[1].route.tokenPath).toEqual([token0, token1, token2])
      expect(result[1].inputAmount).toEqual(CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(10000)))
      expect(result[1].outputAmount).toEqual(CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(7004)))
    })

    it('respects maxHops', async () => {
      const result = await Trade.bestTradeExactIn(
        [pool_0_1, pool_0_2, pool_1_2],
        CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(10)),
        token2,
        { maxHops: 1 }
      )
      expect(result).toHaveLength(1)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
    })

    it('insufficient input for one pool', async () => {
      const result = await Trade.bestTradeExactIn(
        [pool_0_1, pool_0_2, pool_1_2],
        CurrencyAmount.fromRawAmount(token0, 1),
        token2
      )
      expect(result).toHaveLength(2)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
      expect(result[0].outputAmount).toEqual(CurrencyAmount.fromRawAmount(token2, 0))
    })

    it('respects n', async () => {
      const result = await Trade.bestTradeExactIn(
        [pool_0_1, pool_0_2, pool_1_2],
        CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(10)),
        token2,
        { maxNumResults: 1 }
      )

      expect(result).toHaveLength(1)
    })

    it('no path', async () => {
      const result = await Trade.bestTradeExactIn(
        [pool_0_1, pool_0_3, pool_1_3],
        CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(10)),
        token2
      )
      expect(result).toHaveLength(0)
    })

    it('works for ETHER currency input', async () => {
      const result = await Trade.bestTradeExactIn(
        [pool_weth_0, pool_0_1, pool_0_3, pool_1_3],
        CurrencyAmount.fromRawAmount(Ether.onChain(1), JSBI.BigInt(100)),
        token3
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(ETHER)
      expect(result[0].route.tokenPath).toEqual([WETH9[1], token0, token1, token3])
      expect(result[0].outputAmount.currency).toEqual(token3)
      expect(result[1].inputAmount.currency).toEqual(ETHER)
      expect(result[1].route.tokenPath).toEqual([WETH9[1], token0, token3])
      expect(result[1].outputAmount.currency).toEqual(token3)
    })

    it('works for ETHER currency output', async () => {
      const result = await Trade.bestTradeExactIn(
        [pool_weth_0, pool_0_1, pool_0_3, pool_1_3],
        CurrencyAmount.fromRawAmount(token3, JSBI.BigInt(100)),
        ETHER
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(token3)
      expect(result[0].route.tokenPath).toEqual([token3, token0, WETH9[1]])
      expect(result[0].outputAmount.currency).toEqual(ETHER)
      expect(result[1].inputAmount.currency).toEqual(token3)
      expect(result[1].route.tokenPath).toEqual([token3, token1, token0, WETH9[1]])
      expect(result[1].outputAmount.currency).toEqual(ETHER)
    })
  })

  describe('#maximumAmountIn', () => {
    describe('tradeType = EXACT_INPUT', () => {
      let exactIn: Trade<Token, Token, TradeType.EXACT_INPUT>
      beforeEach(async () => {
        exactIn = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(100)),
          TradeType.EXACT_INPUT
        )
      })
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
          CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(100))
        )
        expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(100))
        )
        expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(100))
        )
      })
    })

    describe('tradeType = EXACT_OUTPUT', () => {
      let exactOut: Trade<Token, Token, TradeType.EXACT_OUTPUT>
      beforeEach(async () => {
        exactOut = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token2, 10000),
          TradeType.EXACT_OUTPUT
        )
      })

      it('throws if less than 0', () => {
        expect(() => exactOut.maximumAmountIn(new Percent(JSBI.BigInt(-1), 10000))).toThrow('SLIPPAGE_TOLERANCE')
      })

      it('returns exact if 0', () => {
        expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(0), 10000))).toEqual(exactOut.inputAmount)
      })

      it('returns slippage amount if nonzero', () => {
        expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(0), 100))).toEqual(
          CurrencyAmount.fromRawAmount(token0, 15488)
        )
        expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token0, 16262)
        )
        expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token0, 46464)
        )
      })
    })
  })

  describe('#minimumAmountOut', () => {
    describe('tradeType = EXACT_INPUT', () => {
      let exactIn: Trade<Token, Token, TradeType.EXACT_INPUT>
      beforeEach(
        async () =>
          (exactIn = await Trade.fromRoute(
            new Route([pool_0_1, pool_1_2], token0, token2),
            CurrencyAmount.fromRawAmount(token0, 10000),
            TradeType.EXACT_INPUT
          ))
      )

      it('throws if less than 0', () => {
        expect(() => exactIn.minimumAmountOut(new Percent(JSBI.BigInt(-1), 100))).toThrow('SLIPPAGE_TOLERANCE')
      })

      it('returns exact if 0', () => {
        expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(0), 10000))).toEqual(exactIn.outputAmount)
      })

      it('returns exact if nonzero', () => {
        expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(0), 100))).toEqual(
          CurrencyAmount.fromRawAmount(token2, 7004)
        )
        expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(5), 100))).toEqual(
          CurrencyAmount.fromRawAmount(token2, 6670)
        )
        expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(200), 100))).toEqual(
          CurrencyAmount.fromRawAmount(token2, 2334)
        )
      })
    })
    describe('tradeType = EXACT_OUTPUT', () => {
      let exactOut: Trade<Token, Token, TradeType.EXACT_OUTPUT>
      beforeEach(async () => {
        exactOut = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(100)),
          TradeType.EXACT_OUTPUT
        )
      })

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
          CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(100))
        )
        expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(100))
        )
        expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(100))
        )
      })
    })
  })

  describe('#bestTradeExactOut', () => {
    it('throws with empty pools', async () => {
      await expect(
        Trade.bestTradeExactOut([], token0, CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(100)))
      ).rejects.toThrow('POOLS')
    })
    it('throws with max hops of 0', async () => {
      await expect(
        Trade.bestTradeExactOut([pool_0_2], token0, CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(100)), {
          maxHops: 0
        })
      ).rejects.toThrow('MAX_HOPS')
    })

    it('provides best route', async () => {
      const result = await Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        CurrencyAmount.fromRawAmount(token2, 10000)
      )
      expect(result).toHaveLength(2)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
      expect(result[0].inputAmount).toEqual(CurrencyAmount.fromRawAmount(token0, 10032))
      expect(result[0].outputAmount).toEqual(CurrencyAmount.fromRawAmount(token2, 10000))
      expect(result[1].route.pools).toHaveLength(2) // 0 -> 1 -> 2 at 12:12:10
      expect(result[1].route.tokenPath).toEqual([token0, token1, token2])
      expect(result[1].inputAmount).toEqual(CurrencyAmount.fromRawAmount(token0, 15488))
      expect(result[1].outputAmount).toEqual(CurrencyAmount.fromRawAmount(token2, 10000))
    })

    it('respects maxHops', async () => {
      const result = await Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(10)),
        { maxHops: 1 }
      )
      expect(result).toHaveLength(1)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
    })

    it.skip('insufficient liquidity', () => {
      const result = Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        CurrencyAmount.fromRawAmount(token2, 1200)
      )
      expect(result).toHaveLength(0)
    })

    it.skip('insufficient liquidity in one pool but not the other', () => {
      const result = Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(1050))
      )
      expect(result).toHaveLength(1)
    })

    it('respects n', async () => {
      const result = await Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(10)),
        { maxNumResults: 1 }
      )

      expect(result).toHaveLength(1)
    })

    it('no path', async () => {
      const result = await Trade.bestTradeExactOut(
        [pool_0_1, pool_0_3, pool_1_3],
        token0,
        CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(10))
      )
      expect(result).toHaveLength(0)
    })

    it('works for ETHER currency input', async () => {
      const result = await Trade.bestTradeExactOut(
        [pool_weth_0, pool_0_1, pool_0_3, pool_1_3],
        ETHER,
        CurrencyAmount.fromRawAmount(token3, 10000)
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(ETHER)
      expect(result[0].route.tokenPath).toEqual([WETH9[1], token0, token1, token3])
      expect(result[0].outputAmount.currency).toEqual(token3)
      expect(result[1].inputAmount.currency).toEqual(ETHER)
      expect(result[1].route.tokenPath).toEqual([WETH9[1], token0, token3])
      expect(result[1].outputAmount.currency).toEqual(token3)
    })
    it('works for ETHER currency output', async () => {
      const result = await Trade.bestTradeExactOut(
        [pool_weth_0, pool_0_1, pool_0_3, pool_1_3],
        token3,
        CurrencyAmount.fromRawAmount(Ether.onChain(1), JSBI.BigInt(100))
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(token3)
      expect(result[0].route.tokenPath).toEqual([token3, token0, WETH9[1]])
      expect(result[0].outputAmount.currency).toEqual(ETHER)
      expect(result[1].inputAmount.currency).toEqual(token3)
      expect(result[1].route.tokenPath).toEqual([token3, token1, token0, WETH9[1]])
      expect(result[1].outputAmount.currency).toEqual(ETHER)
    })
  })
})
