import { ChainId, WETH, Token, Exchange } from '../src'

describe('data', () => {
  it('Token', async () => {
    const token = await Token.fetchData(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F') // DAI
    expect(token.decimals).toEqual(18)
  })

  it('Token:CACHE', async () => {
    const token = await Token.fetchData(ChainId.MAINNET, '0xE0B7927c4aF23765Cb51314A0E0521A9645F0E2A') // DGD
    expect(token.decimals).toEqual(9)
  })

  it('Exchange', async () => {
    const token = new Token(ChainId.RINKEBY, '0xc7AD46e0b8a400Bb3C915120d284AafbA8fc4735', 18) // DAI
    const exchange = await Exchange.fetchData(WETH[ChainId.RINKEBY], token)
    expect(exchange.liquidityToken.address).toEqual('0x3DDd4674C99979EAd4a3160f12567c90a07f0e94')
  })
})
