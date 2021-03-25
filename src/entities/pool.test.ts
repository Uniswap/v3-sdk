import { ChainId, Price, Token, TokenAmount, WETH9 } from '@uniswap/sdk-core'
import { FeeAmount } from '../constants'
import { Pool } from './pool'
import { Tick } from './tick'
import { TickList } from './tickList'
import { encodeSqrtRatioX96 } from '../utils/encodeSqrtRatioX96'
import JSBI from 'jsbi'

describe('Pool', () => {
  let DAI: Token
  let USDC: Token
  let tickMapDefault: TickList
  let pool: Pool
  const sqrtPriceX96Default = 20
  const inRangeLiquidityDefault = 0
  beforeEach(() => {
    USDC = new Token(ChainId.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 18, 'USDC', 'USD Coin')
    DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
    tickMapDefault = new TickList({
      ticks: [
        new Tick({ feeGrowthOutside0X128: 2, feeGrowthOutside1X128: 3, index: -2, liquidityNet: 0, liquidityGross: 0 }),
        new Tick({ feeGrowthOutside0X128: 4, feeGrowthOutside1X128: 1, index: 2, liquidityNet: 0, liquidityGross: 0 })
      ]
    })
  })
  describe('constructor', () => {
    it('cannot be used for tokens on different chains', () => {
      expect(() => {
        new Pool(
          USDC,
          WETH9[ChainId.RINKEBY],
          FeeAmount.MEDIUM,
          sqrtPriceX96Default,
          inRangeLiquidityDefault,
          tickMapDefault
        )
      }).toThrow('CHAIN_IDS')
    })

    it('should have at least one initialized tick', () => {
      expect(() => {
        new Pool(
          USDC,
          WETH9[ChainId.MAINNET],
          FeeAmount.MEDIUM,
          sqrtPriceX96Default,
          inRangeLiquidityDefault,
          new TickList({ ticks: [] })
        )
      }).toThrow()
    })
  })

  describe.skip('#getAddress', () => {
    it('matches an example', () => {
      const result = Pool.getAddress(USDC, DAI, FeeAmount.LOW)
      expect(result).toEqual('0x84e755dD2f34969933a9F9334C40b15146d52510')
    })
  })

  describe('#token0', () => {
    it('always is the token that sorts before', () => {
      pool = new Pool(USDC, DAI, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
      expect(pool.token0).toEqual(DAI)
      pool = new Pool(DAI, USDC, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
      expect(pool.token0).toEqual(DAI)
    })
  })
  describe('#token1', () => {
    it('always is the token that sorts after', () => {
      pool = new Pool(USDC, DAI, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
      expect(pool.token1).toEqual(USDC)
      pool = new Pool(DAI, USDC, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
      expect(pool.token1).toEqual(USDC)
    })
  })

  describe.skip('#token0Price', () => {
    it('returns price of token0 in terms of token1', () => {
      expect(
        new Pool(USDC, DAI, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault).token0Price
      ).toEqual(new Price(DAI, USDC, '100', '101'))
      expect(
        new Pool(DAI, USDC, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault).token0Price
      ).toEqual(new Price(DAI, USDC, '100', '101'))
    })
  })

  describe.skip('#token1Price', () => {
    it('returns price of token1 in terms of token0', () => {
      expect(
        new Pool(USDC, DAI, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault).token1Price
      ).toEqual(new Price(USDC, DAI, '101', '100'))
      expect(
        new Pool(DAI, USDC, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault).token1Price
      ).toEqual(new Price(USDC, DAI, '101', '100'))
    })
  })

  describe.skip('#priceOf', () => {
    const pool = new Pool(USDC, DAI, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
    it('returns price of token in terms of other token', () => {
      expect(pool.priceOf(DAI)).toEqual(pool.token0Price)
      expect(pool.priceOf(USDC)).toEqual(pool.token1Price)
    })

    it('throws if invalid token', () => {
      expect(() => pool.priceOf(WETH9[ChainId.MAINNET])).toThrow('TOKEN')
    })
  })

  describe('#chainId', () => {
    it('returns the token0 chainId', () => {
      pool = new Pool(USDC, DAI, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
      expect(pool.chainId).toEqual(ChainId.MAINNET)
      pool = new Pool(DAI, USDC, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
      expect(pool.chainId).toEqual(ChainId.MAINNET)
    })
  })
  describe.skip('#involvesToken', () => {
    pool = new Pool(USDC, DAI, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
    expect(pool.involvesToken(USDC)).toEqual(true)
    expect(pool.involvesToken(DAI)).toEqual(true)
    expect(pool.involvesToken(WETH9[ChainId.MAINNET])).toEqual(false)
  })

  describe('#getLiquidityForAmounts', () => {
    it('amounts for price inside', () => {
      pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), inRangeLiquidityDefault, tickMapDefault)
      const sqrtPriceAX96 = encodeSqrtRatioX96(100, 110)
      const sqrtPriceBX96 = encodeSqrtRatioX96(110, 100)
      const liquidity = pool.getLiquidityForAmounts(
        sqrtPriceAX96,
        sqrtPriceBX96,
        new TokenAmount(USDC, '100'),
        new TokenAmount(DAI, '200')
      )
      expect(liquidity).toEqual(JSBI.BigInt(2148))
    })

    it('amounts for price below', () => {
      pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(99, 110), inRangeLiquidityDefault, tickMapDefault)
      const sqrtPriceAX96 = encodeSqrtRatioX96(100, 110)
      const sqrtPriceBX96 = encodeSqrtRatioX96(110, 100)
      const liquidity = pool.getLiquidityForAmounts(
        sqrtPriceAX96,
        sqrtPriceBX96,
        new TokenAmount(USDC, '100'),
        new TokenAmount(DAI, '200')
      )
      expect(liquidity).toEqual(JSBI.BigInt(1048))
    })

    it('amounts for price above', () => {
      pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(111, 100), inRangeLiquidityDefault, tickMapDefault)
      const sqrtPriceAX96 = encodeSqrtRatioX96(100, 110)
      const sqrtPriceBX96 = encodeSqrtRatioX96(110, 100)
      const liquidity = pool.getLiquidityForAmounts(
        sqrtPriceAX96,
        sqrtPriceBX96,
        new TokenAmount(USDC, '100'),
        new TokenAmount(DAI, '200')
      )
      expect(liquidity).toEqual(JSBI.BigInt(2097))
    })
  })
})
