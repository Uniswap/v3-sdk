import { MaxUint256 } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { ONE } from '../internalConstants'
import { leastSignificantBit } from './leastSignificantBit'

describe('leastSignificantBit', () => {
    it('throws for zero', () => {
        expect(() => leastSignificantBit(JSBI.BigInt(0))).toThrow('ZERO')
    })
    it('correct value for every power of 2', () => {
        for (let i = 1; i < 256; i++) {
            const x = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(i))
            expect(leastSignificantBit(x)).toEqual(i)
        }
    })
    it('correct value for every power of 2 - 1', () => {
        for (let i = 2; i < 256; i++) {
            const x = JSBI.subtract(JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(i)), JSBI.BigInt(1))
            expect(leastSignificantBit(x)).toEqual(0)
        }
    })

    it('succeeds for MaxUint256', () => {
        expect(leastSignificantBit(MaxUint256)).toEqual(0)
    })

    it('throws for MaxUint256 + 1', () => {
        expect(() => leastSignificantBit(JSBI.add(MaxUint256, ONE))).toThrow('MAX')
    })
})
