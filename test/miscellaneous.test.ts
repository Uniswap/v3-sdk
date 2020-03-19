import { ChainId, Token, TokenAmount, Pair, InsufficientInputAmountError } from '../src'

describe('miscellaneous', () => {
  it('getLiquidityMinted:0', async () => {
    const tokenA = new Token(ChainId.RINKEBY, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.RINKEBY, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '0'), new TokenAmount(tokenB, '0'))

    expect(() => {
      pair.getLiquidityMinted(
        new TokenAmount(pair.liquidityToken, '0'),
        new TokenAmount(tokenA, '1000'),
        new TokenAmount(tokenB, '1000')
      )
    }).toThrow(InsufficientInputAmountError)

    expect(() => {
      pair.getLiquidityMinted(
        new TokenAmount(pair.liquidityToken, '0'),
        new TokenAmount(tokenA, '1000000'),
        new TokenAmount(tokenB, '1')
      )
    }).toThrow(InsufficientInputAmountError)

    const liquidity = pair.getLiquidityMinted(
      new TokenAmount(pair.liquidityToken, '0'),
      new TokenAmount(tokenA, '1001'),
      new TokenAmount(tokenB, '1001')
    )

    expect(liquidity.raw.toString()).toEqual('1')
  })

  it('getLiquidityMinted:!0', async () => {
    const tokenA = new Token(ChainId.RINKEBY, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.RINKEBY, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '10000'), new TokenAmount(tokenB, '10000'))

    expect(
      pair
        .getLiquidityMinted(
          new TokenAmount(pair.liquidityToken, '10000'),
          new TokenAmount(tokenA, '2000'),
          new TokenAmount(tokenB, '2000')
        )
        .raw.toString()
    ).toEqual('2000')
  })

  it('getLiquidityValue:!feeOn', async () => {
    const tokenA = new Token(ChainId.RINKEBY, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.RINKEBY, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '1000'), new TokenAmount(tokenB, '1000'))

    {
      const liquidityValue = pair.getLiquidityValue(
        tokenA,
        new TokenAmount(pair.liquidityToken, '1000'),
        new TokenAmount(pair.liquidityToken, '1000'),
        false
      )
      expect(liquidityValue.token.equals(tokenA)).toBe(true)
      expect(liquidityValue.raw.toString()).toBe('1000')
    }

    // 500
    {
      const liquidityValue = pair.getLiquidityValue(
        tokenA,
        new TokenAmount(pair.liquidityToken, '1000'),
        new TokenAmount(pair.liquidityToken, '500'),
        false
      )
      expect(liquidityValue.token.equals(tokenA)).toBe(true)
      expect(liquidityValue.raw.toString()).toBe('500')
    }

    // tokenB
    {
      const liquidityValue = pair.getLiquidityValue(
        tokenB,
        new TokenAmount(pair.liquidityToken, '1000'),
        new TokenAmount(pair.liquidityToken, '1000'),
        false
      )
      expect(liquidityValue.token.equals(tokenB)).toBe(true)
      expect(liquidityValue.raw.toString()).toBe('1000')
    }
  })

  it('getLiquidityValue:feeOn', async () => {
    const tokenA = new Token(ChainId.RINKEBY, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.RINKEBY, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '1000'), new TokenAmount(tokenB, '1000'))

    const liquidityValue = pair.getLiquidityValue(
      tokenA,
      new TokenAmount(pair.liquidityToken, '500'),
      new TokenAmount(pair.liquidityToken, '500'),
      true,
      '250000' // 500 ** 2
    )
    expect(liquidityValue.token.equals(tokenA)).toBe(true)
    expect(liquidityValue.raw.toString()).toBe('917') // ceiling(1000 - (500 * (1 / 6)))
  })
})
