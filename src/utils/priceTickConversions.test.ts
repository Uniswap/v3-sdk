import { ChainId, Token, WETH9 } from '@uniswap/sdk-core'
import { tickToPrice } from './index'
import { priceToClosestTick } from './priceTickConversions'

describe('priceTickConversions', () => {
  const WETH = WETH9[ChainId.MAINNET]
  const DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'Dai Stablecoin')
  const USDC = new Token(ChainId.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin')

  it('DAI sorts before ETH', () => {
    expect(DAI.sortsBefore(WETH)).toEqual(true)
  })

  it('DAI sorts before USDC', () => {
    expect(DAI.sortsBefore(USDC)).toEqual(true)
  })

  describe('#tickToPrice', () => {
    it('1800 DAI/1 ETH', () => {
      // tick is negative because DAI is token0
      expect(tickToPrice(WETH, DAI, -74959).toSignificant(5)).toEqual('1800')
    })

    it('1 ETH/1800 DAI', () => {
      // tick is negative because DAI is token0
      expect(tickToPrice(DAI, WETH, -74959).toSignificant(5)).toEqual('0.00055556')
    })

    it('1.01 USDC/1 DAI', () => {
      expect(tickToPrice(DAI, USDC, -276225).toSignificant(5)).toEqual('1.01')
    })

    it('1 DAI/1.01 USDC', () => {
      expect(tickToPrice(USDC, DAI, -276225).toSignificant(5)).toEqual('0.99015')
    })
  })

  describe('#priceToClosestTick', () => {
    it('1800 DAI/1 ETH', () => {
      expect(priceToClosestTick(tickToPrice(WETH, DAI, -74959))).toEqual(-74959)
    })

    it('1 ETH/1800 DAI', () => {
      // tick is negative because DAI is token0
      expect(priceToClosestTick(tickToPrice(DAI, WETH, -74959))).toEqual(-74959)
    })

    it('1.01 USDC/1 DAI', () => {
      expect(priceToClosestTick(tickToPrice(DAI, USDC, -276225))).toEqual(-276225)
    })

    it('1 DAI/1.01 USDC', () => {
      expect(priceToClosestTick(tickToPrice(USDC, DAI, -276225))).toEqual(-276225)
    })
  })
})
