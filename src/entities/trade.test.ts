import { Percent } from './fractions/percent'
import { Trade } from './trade'
import { ChainId, TradeType } from '../constants'
import { ETHER } from './currency'
import { TokenAmount } from './fractions/tokenAmount'
import { CurrencyAmount } from './fractions/currencyAmount'
import { Pool } from './pool'
import { Route } from './route'
import { Token, WETH } from './token'

describe('Trade', () => {
  const token0 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000001', 18, 't0')
  const token1 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000002', 18, 't1')
  const token2 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000003', 18, 't2')
  const token3 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000004', 18, 't3')

  const pool_0_1 = new Pool(new TokenAmount(token0, BigInt(1000)), new TokenAmount(token1, BigInt(1000)))
  const pool_0_2 = new Pool(new TokenAmount(token0, BigInt(1000)), new TokenAmount(token2, BigInt(1100)))
  const pool_0_3 = new Pool(new TokenAmount(token0, BigInt(1000)), new TokenAmount(token3, BigInt(900)))
  const pool_1_2 = new Pool(new TokenAmount(token1, BigInt(1200)), new TokenAmount(token2, BigInt(1000)))
  const pool_1_3 = new Pool(new TokenAmount(token1, BigInt(1200)), new TokenAmount(token3, BigInt(1300)))

  const pool_weth_0 = new Pool(
    new TokenAmount(WETH[ChainId.MAINNET], BigInt(1000)),
    new TokenAmount(token0, BigInt(1000))
  )

  const empty_pool_0_1 = new Pool(new TokenAmount(token0, BigInt(0)), new TokenAmount(token1, BigInt(0)))

  it('can be constructed with ETHER as input', () => {
    const trade = new Trade(new Route([pool_weth_0], ETHER), CurrencyAmount.ether(BigInt(100)), TradeType.EXACT_INPUT)
    expect(trade.inputAmount.currency).toEqual(ETHER)
    expect(trade.outputAmount.currency).toEqual(token0)
  })
  it('can be constructed with ETHER as input for exact output', () => {
    const trade = new Trade(
      new Route([pool_weth_0], ETHER, token0),
      new TokenAmount(token0, BigInt(100)),
      TradeType.EXACT_OUTPUT
    )
    expect(trade.inputAmount.currency).toEqual(ETHER)
    expect(trade.outputAmount.currency).toEqual(token0)
  })

  it('can be constructed with ETHER as output', () => {
    const trade = new Trade(
      new Route([pool_weth_0], token0, ETHER),
      CurrencyAmount.ether(BigInt(100)),
      TradeType.EXACT_OUTPUT
    )
    expect(trade.inputAmount.currency).toEqual(token0)
    expect(trade.outputAmount.currency).toEqual(ETHER)
  })
  it('can be constructed with ETHER as output for exact input', () => {
    const trade = new Trade(
      new Route([pool_weth_0], token0, ETHER),
      new TokenAmount(token0, BigInt(100)),
      TradeType.EXACT_INPUT
    )
    expect(trade.inputAmount.currency).toEqual(token0)
    expect(trade.outputAmount.currency).toEqual(ETHER)
  })

  describe('#bestTradeExactIn', () => {
    it('throws with empty pools', () => {
      expect(() => Trade.bestTradeExactIn([], new TokenAmount(token0, BigInt(100)), token2)).toThrow('POOLS')
    })
    it('throws with max hops of 0', () => {
      expect(() =>
        Trade.bestTradeExactIn([pool_0_2], new TokenAmount(token0, BigInt(100)), token2, { maxHops: 0 })
      ).toThrow('MAX_HOPS')
    })

    it('provides best route', () => {
      const result = Trade.bestTradeExactIn(
        [pool_0_1, pool_0_2, pool_1_2],
        new TokenAmount(token0, BigInt(100)),
        token2
      )
      expect(result).toHaveLength(2)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
      expect(result[0].inputAmount).toEqual(new TokenAmount(token0, BigInt(100)))
      expect(result[0].outputAmount).toEqual(new TokenAmount(token2, BigInt(99)))
      expect(result[1].route.pools).toHaveLength(2) // 0 -> 1 -> 2 at 12:12:10
      expect(result[1].route.tokenPath).toEqual([token0, token1, token2])
      expect(result[1].inputAmount).toEqual(new TokenAmount(token0, BigInt(100)))
      expect(result[1].outputAmount).toEqual(new TokenAmount(token2, BigInt(69)))
    })

    it('doesnt throw for zero liquidity pools', () => {
      expect(Trade.bestTradeExactIn([empty_pool_0_1], new TokenAmount(token0, BigInt(100)), token1)).toHaveLength(0)
    })

    it('respects maxHops', () => {
      const result = Trade.bestTradeExactIn(
        [pool_0_1, pool_0_2, pool_1_2],
        new TokenAmount(token0, BigInt(10)),
        token2,
        { maxHops: 1 }
      )
      expect(result).toHaveLength(1)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
    })

    it('insufficient input for one pool', () => {
      const result = Trade.bestTradeExactIn([pool_0_1, pool_0_2, pool_1_2], new TokenAmount(token0, BigInt(1)), token2)
      expect(result).toHaveLength(1)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
      expect(result[0].outputAmount).toEqual(new TokenAmount(token2, BigInt(1)))
    })

    it('respects n', () => {
      const result = Trade.bestTradeExactIn(
        [pool_0_1, pool_0_2, pool_1_2],
        new TokenAmount(token0, BigInt(10)),
        token2,
        { maxNumResults: 1 }
      )

      expect(result).toHaveLength(1)
    })

    it('no path', () => {
      const result = Trade.bestTradeExactIn([pool_0_1, pool_0_3, pool_1_3], new TokenAmount(token0, BigInt(10)), token2)
      expect(result).toHaveLength(0)
    })

    it('works for ETHER currency input', () => {
      const result = Trade.bestTradeExactIn(
        [pool_weth_0, pool_0_1, pool_0_3, pool_1_3],
        CurrencyAmount.ether(BigInt(100)),
        token3
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(ETHER)
      expect(result[0].route.tokenPath).toEqual([WETH[ChainId.MAINNET], token0, token1, token3])
      expect(result[0].outputAmount.currency).toEqual(token3)
      expect(result[1].inputAmount.currency).toEqual(ETHER)
      expect(result[1].route.tokenPath).toEqual([WETH[ChainId.MAINNET], token0, token3])
      expect(result[1].outputAmount.currency).toEqual(token3)
    })
    it('works for ETHER currency output', () => {
      const result = Trade.bestTradeExactIn(
        [pool_weth_0, pool_0_1, pool_0_3, pool_1_3],
        new TokenAmount(token3, BigInt(100)),
        ETHER
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(token3)
      expect(result[0].route.tokenPath).toEqual([token3, token0, WETH[ChainId.MAINNET]])
      expect(result[0].outputAmount.currency).toEqual(ETHER)
      expect(result[1].inputAmount.currency).toEqual(token3)
      expect(result[1].route.tokenPath).toEqual([token3, token1, token0, WETH[ChainId.MAINNET]])
      expect(result[1].outputAmount.currency).toEqual(ETHER)
    })
  })

  describe('#maximumAmountIn', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = new Trade(
        new Route([pool_0_1, pool_1_2], token0),
        new TokenAmount(token0, BigInt(100)),
        TradeType.EXACT_INPUT
      )
      it('throws if less than 0', () => {
        expect(() => exactIn.maximumAmountIn(new Percent(BigInt(-1), BigInt(100)))).toThrow('SLIPPAGE_TOLERANCE')
      })
      it('returns exact if 0', () => {
        expect(exactIn.maximumAmountIn(new Percent(BigInt(0), BigInt(100)))).toEqual(exactIn.inputAmount)
      })
      it('returns exact if nonzero', () => {
        expect(exactIn.maximumAmountIn(new Percent(BigInt(0), BigInt(100)))).toEqual(
          new TokenAmount(token0, BigInt(100))
        )
        expect(exactIn.maximumAmountIn(new Percent(BigInt(5), BigInt(100)))).toEqual(
          new TokenAmount(token0, BigInt(100))
        )
        expect(exactIn.maximumAmountIn(new Percent(BigInt(200), BigInt(100)))).toEqual(
          new TokenAmount(token0, BigInt(100))
        )
      })
    })
    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = new Trade(
        new Route([pool_0_1, pool_1_2], token0),
        new TokenAmount(token2, BigInt(100)),
        TradeType.EXACT_OUTPUT
      )

      it('throws if less than 0', () => {
        expect(() => exactOut.maximumAmountIn(new Percent(BigInt(-1), BigInt(100)))).toThrow('SLIPPAGE_TOLERANCE')
      })
      it('returns exact if 0', () => {
        expect(exactOut.maximumAmountIn(new Percent(BigInt(0), BigInt(100)))).toEqual(exactOut.inputAmount)
      })
      it('returns slippage amount if nonzero', () => {
        expect(exactOut.maximumAmountIn(new Percent(BigInt(0), BigInt(100)))).toEqual(
          new TokenAmount(token0, BigInt(156))
        )
        expect(exactOut.maximumAmountIn(new Percent(BigInt(5), BigInt(100)))).toEqual(
          new TokenAmount(token0, BigInt(163))
        )
        expect(exactOut.maximumAmountIn(new Percent(BigInt(200), BigInt(100)))).toEqual(
          new TokenAmount(token0, BigInt(468))
        )
      })
    })
  })

  describe('#minimumAmountOut', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = new Trade(
        new Route([pool_0_1, pool_1_2], token0),
        new TokenAmount(token0, BigInt(100)),
        TradeType.EXACT_INPUT
      )
      it('throws if less than 0', () => {
        expect(() => exactIn.minimumAmountOut(new Percent(BigInt(-1), BigInt(100)))).toThrow('SLIPPAGE_TOLERANCE')
      })
      it('returns exact if 0', () => {
        expect(exactIn.minimumAmountOut(new Percent(BigInt(0), BigInt(100)))).toEqual(exactIn.outputAmount)
      })
      it('returns exact if nonzero', () => {
        expect(exactIn.minimumAmountOut(new Percent(BigInt(0), BigInt(100)))).toEqual(
          new TokenAmount(token2, BigInt(69))
        )
        expect(exactIn.minimumAmountOut(new Percent(BigInt(5), BigInt(100)))).toEqual(
          new TokenAmount(token2, BigInt(65))
        )
        expect(exactIn.minimumAmountOut(new Percent(BigInt(200), BigInt(100)))).toEqual(
          new TokenAmount(token2, BigInt(23))
        )
      })
    })
    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = new Trade(
        new Route([pool_0_1, pool_1_2], token0),
        new TokenAmount(token2, BigInt(100)),
        TradeType.EXACT_OUTPUT
      )

      it('throws if less than 0', () => {
        expect(() => exactOut.minimumAmountOut(new Percent(BigInt(-1), BigInt(100)))).toThrow('SLIPPAGE_TOLERANCE')
      })
      it('returns exact if 0', () => {
        expect(exactOut.minimumAmountOut(new Percent(BigInt(0), BigInt(100)))).toEqual(exactOut.outputAmount)
      })
      it('returns slippage amount if nonzero', () => {
        expect(exactOut.minimumAmountOut(new Percent(BigInt(0), BigInt(100)))).toEqual(
          new TokenAmount(token2, BigInt(100))
        )
        expect(exactOut.minimumAmountOut(new Percent(BigInt(5), BigInt(100)))).toEqual(
          new TokenAmount(token2, BigInt(100))
        )
        expect(exactOut.minimumAmountOut(new Percent(BigInt(200), BigInt(100)))).toEqual(
          new TokenAmount(token2, BigInt(100))
        )
      })
    })
  })

  describe('#bestTradeExactOut', () => {
    it('throws with empty pools', () => {
      expect(() => Trade.bestTradeExactOut([], token0, new TokenAmount(token2, BigInt(100)))).toThrow('POOLS')
    })
    it('throws with max hops of 0', () => {
      expect(() =>
        Trade.bestTradeExactOut([pool_0_2], token0, new TokenAmount(token2, BigInt(100)), { maxHops: 0 })
      ).toThrow('MAX_HOPS')
    })

    it('provides best route', () => {
      const result = Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        new TokenAmount(token2, BigInt(100))
      )
      expect(result).toHaveLength(2)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
      expect(result[0].inputAmount).toEqual(new TokenAmount(token0, BigInt(101)))
      expect(result[0].outputAmount).toEqual(new TokenAmount(token2, BigInt(100)))
      expect(result[1].route.pools).toHaveLength(2) // 0 -> 1 -> 2 at 12:12:10
      expect(result[1].route.tokenPath).toEqual([token0, token1, token2])
      expect(result[1].inputAmount).toEqual(new TokenAmount(token0, BigInt(156)))
      expect(result[1].outputAmount).toEqual(new TokenAmount(token2, BigInt(100)))
    })

    it('doesnt throw for zero liquidity pools', () => {
      expect(Trade.bestTradeExactOut([empty_pool_0_1], token1, new TokenAmount(token1, BigInt(100)))).toHaveLength(0)
    })

    it('respects maxHops', () => {
      const result = Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        new TokenAmount(token2, BigInt(10)),
        { maxHops: 1 }
      )
      expect(result).toHaveLength(1)
      expect(result[0].route.pools).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.tokenPath).toEqual([token0, token2])
    })

    it('insufficient liquidity', () => {
      const result = Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        new TokenAmount(token2, BigInt(1200))
      )
      expect(result).toHaveLength(0)
    })

    it('insufficient liquidity in one pool but not the other', () => {
      const result = Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        new TokenAmount(token2, BigInt(1050))
      )
      expect(result).toHaveLength(1)
    })

    it('respects n', () => {
      const result = Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        new TokenAmount(token2, BigInt(10)),
        { maxNumResults: 1 }
      )

      expect(result).toHaveLength(1)
    })

    it('no path', () => {
      const result = Trade.bestTradeExactOut(
        [pool_0_1, pool_0_3, pool_1_3],
        token0,
        new TokenAmount(token2, BigInt(10))
      )
      expect(result).toHaveLength(0)
    })

    it('works for ETHER currency input', () => {
      const result = Trade.bestTradeExactOut(
        [pool_weth_0, pool_0_1, pool_0_3, pool_1_3],
        ETHER,
        new TokenAmount(token3, BigInt(100))
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(ETHER)
      expect(result[0].route.tokenPath).toEqual([WETH[ChainId.MAINNET], token0, token1, token3])
      expect(result[0].outputAmount.currency).toEqual(token3)
      expect(result[1].inputAmount.currency).toEqual(ETHER)
      expect(result[1].route.tokenPath).toEqual([WETH[ChainId.MAINNET], token0, token3])
      expect(result[1].outputAmount.currency).toEqual(token3)
    })
    it('works for ETHER currency output', () => {
      const result = Trade.bestTradeExactOut(
        [pool_weth_0, pool_0_1, pool_0_3, pool_1_3],
        token3,
        CurrencyAmount.ether(BigInt(100))
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(token3)
      expect(result[0].route.tokenPath).toEqual([token3, token0, WETH[ChainId.MAINNET]])
      expect(result[0].outputAmount.currency).toEqual(ETHER)
      expect(result[1].inputAmount.currency).toEqual(token3)
      expect(result[1].route.tokenPath).toEqual([token3, token1, token0, WETH[ChainId.MAINNET]])
      expect(result[1].outputAmount.currency).toEqual(ETHER)
    })
  })
})
