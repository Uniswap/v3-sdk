import { ChainId, Price, Token, TokenAmount, WETH9 } from '@uniswap/sdk-core'
import { FeeAmount } from '../constants'
import { computePoolAddress, Pool } from './pool'
import { Tick } from './tick'
import { TickList } from './tickList'

describe('computePoolAddress', () => {
  const factoryAddress = '0x1111111111111111111111111111111111111111'
  it('should correctly compute the pool address', () => {
    const tokenA = new Token(ChainId.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 18, 'USDC', 'USD Coin')
    const tokenB = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
    const result = computePoolAddress({
      factoryAddress,
      fee: FeeAmount.LOW,
      tokenA,
      tokenB
    })

    expect(result).toEqual('0xB52088c346dD1107C8ec3360a7E64a988b15D325')
  })

  it('should correctly compute the pool address', () => {
    const USDC = new Token(ChainId.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 18, 'USDC', 'USD Coin')
    const DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
    let tokenA = USDC
    let tokenB = DAI
    const resultA = computePoolAddress({
      factoryAddress,
      fee: FeeAmount.LOW,
      tokenA,
      tokenB
    })

    tokenA = DAI

    tokenB = USDC
    const resultB = computePoolAddress({
      factoryAddress,
      fee: FeeAmount.LOW,
      tokenA,
      tokenB
    })

    expect(resultA).toEqual(resultB)
  })
})

