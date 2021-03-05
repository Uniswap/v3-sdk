import { ETHER, Token, TokenAmount, WETH, ChainId } from '@uniswap/sdk-core'
import { Pool } from './pool'
import { Route } from './route'

describe.skip('Route', () => {
  const token0 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000001', 18, 't0')
  const token1 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000002', 18, 't1')
  const weth = WETH[ChainId.MAINNET]
  const pool_0_1 = new Pool(new TokenAmount(token0, '100'), new TokenAmount(token1, '200'))
  const pool_0_weth = new Pool(new TokenAmount(token0, '100'), new TokenAmount(weth, '100'))
  const pool_1_weth = new Pool(new TokenAmount(token1, '175'), new TokenAmount(weth, '100'))

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
