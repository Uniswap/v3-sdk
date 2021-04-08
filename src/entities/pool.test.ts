import { ChainId, Token, TokenAmount, WETH9 } from '@uniswap/sdk-core'
import { FeeAmount, TICK_SPACINGS } from '../constants'
import { nearestUsableTick } from '../utils/nearestUsableTick'
import { TickMath } from '../utils/tickMath'
import { Pool } from './pool'
import { Tick } from './tick'
import { TickList } from './tickList'
import { encodeSqrtRatioX96 } from '../utils/encodeSqrtRatioX96'
import JSBI from 'jsbi'
import { NEGATIVE_ONE } from '../internalConstants'

const ONE_ETHER = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(18))

describe('Pool', () => {
  const USDC = new Token(ChainId.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin')
  const DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
  const tickMapDefault: TickList = new TickList([
    new Tick({ index: -2, liquidityNet: 0, liquidityGross: 0 }),
    new Tick({ index: 2, liquidityNet: 0, liquidityGross: 0 })
  ])

  describe('constructor', () => {
    it('cannot be used for tokens on different chains', () => {
      expect(() => {
        new Pool(USDC, WETH9[ChainId.RINKEBY], FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 0, new TickList([]))
      }).toThrow('CHAIN_IDS')
    })

    it('fee must be integer', () => {
      expect(() => {
        new Pool(USDC, WETH9[ChainId.MAINNET], FeeAmount.MEDIUM + 0.5, encodeSqrtRatioX96(1, 1), 0, 0, new TickList([]))
      }).toThrow('FEE')
    })

    it('fee cannot be more than 1e6', () => {
      expect(() => {
        new Pool(USDC, WETH9[ChainId.MAINNET], 1e6, encodeSqrtRatioX96(1, 1), 0, 0, new TickList([]))
      }).toThrow('FEE')
    })

    it('cannot be given two of the same token', () => {
      expect(() => {
        new Pool(USDC, USDC, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 0, new TickList([]))
      }).toThrow('ADDRESSES')
    })

    it('price must be within tick price bounds', () => {
      expect(() => {
        new Pool(USDC, WETH9[ChainId.MAINNET], FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 1, new TickList([]))
      }).toThrow('PRICE_BOUNDS')
      expect(() => {
        new Pool(
          USDC,
          WETH9[ChainId.MAINNET],
          FeeAmount.MEDIUM,
          JSBI.add(encodeSqrtRatioX96(1, 1), JSBI.BigInt(1)),
          0,
          -1,
          new TickList([])
        )
      }).toThrow('PRICE_BOUNDS')
    })

    it('works with valid arguments for empty pool medium fee', () => {
      new Pool(USDC, WETH9[ChainId.MAINNET], FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 0, new TickList([]))
    })

    it('works with valid arguments for empty pool low fee', () => {
      new Pool(USDC, WETH9[ChainId.MAINNET], FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, new TickList([]))
    })

    it('works with valid arguments for empty pool high fee', () => {
      new Pool(USDC, WETH9[ChainId.MAINNET], FeeAmount.HIGH, encodeSqrtRatioX96(1, 1), 0, 0, new TickList([]))
    })
  })

  describe('#getAddress', () => {
    it('matches an example', () => {
      const result = Pool.getAddress(USDC, DAI, FeeAmount.LOW)
      expect(result).toEqual('0xE2E0399F5Fa02d7a3B6A9566539C14C799FAf413')
    })
  })

  describe('#token0', () => {
    it('always is the token that sorts before', () => {
      let pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, tickMapDefault)
      expect(pool.token0).toEqual(DAI)
      pool = new Pool(DAI, USDC, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, tickMapDefault)
      expect(pool.token0).toEqual(DAI)
    })
  })
  describe('#token1', () => {
    it('always is the token that sorts after', () => {
      let pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, tickMapDefault)
      expect(pool.token1).toEqual(USDC)
      pool = new Pool(DAI, USDC, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, tickMapDefault)
      expect(pool.token1).toEqual(USDC)
    })
  })

  describe('#token0Price', () => {
    it('returns price of token0 in terms of token1', () => {
      expect(
        new Pool(
          USDC,
          DAI,
          FeeAmount.LOW,
          encodeSqrtRatioX96(101e6, 100e18),
          0,
          TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(101e6, 100e18)),
          tickMapDefault
        ).token0Price.toSignificant(5)
      ).toEqual('1.01')
      expect(
        new Pool(
          DAI,
          USDC,
          FeeAmount.LOW,
          encodeSqrtRatioX96(101e6, 100e18),
          0,
          TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(101e6, 100e18)),
          tickMapDefault
        ).token0Price.toSignificant(5)
      ).toEqual('1.01')
    })
  })

  describe('#token1Price', () => {
    it('returns price of token1 in terms of token0', () => {
      expect(
        new Pool(
          USDC,
          DAI,
          FeeAmount.LOW,
          encodeSqrtRatioX96(101e6, 100e18),
          0,
          TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(101e6, 100e18)),
          tickMapDefault
        ).token1Price.toSignificant(5)
      ).toEqual('0.9901')
      expect(
        new Pool(
          DAI,
          USDC,
          FeeAmount.LOW,
          encodeSqrtRatioX96(101e6, 100e18),
          0,
          TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(101e6, 100e18)),
          tickMapDefault
        ).token1Price.toSignificant(5)
      ).toEqual('0.9901')
    })
  })

  describe('#priceOf', () => {
    const pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, tickMapDefault)
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
      let pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, tickMapDefault)
      expect(pool.chainId).toEqual(ChainId.MAINNET)
      pool = new Pool(DAI, USDC, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, tickMapDefault)
      expect(pool.chainId).toEqual(ChainId.MAINNET)
    })
  })

  describe('#involvesToken', () => {
    const pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, tickMapDefault)
    expect(pool.involvesToken(USDC)).toEqual(true)
    expect(pool.involvesToken(DAI)).toEqual(true)
    expect(pool.involvesToken(WETH9[ChainId.MAINNET])).toEqual(false)
  })

  describe('swaps', () => {
    let pool: Pool

    beforeEach(() => {
      pool = new Pool(
        USDC,
        DAI,
        FeeAmount.LOW,
        encodeSqrtRatioX96(1, 1),
        ONE_ETHER,
        0,
        new TickList([
          new Tick({
            index: nearestUsableTick(TickMath.MIN_TICK, TICK_SPACINGS[FeeAmount.LOW]),
            liquidityNet: ONE_ETHER,
            liquidityGross: ONE_ETHER
          }),
          new Tick({
            index: nearestUsableTick(TickMath.MAX_TICK, TICK_SPACINGS[FeeAmount.LOW]),
            liquidityNet: JSBI.multiply(ONE_ETHER, NEGATIVE_ONE),
            liquidityGross: ONE_ETHER
          })
        ])
      )
    })

    describe('#getOutputAmount', () => {
      it('USDC -> DAI', () => {
        const inputAmount = new TokenAmount(USDC, 100)
        const [outputAmount] = pool.getOutputAmount(inputAmount)
        expect(outputAmount.token.equals(DAI)).toBe(true)
        expect(outputAmount.raw).toEqual(JSBI.BigInt(98))
      })

      it('DAI -> USDC', () => {
        const inputAmount = new TokenAmount(DAI, 100)
        const [outputAmount] = pool.getOutputAmount(inputAmount)
        expect(outputAmount.token.equals(USDC)).toBe(true)
        expect(outputAmount.raw).toEqual(JSBI.BigInt(98))
      })
    })

    describe('#getInputAmount', () => {
      it('USDC -> DAI', () => {
        const outputAmount = new TokenAmount(DAI, 98)
        const [inputAmount] = pool.getInputAmount(outputAmount)
        expect(inputAmount.token.equals(USDC)).toBe(true)
        expect(inputAmount.raw).toEqual(JSBI.BigInt(100))
      })

      it('DAI -> USDC', () => {
        const outputAmount = new TokenAmount(USDC, 98)
        const [inputAmount] = pool.getInputAmount(outputAmount)
        expect(inputAmount.token.equals(DAI)).toBe(true)
        expect(inputAmount.raw).toEqual(JSBI.BigInt(100))
      })
    })
  })
})
