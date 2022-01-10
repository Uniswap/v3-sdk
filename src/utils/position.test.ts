import JSBI from 'jsbi'
import { ZERO } from '../internalConstants'
import { Position } from './position'

describe('Position', () => {
  describe('#getTokensOwed', () => {
    it('0', () => {
      const [tokensOwed0, tokensOwed1] = Position.getTokensOwed(ZERO, ZERO, ZERO, ZERO, ZERO)
      expect(tokensOwed0).toEqual(ZERO)
      expect(tokensOwed1).toEqual(ZERO)
    })

    it('non-0', () => {
      const [tokensOwed0, tokensOwed1] = Position.getTokensOwed(
        ZERO,
        ZERO,
        JSBI.BigInt(1),
        JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(128)),
        JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(128))
      )
      expect(tokensOwed0).toEqual(JSBI.BigInt(1))
      expect(tokensOwed1).toEqual(JSBI.BigInt(1))
    })
  })
})
