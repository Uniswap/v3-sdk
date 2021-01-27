import Fraction from './fraction'

describe('Fraction', () => {
  describe('#quotient', () => {
    it('floor division', () => {
      expect(new Fraction(BigInt(8), BigInt(3)).quotient).toEqual(BigInt(2)) // one below
      expect(new Fraction(BigInt(12), BigInt(4)).quotient).toEqual(BigInt(3)) // exact
      expect(new Fraction(BigInt(16), BigInt(5)).quotient).toEqual(BigInt(3)) // one above
    })
  })
  describe('#remainder', () => {
    it('returns fraction after divison', () => {
      expect(new Fraction(BigInt(8), BigInt(3)).remainder).toEqual(new Fraction(BigInt(2), BigInt(3)))
      expect(new Fraction(BigInt(12), BigInt(4)).remainder).toEqual(new Fraction(BigInt(0), BigInt(4)))
      expect(new Fraction(BigInt(16), BigInt(5)).remainder).toEqual(new Fraction(BigInt(1), BigInt(5)))
    })
  })
  describe('#invert', () => {
    it('flips num and denom', () => {
      expect(new Fraction(BigInt(5), BigInt(10)).invert().numerator).toEqual(BigInt(10))
      expect(new Fraction(BigInt(5), BigInt(10)).invert().denominator).toEqual(BigInt(5))
    })
  })
  describe('#add', () => {
    it('multiples denoms and adds nums', () => {
      expect(new Fraction(BigInt(1), BigInt(10)).add(new Fraction(BigInt(4), BigInt(12)))).toEqual(
        new Fraction(BigInt(52), BigInt(120))
      )
    })

    it('same denom', () => {
      expect(new Fraction(BigInt(1), BigInt(5)).add(new Fraction(BigInt(2), BigInt(5)))).toEqual(
        new Fraction(BigInt(3), BigInt(5))
      )
    })
  })
  describe('#subtract', () => {
    it('multiples denoms and subtracts nums', () => {
      expect(new Fraction(BigInt(1), BigInt(10)).subtract(new Fraction(BigInt(4), BigInt(12)))).toEqual(
        new Fraction(BigInt(-28), BigInt(120))
      )
    })
    it('same denom', () => {
      expect(new Fraction(BigInt(3), BigInt(5)).subtract(new Fraction(BigInt(2), BigInt(5)))).toEqual(
        new Fraction(BigInt(1), BigInt(5))
      )
    })
  })
  describe('#lessThan', () => {
    it('correct', () => {
      expect(new Fraction(BigInt(1), BigInt(10)).lessThan(new Fraction(BigInt(4), BigInt(12)))).toBe(true)
      expect(new Fraction(BigInt(1), BigInt(3)).lessThan(new Fraction(BigInt(4), BigInt(12)))).toBe(false)
      expect(new Fraction(BigInt(5), BigInt(12)).lessThan(new Fraction(BigInt(4), BigInt(12)))).toBe(false)
    })
  })
  describe('#equalTo', () => {
    it('correct', () => {
      expect(new Fraction(BigInt(1), BigInt(10)).equalTo(new Fraction(BigInt(4), BigInt(12)))).toBe(false)
      expect(new Fraction(BigInt(1), BigInt(3)).equalTo(new Fraction(BigInt(4), BigInt(12)))).toBe(true)
      expect(new Fraction(BigInt(5), BigInt(12)).equalTo(new Fraction(BigInt(4), BigInt(12)))).toBe(false)
    })
  })
  describe('#greaterThan', () => {
    it('correct', () => {
      expect(new Fraction(BigInt(1), BigInt(10)).greaterThan(new Fraction(BigInt(4), BigInt(12)))).toBe(false)
      expect(new Fraction(BigInt(1), BigInt(3)).greaterThan(new Fraction(BigInt(4), BigInt(12)))).toBe(false)
      expect(new Fraction(BigInt(5), BigInt(12)).greaterThan(new Fraction(BigInt(4), BigInt(12)))).toBe(true)
    })
  })
  describe('#multiplty', () => {
    it('correct', () => {
      expect(new Fraction(BigInt(1), BigInt(10)).multiply(new Fraction(BigInt(4), BigInt(12)))).toEqual(
        new Fraction(BigInt(4), BigInt(120))
      )
      expect(new Fraction(BigInt(1), BigInt(3)).multiply(new Fraction(BigInt(4), BigInt(12)))).toEqual(
        new Fraction(BigInt(4), BigInt(36))
      )
      expect(new Fraction(BigInt(5), BigInt(12)).multiply(new Fraction(BigInt(4), BigInt(12)))).toEqual(
        new Fraction(BigInt(20), BigInt(144))
      )
    })
  })
  describe('#divide', () => {
    it('correct', () => {
      expect(new Fraction(BigInt(1), BigInt(10)).divide(new Fraction(BigInt(4), BigInt(12)))).toEqual(
        new Fraction(BigInt(12), BigInt(40))
      )
      expect(new Fraction(BigInt(1), BigInt(3)).divide(new Fraction(BigInt(4), BigInt(12)))).toEqual(
        new Fraction(BigInt(12), BigInt(12))
      )
      expect(new Fraction(BigInt(5), BigInt(12)).divide(new Fraction(BigInt(4), BigInt(12)))).toEqual(
        new Fraction(BigInt(60), BigInt(48))
      )
    })
  })
})