describe.skip('Pool', () => {
  let DAI: Token
  let DAI100: TokenAmount
  let USDC: Token
  let USDC100: TokenAmount
  let tickMapDefault: TickList
  let pool: Pool
  const sqrtPriceX96Default = 20
  const inRangeLiquidityDefault = 0
  beforeEach(() => {
    USDC = new Token(ChainId.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 18, 'USDC', 'USD Coin')
    DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
    DAI100 = new TokenAmount(DAI, '100')
    USDC100 = new TokenAmount(USDC, '100')
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
          USDC100,
          new TokenAmount(WETH9[ChainId.RINKEBY], '100'),
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
          USDC100,
          new TokenAmount(WETH9[ChainId.RINKEBY], '100'),
          FeeAmount.MEDIUM,
          sqrtPriceX96Default,
          inRangeLiquidityDefault,
          new TickList({ ticks: [] })
        )
      }).toThrow()
    })
  })

  describe('#getAddress', () => {
    it('matches an example', () => {
      const result = Pool.getAddress(USDC, DAI, FeeAmount.LOW)
      expect(result).toEqual('0x84e755dD2f34969933a9F9334C40b15146d52510')
    })
  })

  describe('#token0', () => {
    it('always is the token that sorts before', () => {
      pool = new Pool(USDC100, DAI100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
      expect(pool.token0).toEqual(DAI)
      pool = new Pool(DAI100, USDC100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
      expect(pool.token0).toEqual(DAI)
    })
  })
  describe('#token1', () => {
    it('always is the token that sorts after', () => {
      pool = new Pool(USDC100, DAI100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
      expect(pool.token1).toEqual(USDC)
      pool = new Pool(DAI100, USDC100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
      expect(pool.token1).toEqual(USDC)
    })
  })
  describe('#reserve0', () => {
    it('always comes from the token that sorts before', () => {
      pool = new Pool(
        USDC100,
        new TokenAmount(DAI, '101'),
        FeeAmount.LOW,
        sqrtPriceX96Default,
        inRangeLiquidityDefault,
        tickMapDefault
      )
      expect(pool.reserve0).toEqual(new TokenAmount(DAI, '101'))
      pool = new Pool(
        new TokenAmount(DAI, '101'),
        USDC100,
        FeeAmount.LOW,
        sqrtPriceX96Default,
        inRangeLiquidityDefault,
        tickMapDefault
      )
      expect(pool.reserve0).toEqual(new TokenAmount(DAI, '101'))
    })
  })
  describe('#reserve1', () => {
    it('always comes from the token that sorts after', () => {
      expect(
        new Pool(
          USDC100,
          new TokenAmount(DAI, '101'),
          FeeAmount.LOW,
          sqrtPriceX96Default,
          inRangeLiquidityDefault,
          tickMapDefault
        ).reserve1
      ).toEqual(USDC100)
      expect(
        new Pool(
          new TokenAmount(DAI, '101'),
          USDC100,
          FeeAmount.LOW,
          sqrtPriceX96Default,
          inRangeLiquidityDefault,
          tickMapDefault
        ).reserve1
      ).toEqual(USDC100)
    })
  })

  describe('#token0Price', () => {
    it('returns price of token0 in terms of token1', () => {
      expect(
        new Pool(
          new TokenAmount(USDC, '101'),
          DAI100,
          FeeAmount.LOW,
          sqrtPriceX96Default,
          inRangeLiquidityDefault,
          tickMapDefault
        ).token0Price
      ).toEqual(new Price(DAI, USDC, '100', '101'))
      expect(
        new Pool(
          DAI100,
          new TokenAmount(USDC, '101'),
          FeeAmount.LOW,
          sqrtPriceX96Default,
          inRangeLiquidityDefault,
          tickMapDefault
        ).token0Price
      ).toEqual(new Price(DAI, USDC, '100', '101'))
    })
  })

  describe('#token1Price', () => {
    it('returns price of token1 in terms of token0', () => {
      expect(
        new Pool(
          new TokenAmount(USDC, '101'),
          DAI100,
          FeeAmount.LOW,
          sqrtPriceX96Default,
          inRangeLiquidityDefault,
          tickMapDefault
        ).token1Price
      ).toEqual(new Price(USDC, DAI, '101', '100'))
      expect(
        new Pool(
          DAI100,
          new TokenAmount(USDC, '101'),
          FeeAmount.LOW,
          sqrtPriceX96Default,
          inRangeLiquidityDefault,
          tickMapDefault
        ).token1Price
      ).toEqual(new Price(USDC, DAI, '101', '100'))
    })
  })

  describe('#priceOf', () => {
    const pool = new Pool(
      new TokenAmount(USDC, '101'),
      DAI100,
      FeeAmount.LOW,
      sqrtPriceX96Default,
      inRangeLiquidityDefault,
      tickMapDefault
    )
    it('returns price of token in terms of other token', () => {
      expect(pool.priceOf(DAI)).toEqual(pool.token0Price)
      expect(pool.priceOf(USDC)).toEqual(pool.token1Price)
    })

    it('throws if invalid token', () => {
      expect(() => pool.priceOf(WETH9[ChainId.MAINNET])).toThrow('TOKEN')
    })
  })

  describe('#reserveOf', () => {
    it('returns reserves of the given token', () => {
      expect(
        new Pool(
          USDC100,
          new TokenAmount(DAI, '101'),
          FeeAmount.LOW,
          sqrtPriceX96Default,
          inRangeLiquidityDefault,
          tickMapDefault
        ).reserveOf(USDC)
      ).toEqual(USDC100)
      expect(
        new Pool(
          new TokenAmount(DAI, '101'),
          USDC100,
          FeeAmount.LOW,
          sqrtPriceX96Default,
          inRangeLiquidityDefault,
          tickMapDefault
        ).reserveOf(USDC)
      ).toEqual(USDC100)
    })

    it('throws if not in the pool', () => {
      expect(() =>
        new Pool(
          new TokenAmount(DAI, '101'),
          USDC100,
          FeeAmount.LOW,
          sqrtPriceX96Default,
          inRangeLiquidityDefault,
          tickMapDefault
        ).reserveOf(WETH9[ChainId.MAINNET])
      ).toThrow('TOKEN')
    })
  })

  describe('#chainId', () => {
    it('returns the token0 chainId', () => {
      pool = new Pool(USDC100, DAI100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
      expect(pool.chainId).toEqual(ChainId.MAINNET)
      pool = new Pool(DAI100, USDC100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
      expect(pool.chainId).toEqual(ChainId.MAINNET)
    })
  })
  describe('#involvesToken', () => {
    pool = new Pool(USDC100, DAI100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
    expect(pool.involvesToken(USDC)).toEqual(true)
    expect(pool.involvesToken(DAI)).toEqual(true)
    pool = new Pool(USDC100, DAI100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
    expect(pool.involvesToken(WETH9[ChainId.MAINNET])).toEqual(false)
  })
})
