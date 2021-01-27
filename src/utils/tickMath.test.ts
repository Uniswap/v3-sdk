import TickMath from './tickMath'

describe('TickMath', () => {
  describe('#getRatioAtTick', () => {
    it('returns the correct value for min tick', () => {
      expect(TickMath.getRatioAtTick(-887272).toString()).toEqual('18447437462383981825')
    })
    it('returns the correct value for max tick', () => {
      expect(TickMath.getRatioAtTick(887272).toString()).toEqual(
        '6276865796315986613307619852238232712866172378830071145882'
      )
    })
  })
})
