import JSBI from 'jsbi'
import mostSignificantBit from './mostSignificantBit'

describe('mostSignificantBit', () => {
  it('correct value for every power of 2', async () => {
    for (let i = 1; i < 256; i++) {
      const x = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(i))
      expect(mostSignificantBit(x)).toEqual(i)
    }
  })
})
