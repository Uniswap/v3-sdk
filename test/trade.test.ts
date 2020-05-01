import { ChainId } from '../src/constants'
import { Token, TokenAmount, Pair, Trade } from '../src/entities'
import JSBI from 'jsbi'

describe('Trade', () => {
  describe('#bestTradeExactIn', () => {
    const token0 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000001', 18)
    const token1 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000002', 18)
    const token2 = new Token(ChainId.MAINNET, '0x0000000000000000000000000000000000000003', 18)

    const pair_0_1 = new Pair(new TokenAmount(token0, JSBI.BigInt(1000)), new TokenAmount(token1, JSBI.BigInt(1000)))
    const pair_1_2 = new Pair(new TokenAmount(token1, JSBI.BigInt(1200)), new TokenAmount(token2, JSBI.BigInt(1000)))
    const pair_0_2 = new Pair(new TokenAmount(token0, JSBI.BigInt(1000)), new TokenAmount(token2, JSBI.BigInt(1100)))

    it('provides the best path from 0 to 2', () => {
      const result = Trade.bestTradeExactIn(
        [pair_0_1, pair_0_2, pair_1_2],
        new TokenAmount(token0, JSBI.BigInt(10)),
        token2
      )
      expect(result).toHaveLength(2)
      expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[1].route.pairs).toHaveLength(2) // 0 -> 1 -> 2 at 12:12:10
    })
  })
})
