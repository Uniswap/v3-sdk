import { ChainId, Token, WETH9 } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { FeeAmount, getMaxTick, getMinTick, TICK_SPACINGS } from '../constants'
import { computePoolAddress, Pool } from './pool'

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

describe('Pool', () => {
  let DAI: Token
  let USDC: Token
  const tickDefault = 0
  const sqrtPriceX96Default = '79228162514264337593543950336' // 2**96
  const liquidityDefault = JSBI.BigInt(123)
  beforeEach(() => {
    USDC = new Token(ChainId.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 18, 'USDC', 'USD Coin')
    DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
  })
  describe('constructor', () => {
    it('cannot be used for tokens on different chains', () => {
      expect(() => {
        new Pool(
          USDC,
          WETH9[ChainId.RINKEBY],
          FeeAmount.MEDIUM,
          TICK_SPACINGS[FeeAmount.MEDIUM],
          sqrtPriceX96Default,
          tickDefault,
          liquidityDefault
        )
      }).toThrow('CHAIN_IDS')
    })
  })

  describe('#liquidityAtTick', () => {
    it('populatedTicks should be simulated if not provided', () => {
      const pool = new Pool(
        DAI,
        USDC,
        FeeAmount.MEDIUM,
        TICK_SPACINGS[FeeAmount.MEDIUM],
        sqrtPriceX96Default,
        tickDefault,
        liquidityDefault
      )
      expect(pool.liquidityAtTick(0)).toEqual(liquidityDefault)

      expect(pool.liquidityAtTick(-1)).toEqual(liquidityDefault)
      expect(pool.liquidityAtTick(1)).toEqual(liquidityDefault)

      expect(pool.liquidityAtTick(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))).toEqual(liquidityDefault)
      expect(pool.liquidityAtTick(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))).toEqual(liquidityDefault)
    })
  })

  // describe('#getAddress', () => {
  //   it('matches an example', () => {
  //     const result = Pool.getAddress(USDC, DAI, FeeAmount.LOW)
  //     expect(result).toEqual('0x84e755dD2f34969933a9F9334C40b15146d52510')
  //   })
  // })

  // describe('#token0', () => {
  //   it('always is the token that sorts before', () => {
  //     pool = new Pool(USDC100, DAI100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
  //     expect(pool.token0).toEqual(DAI)
  //     pool = new Pool(DAI100, USDC100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
  //     expect(pool.token0).toEqual(DAI)
  //   })
  // })
  // describe('#token1', () => {
  //   it('always is the token that sorts after', () => {
  //     pool = new Pool(USDC100, DAI100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
  //     expect(pool.token1).toEqual(USDC)
  //     pool = new Pool(DAI100, USDC100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
  //     expect(pool.token1).toEqual(USDC)
  //   })
  // })
  // describe('#reserve0', () => {
  //   it('always comes from the token that sorts before', () => {
  //     pool = new Pool(
  //       USDC100,
  //       new TokenAmount(DAI, '101'),
  //       FeeAmount.LOW,
  //       sqrtPriceX96Default,
  //       inRangeLiquidityDefault,
  //       tickMapDefault
  //     )
  //     expect(pool.reserve0).toEqual(new TokenAmount(DAI, '101'))
  //     pool = new Pool(
  //       new TokenAmount(DAI, '101'),
  //       USDC100,
  //       FeeAmount.LOW,
  //       sqrtPriceX96Default,
  //       inRangeLiquidityDefault,
  //       tickMapDefault
  //     )
  //     expect(pool.reserve0).toEqual(new TokenAmount(DAI, '101'))
  //   })
  // })
  // describe('#reserve1', () => {
  //   it('always comes from the token that sorts after', () => {
  //     expect(
  //       new Pool(
  //         USDC100,
  //         new TokenAmount(DAI, '101'),
  //         FeeAmount.LOW,
  //         sqrtPriceX96Default,
  //         inRangeLiquidityDefault,
  //         tickMapDefault
  //       ).reserve1
  //     ).toEqual(USDC100)
  //     expect(
  //       new Pool(
  //         new TokenAmount(DAI, '101'),
  //         USDC100,
  //         FeeAmount.LOW,
  //         sqrtPriceX96Default,
  //         inRangeLiquidityDefault,
  //         tickMapDefault
  //       ).reserve1
  //     ).toEqual(USDC100)
  //   })
  // })

  // describe('#token0Price', () => {
  //   it('returns price of token0 in terms of token1', () => {
  //     expect(
  //       new Pool(
  //         new TokenAmount(USDC, '101'),
  //         DAI100,
  //         FeeAmount.LOW,
  //         sqrtPriceX96Default,
  //         inRangeLiquidityDefault,
  //         tickMapDefault
  //       ).token0Price
  //     ).toEqual(new Price(DAI, USDC, '100', '101'))
  //     expect(
  //       new Pool(
  //         DAI100,
  //         new TokenAmount(USDC, '101'),
  //         FeeAmount.LOW,
  //         sqrtPriceX96Default,
  //         inRangeLiquidityDefault,
  //         tickMapDefault
  //       ).token0Price
  //     ).toEqual(new Price(DAI, USDC, '100', '101'))
  //   })
  // })

  // describe('#token1Price', () => {
  //   it('returns price of token1 in terms of token0', () => {
  //     expect(
  //       new Pool(
  //         new TokenAmount(USDC, '101'),
  //         DAI100,
  //         FeeAmount.LOW,
  //         sqrtPriceX96Default,
  //         inRangeLiquidityDefault,
  //         tickMapDefault
  //       ).token1Price
  //     ).toEqual(new Price(USDC, DAI, '101', '100'))
  //     expect(
  //       new Pool(
  //         DAI100,
  //         new TokenAmount(USDC, '101'),
  //         FeeAmount.LOW,
  //         sqrtPriceX96Default,
  //         inRangeLiquidityDefault,
  //         tickMapDefault
  //       ).token1Price
  //     ).toEqual(new Price(USDC, DAI, '101', '100'))
  //   })
  // })

  // describe('#chainId', () => {
  //   it('returns the token0 chainId', () => {
  //     pool = new Pool(USDC100, DAI100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
  //     expect(pool.chainId).toEqual(ChainId.MAINNET)
  //     pool = new Pool(DAI100, USDC100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
  //     expect(pool.chainId).toEqual(ChainId.MAINNET)
  //   })
  // })
  // describe.skip('#involvesToken', () => {
  //   pool = new Pool(USDC100, DAI100, FeeAmount.LOW, sqrtPriceX96Default, inRangeLiquidityDefault, tickMapDefault)
  //   expect(pool.involvesToken(USDC)).toEqual(true)
  //   expect(pool.involvesToken(DAI)).toEqual(true)
  //   expect(pool.involvesToken(WETH9[ChainId.MAINNET])).toEqual(false)
  // })

  // describe('#getLiquidityForAmounts', () => {
  //   it('amounts for price inside', () => {
  //     pool = new Pool(USDC100, DAI100, FeeAmount.LOW, encodePriceSqrt(1, 1), inRangeLiquidityDefault, tickMapDefault)
  //     const sqrtPriceAX96 = encodePriceSqrt(100, 110)
  //     const sqrtPriceBX96 = encodePriceSqrt(110, 100)
  //     const liquidity = pool.getLiquidityForAmounts(sqrtPriceAX96, sqrtPriceBX96, USDC100, DAI200)
  //     expect(liquidity).toEqual(JSBI.BigInt(2148))
  //   })

  //   it('amounts for price below', () => {
  //     pool = new Pool(USDC100, DAI100, FeeAmount.LOW, encodePriceSqrt(99, 110), inRangeLiquidityDefault, tickMapDefault)
  //     const sqrtPriceAX96 = encodePriceSqrt(100, 110)
  //     const sqrtPriceBX96 = encodePriceSqrt(110, 100)
  //     const liquidity = pool.getLiquidityForAmounts(sqrtPriceAX96, sqrtPriceBX96, USDC100, DAI200)
  //     expect(liquidity).toEqual(JSBI.BigInt(1048))
  //   })

  //   it('amounts for price above', () => {
  //     pool = new Pool(
  //       USDC100,
  //       DAI100,
  //       FeeAmount.LOW,
  //       encodePriceSqrt(111, 100),
  //       inRangeLiquidityDefault,
  //       tickMapDefault
  //     )
  //     const sqrtPriceAX96 = encodePriceSqrt(100, 110)
  //     const sqrtPriceBX96 = encodePriceSqrt(110, 100)
  //     const liquidity = pool.getLiquidityForAmounts(sqrtPriceAX96, sqrtPriceBX96, USDC100, DAI200)
  //     expect(liquidity).toEqual(JSBI.BigInt(2097))
  //   })
  // })
})
