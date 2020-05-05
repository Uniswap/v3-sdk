import { Token, Pair } from '../src/entities'
import { ChainId } from '../src/constants'

describe('Pair', () => {
  describe('#getAddress', () => {
    it('returns the correct address', () => {
      const usdc = new Token(ChainId.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 18, 'USDC', 'USD Coin')
      const dai = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
      expect(Pair.getAddress(usdc, dai)).toEqual('0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5')
    })
  })
})
