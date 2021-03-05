import { FeeAmount } from '../constants'
import { computePoolAddress, Pool } from './pool'
import { Token, WETH9, TokenAmount, Price, ChainId } from '@uniswap/sdk-core'

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

  beforeEach(() => {
    USDC = new Token(ChainId.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 18, 'USDC', 'USD Coin')
    DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
    DAI100 = new TokenAmount(DAI, '100')
    USDC100 = new TokenAmount(USDC, '100')
  })
  describe('constructor', () => {
    it('cannot be used for tokens on different chains', () => {
      expect(() => {
        new Pool(USDC100, new TokenAmount(WETH9[ChainId.RINKEBY], '100'), FeeAmount.MEDIUM)
      }).toThrow('CHAIN_IDS')
    })
  })

  describe('#getAddress', () => {
    it('matches an example', () => {
      expect(Pool.getAddress(USDC, DAI, FeeAmount.LOW)).toEqual('0x462491f91B7889fC968F35fa510E93F7d40d0DCC')
    })
  })

  describe('#token0', () => {
    it('always is the token that sorts before', () => {
      expect(new Pool(USDC100, DAI100, FeeAmount.LOW).token0).toEqual(DAI)
      expect(new Pool(DAI100, USDC100, FeeAmount.LOW).token0).toEqual(DAI)
    })
  })
  describe('#token1', () => {
    it('always is the token that sorts after', () => {
      expect(new Pool(USDC100, DAI100, FeeAmount.LOW).token1).toEqual(USDC)
      expect(new Pool(DAI100, USDC100, FeeAmount.LOW).token1).toEqual(USDC)
    })
  })
  describe('#reserve0', () => {
    it('always comes from the token that sorts before', () => {
      expect(new Pool(USDC100, new TokenAmount(DAI, '101'), FeeAmount.LOW).reserve0).toEqual(
        new TokenAmount(DAI, '101')
      )
      expect(new Pool(new TokenAmount(DAI, '101'), USDC100, FeeAmount.LOW).reserve0).toEqual(
        new TokenAmount(DAI, '101')
      )
    })
  })
  describe('#reserve1', () => {
    it('always comes from the token that sorts after', () => {
      expect(new Pool(USDC100, new TokenAmount(DAI, '101'), FeeAmount.LOW).reserve1).toEqual(USDC100)
      expect(new Pool(new TokenAmount(DAI, '101'), USDC100, FeeAmount.LOW).reserve1).toEqual(USDC100)
    })
  })

  describe('#token0Price', () => {
    it('returns price of token0 in terms of token1', () => {
      expect(new Pool(new TokenAmount(USDC, '101'), DAI100, FeeAmount.LOW).token0Price).toEqual(
        new Price(DAI, USDC, '100', '101')
      )
      expect(new Pool(DAI100, new TokenAmount(USDC, '101'), FeeAmount.LOW).token0Price).toEqual(
        new Price(DAI, USDC, '100', '101')
      )
    })
  })

  describe('#token1Price', () => {
    it('returns price of token1 in terms of token0', () => {
      expect(new Pool(new TokenAmount(USDC, '101'), DAI100, FeeAmount.LOW).token1Price).toEqual(
        new Price(USDC, DAI, '101', '100')
      )
      expect(new Pool(DAI100, new TokenAmount(USDC, '101'), FeeAmount.LOW).token1Price).toEqual(
        new Price(USDC, DAI, '101', '100')
      )
    })
  })

  describe('#priceOf', () => {
    const pool = new Pool(new TokenAmount(USDC, '101'), DAI100, FeeAmount.LOW)
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
      expect(new Pool(USDC100, new TokenAmount(DAI, '101'), FeeAmount.LOW).reserveOf(USDC)).toEqual(USDC100)
      expect(new Pool(new TokenAmount(DAI, '101'), USDC100, FeeAmount.LOW).reserveOf(USDC)).toEqual(USDC100)
    })

    it('throws if not in the pool', () => {
      expect(() =>
        new Pool(new TokenAmount(DAI, '101'), USDC100, FeeAmount.LOW).reserveOf(WETH9[ChainId.MAINNET])
      ).toThrow('TOKEN')
    })
  })

  describe('#chainId', () => {
    it('returns the token0 chainId', () => {
      expect(new Pool(USDC100, DAI100, FeeAmount.LOW).chainId).toEqual(ChainId.MAINNET)
      expect(new Pool(DAI100, USDC100, FeeAmount.LOW).chainId).toEqual(ChainId.MAINNET)
    })
  })
  describe('#involvesToken', () => {
    expect(new Pool(USDC100, DAI100, FeeAmount.LOW).involvesToken(USDC)).toEqual(true)
    expect(new Pool(USDC100, DAI100, FeeAmount.LOW).involvesToken(DAI)).toEqual(true)
    expect(new Pool(USDC100, DAI100, FeeAmount.LOW).involvesToken(WETH9[ChainId.MAINNET])).toEqual(false)
  })
})
