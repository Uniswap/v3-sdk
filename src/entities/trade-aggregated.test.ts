import { Percent, Price, sqrt, Token, CurrencyAmount, TradeType, WETH9, Ether } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { FeeAmount, TICK_SPACINGS } from '../constants'
import { encodeSqrtRatioX96 } from '../utils/encodeSqrtRatioX96'
import { nearestUsableTick } from '../utils/nearestUsableTick'
import { TickMath } from '../utils/tickMath'
import { Pool } from './pool'
import { Route } from './route'
import { Trade } from './trade'
import { AggregatedTrade } from './trade-aggregated'

describe('AggregatedTrade', () => {
  const ETHER = Ether.onChain(1)
  const token0 = new Token(1, '0x0000000000000000000000000000000000000001', 18, 't0', 'token0')
  const token1 = new Token(1, '0x0000000000000000000000000000000000000002', 18, 't1', 'token1')
  const token2 = new Token(1, '0x0000000000000000000000000000000000000003', 18, 't2', 'token2')

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
    CurrencyAmount.fromRawAmount(token2, 100000)
  )

  const pool_1_2 = v2StylePool(
    CurrencyAmount.fromRawAmount(token1, 120000),
    CurrencyAmount.fromRawAmount(token2, 100000)
  )

  const pool_weth_0 = v2StylePool(
    CurrencyAmount.fromRawAmount(WETH9[1], JSBI.BigInt(100000)),
    CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(100000))
  )

  const pool_weth_1 = v2StylePool(
    CurrencyAmount.fromRawAmount(WETH9[1], JSBI.BigInt(100000)),
    CurrencyAmount.fromRawAmount(token1, JSBI.BigInt(100000))
  )

  const pool_weth_2 = v2StylePool(
    CurrencyAmount.fromRawAmount(WETH9[1], JSBI.BigInt(100000)),
    CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(100000))
  )

  it('can be constructed with ETHER as input', async () => {
    const trade = await AggregatedTrade.fromTrades(
      [
        await Trade.fromRoute(
          new Route([pool_weth_0], ETHER, token0),
          CurrencyAmount.fromRawAmount(Ether.onChain(1), JSBI.BigInt(10000)),
          TradeType.EXACT_INPUT
        )
      ],
      TradeType.EXACT_INPUT
    )
    expect(trade.inputAmount.currency).toEqual(ETHER)
    expect(trade.outputAmount.currency).toEqual(token0)
  })
  it('can be constructed with ETHER as input for exact output', async () => {
    const trade = await AggregatedTrade.fromTrades(
      [
        await Trade.fromRoute(
          new Route([pool_weth_0], ETHER, token0),
          CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(10000)),
          TradeType.EXACT_OUTPUT
        )
      ],
      TradeType.EXACT_OUTPUT
    )
    expect(trade.inputAmount.currency).toEqual(ETHER)
    expect(trade.outputAmount.currency).toEqual(token0)
  })

  it('can be constructed with ETHER as output', async () => {
    const trade = await AggregatedTrade.fromTrades(
      [
        await Trade.fromRoute(
          new Route([pool_weth_0], token0, ETHER),
          CurrencyAmount.fromRawAmount(Ether.onChain(1), JSBI.BigInt(10000)),
          TradeType.EXACT_OUTPUT
        )
      ],
      TradeType.EXACT_OUTPUT
    )
    expect(trade.inputAmount.currency).toEqual(token0)
    expect(trade.outputAmount.currency).toEqual(ETHER)
  })
  it('can be constructed with ETHER as output for exact input', async () => {
    const trade = await AggregatedTrade.fromTrades(
      [
        await Trade.fromRoute(
          new Route([pool_weth_0], token0, ETHER),
          CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(10000)),
          TradeType.EXACT_INPUT
        )
      ],
      TradeType.EXACT_INPUT
    )
    expect(trade.inputAmount.currency).toEqual(token0)
    expect(trade.outputAmount.currency).toEqual(ETHER)
  })

  describe('#createUncheckedTrade', () => {
    it('throws if input currencies do not match', async () => {
      await expect(
        AggregatedTrade.fromTrades(
          [
            await Trade.fromRoute(
              new Route([pool_1_2], token2, token1),
              CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(10000)),
              TradeType.EXACT_INPUT
            ),
            await Trade.fromRoute(
              new Route([pool_0_1], token0, token1),
              CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(10000)),
              TradeType.EXACT_INPUT
            )
          ],
          TradeType.EXACT_INPUT
        )
      ).rejects.toThrow('INPUT_CURRENCY_MATCH')
    })

    it('throws if output currency does not match route', async () => {
      await expect(
        AggregatedTrade.fromTrades(
          [
            await Trade.fromRoute(
              new Route([pool_1_2], token1, token2),
              CurrencyAmount.fromRawAmount(token1, JSBI.BigInt(10000)),
              TradeType.EXACT_INPUT
            ),
            await Trade.fromRoute(
              new Route([pool_0_1], token1, token0),
              CurrencyAmount.fromRawAmount(token1, JSBI.BigInt(10000)),
              TradeType.EXACT_INPUT
            )
          ],
          TradeType.EXACT_INPUT
        )
      ).rejects.toThrow('OUTPUT_CURRENCY_MATCH')
    })

    it('throws if trades have different types', async () => {
      await expect(
        AggregatedTrade.fromTrades(
          [
            Trade.createUncheckedTrade({
              route: new Route([pool_1_2], token1, token2),
              inputAmount: CurrencyAmount.fromRawAmount(token1, JSBI.BigInt(10000)),
              outputAmount: CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(10000)),
              tradeType: TradeType.EXACT_INPUT
            }),
            Trade.createUncheckedTrade({
              route: new Route([pool_0_1, pool_0_2], token1, token2),
              inputAmount: CurrencyAmount.fromRawAmount(token1, JSBI.BigInt(10000)),
              outputAmount: CurrencyAmount.fromRawAmount(token2, JSBI.BigInt(10000)),
              tradeType: TradeType.EXACT_OUTPUT
            })
          ],
          TradeType.EXACT_INPUT
        )
      ).rejects.toThrow('TRADE_TYPE_MATCH')
    })

    it('throws if pools are re-used between trades', async () => {
      await expect(
        AggregatedTrade.fromTrades(
          [
            await Trade.fromRoute(
              new Route([pool_0_1, pool_weth_1], token0, ETHER),
              CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(4500)),
              TradeType.EXACT_INPUT
            ),
            await Trade.fromRoute(
              new Route([pool_0_1, pool_1_2, pool_weth_2], token0, ETHER),
              CurrencyAmount.fromRawAmount(token0, JSBI.BigInt(5500)),
              TradeType.EXACT_INPUT
            )
          ],
          TradeType.EXACT_INPUT
        )
      ).rejects.toThrow('POOLS_DUPLICATED')
    })
  })

  describe('#worstExecutionPrice', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = new AggregatedTrade({
        trades: [
          Trade.createUncheckedTrade({
            route: new Route([pool_0_1, pool_1_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 50),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 39),
            tradeType: TradeType.EXACT_INPUT
          }),
          Trade.createUncheckedTrade({
            route: new Route([pool_0_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 50),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 30),
            tradeType: TradeType.EXACT_INPUT
          })
        ],
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
      const exactOut = new AggregatedTrade({
        trades: [
          Trade.createUncheckedTrade({
            route: new Route([pool_0_1, pool_1_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 106),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 70),
            tradeType: TradeType.EXACT_OUTPUT
          }),
          Trade.createUncheckedTrade({
            route: new Route([pool_0_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 50),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 30),
            tradeType: TradeType.EXACT_OUTPUT
          })
        ],
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
      const exactIn = new AggregatedTrade({
        trades: [
          Trade.createUncheckedTrade({
            route: new Route([pool_0_1, pool_1_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 50),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 39),
            tradeType: TradeType.EXACT_INPUT
          }),
          Trade.createUncheckedTrade({
            route: new Route([pool_0_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 50),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 30),
            tradeType: TradeType.EXACT_INPUT
          })
        ],
        inputAmount: CurrencyAmount.fromRawAmount(token0, 100),
        outputAmount: CurrencyAmount.fromRawAmount(token2, 69),
        tradeType: TradeType.EXACT_INPUT
      })
      it('is cached', () => {
        expect(exactIn.priceImpact === exactIn.priceImpact).toStrictEqual(true)
      })
      it('is correct', () => {
        expect(exactIn.priceImpact.toSignificant(3)).toEqual('24.7')
      })
    })
    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = new AggregatedTrade({
        trades: [
          Trade.createUncheckedTrade({
            route: new Route([pool_0_1, pool_1_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 106),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 70),
            tradeType: TradeType.EXACT_OUTPUT
          }),
          Trade.createUncheckedTrade({
            route: new Route([pool_0_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 50),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 30),
            tradeType: TradeType.EXACT_OUTPUT
          })
        ],
        inputAmount: CurrencyAmount.fromRawAmount(token0, 156),
        outputAmount: CurrencyAmount.fromRawAmount(token2, 100),
        tradeType: TradeType.EXACT_OUTPUT
      })

      it('is cached', () => {
        expect(exactOut.priceImpact === exactOut.priceImpact).toStrictEqual(true)
      })
      it('is correct', () => {
        expect(exactOut.priceImpact.toSignificant(3)).toEqual('27.7')
      })
    })
  })

  describe('#maximumAmountIn', () => {
    describe('tradeType = EXACT_INPUT', () => {
      let exactIn: AggregatedTrade<Token, Token, TradeType.EXACT_INPUT>
      beforeEach(async () => {
        exactIn = new AggregatedTrade({
          trades: [
            Trade.createUncheckedTrade({
              route: new Route([pool_0_1, pool_1_2], token0, token2),
              inputAmount: CurrencyAmount.fromRawAmount(token0, 50),
              outputAmount: CurrencyAmount.fromRawAmount(token2, 39),
              tradeType: TradeType.EXACT_INPUT
            }),
            Trade.createUncheckedTrade({
              route: new Route([pool_0_2], token0, token2),
              inputAmount: CurrencyAmount.fromRawAmount(token0, 50),
              outputAmount: CurrencyAmount.fromRawAmount(token2, 30),
              tradeType: TradeType.EXACT_INPUT
            })
          ],
          inputAmount: CurrencyAmount.fromRawAmount(token0, 100),
          outputAmount: CurrencyAmount.fromRawAmount(token2, 69),
          tradeType: TradeType.EXACT_INPUT
        })
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
      let exactOut: AggregatedTrade<Token, Token, TradeType.EXACT_OUTPUT>
      beforeEach(async () => {
        exactOut = new AggregatedTrade({
          trades: [
            Trade.createUncheckedTrade({
              route: new Route([pool_0_1, pool_1_2], token0, token2),
              inputAmount: CurrencyAmount.fromRawAmount(token0, 10000),
              outputAmount: CurrencyAmount.fromRawAmount(token2, 70),
              tradeType: TradeType.EXACT_OUTPUT
            }),
            Trade.createUncheckedTrade({
              route: new Route([pool_0_2], token0, token2),
              inputAmount: CurrencyAmount.fromRawAmount(token0, 5488),
              outputAmount: CurrencyAmount.fromRawAmount(token2, 30),
              tradeType: TradeType.EXACT_OUTPUT
            })
          ],
          inputAmount: CurrencyAmount.fromRawAmount(token0, 15488),
          outputAmount: CurrencyAmount.fromRawAmount(token2, 100),
          tradeType: TradeType.EXACT_OUTPUT
        })
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
      let exactIn: AggregatedTrade<Token, Token, TradeType.EXACT_INPUT>
      beforeEach(
        async () =>
          (exactIn = new AggregatedTrade({
            trades: [
              Trade.createUncheckedTrade({
                route: new Route([pool_0_1, pool_1_2], token0, token2),
                inputAmount: CurrencyAmount.fromRawAmount(token0, 5000),
                outputAmount: CurrencyAmount.fromRawAmount(token2, 3504),
                tradeType: TradeType.EXACT_INPUT
              }),
              Trade.createUncheckedTrade({
                route: new Route([pool_0_2], token0, token2),
                inputAmount: CurrencyAmount.fromRawAmount(token0, 5000),
                outputAmount: CurrencyAmount.fromRawAmount(token2, 3500),
                tradeType: TradeType.EXACT_INPUT
              })
            ],
            inputAmount: CurrencyAmount.fromRawAmount(token0, 10000),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 7004),
            tradeType: TradeType.EXACT_INPUT
          }))
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
      let exactOut: AggregatedTrade<Token, Token, TradeType.EXACT_OUTPUT>
      beforeEach(async () => {
        exactOut = new AggregatedTrade({
          trades: [
            Trade.createUncheckedTrade({
              route: new Route([pool_0_1, pool_1_2], token0, token2),
              inputAmount: CurrencyAmount.fromRawAmount(token0, 40),
              outputAmount: CurrencyAmount.fromRawAmount(token2, 70),
              tradeType: TradeType.EXACT_OUTPUT
            }),
            Trade.createUncheckedTrade({
              route: new Route([pool_0_2], token0, token2),
              inputAmount: CurrencyAmount.fromRawAmount(token0, 60),
              outputAmount: CurrencyAmount.fromRawAmount(token2, 30),
              tradeType: TradeType.EXACT_OUTPUT
            })
          ],
          inputAmount: CurrencyAmount.fromRawAmount(token0, 100),
          outputAmount: CurrencyAmount.fromRawAmount(token2, 100),
          tradeType: TradeType.EXACT_OUTPUT
        })
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
})
