import { ChainId, ETHER, Token, TokenAmount, WETH9 } from '@uniswap/sdk-core'
import { FeeAmount } from '../constants'
import { Pool } from './pool'
import { Route } from './route'
import { Tick } from './tick'
import { TickList } from './tickList'

describe.skip('Route', () => {
  const token0 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000001', 18, 't0')
  const token1 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000002', 18, 't1')
  const weth = WETH9[ChainId.MAINNET]
  const sqrtPriceX96Default = 20
  const inRangeLiquidityDefault = 0
  const tickMapDefault = new TickList({
    ticks: [
      new Tick({ feeGrowthOutside0X128: 2, feeGrowthOutside1X128: 3, index: -2, liquidityNet: 0, liquidityGross: 0 }),
      new Tick({ feeGrowthOutside0X128: 4, feeGrowthOutside1X128: 1, index: 2, liquidityNet: 0, liquidityGross: 0 })
    ]
  })
  const pool_0_1 = new Pool(
    new TokenAmount(token0, '100'),
    new TokenAmount(token1, '200'),
    FeeAmount.MEDIUM,
    sqrtPriceX96Default,
    inRangeLiquidityDefault,
    tickMapDefault
  )
  const pool_0_weth = new Pool(
    new TokenAmount(token0, '100'),
    new TokenAmount(weth, '100'),
    FeeAmount.MEDIUM,
    sqrtPriceX96Default,
    inRangeLiquidityDefault,
    tickMapDefault
  )
  const pool_1_weth = new Pool(
    new TokenAmount(token1, '175'),
    new TokenAmount(weth, '100'),
    FeeAmount.MEDIUM,
    sqrtPriceX96Default,
    inRangeLiquidityDefault,
    tickMapDefault
  )

  describe('path', () => {
    it('constructs a path from the tokens', () => {
      const route = new Route([pool_0_1], token0)
      expect(route.pools).toEqual([pool_0_1])
      expect(route.tokenPath).toEqual([token0, token1])
      expect(route.input).toEqual(token0)
      expect(route.output).toEqual(token1)
      expect(route.chainId).toEqual(ChainId.MAINNET)
    })
    it('should fail if the input is not in the first pool', () => {
      expect(() => new Route([pool_0_1], weth)).toThrow()
    })
    it('should fail if output is not in the last pool', () => {
      expect(() => new Route([pool_0_1], token0, weth)).toThrow()
    })
  })

  it('can have a token as both input and output', () => {
    const route = new Route([pool_0_weth, pool_0_1, pool_1_weth], weth)
    expect(route.pools).toEqual([pool_0_weth, pool_0_1, pool_1_weth])
    expect(route.input).toEqual(weth)
    expect(route.output).toEqual(weth)
  })

  it('supports ether input', () => {
    const route = new Route([pool_0_weth], ETHER)
    expect(route.pools).toEqual([pool_0_weth])
    expect(route.input).toEqual(ETHER)
    expect(route.output).toEqual(token0)
  })

  it('supports ether output', () => {
    const route = new Route([pool_0_weth], token0, ETHER)
    expect(route.pools).toEqual([pool_0_weth])
    expect(route.input).toEqual(token0)
    expect(route.output).toEqual(ETHER)
  })
})
