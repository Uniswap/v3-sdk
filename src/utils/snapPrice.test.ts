import { ChainId, Price, Token } from '@uniswap/sdk-core'
import { FeeAmount } from '../constants'
import { snapPrice } from './snapPrice'

describe('#snapPrice', () => {
  /**
   * Creates an example token with a specific sort order
   */
  function token({
    sortOrder,
    decimals = 18,
    chainId = ChainId.MAINNET
  }: {
    sortOrder: number
    decimals?: number
    chainId?: ChainId
  }): Token {
    if (sortOrder > 9 || sortOrder % 1 !== 0) throw new Error('invalid sort order')
    return new Token(
      chainId,
      `0x${new Array<string>(40).fill(`${sortOrder}`).join('')}`,
      decimals,
      `T${sortOrder}`,
      `token${sortOrder}`
    )
  }

  const token0 = token({ sortOrder: 0 })
  const token1 = token({ sortOrder: 1 })
  // const token2_6decimals = token({ sortOrder: 2, decimals: 6 })

  describe('#snapPrice', () => {
    it('is correct for 2500', () => {
      expect(snapPrice(new Price(token0, token1, 1, 2500), FeeAmount.MEDIUM).toSignificant(5)).toEqual('2498.9')
    })

    it('is correct for 500', () => {
      expect(snapPrice(new Price(token0, token1, 1, 500), FeeAmount.MEDIUM).toSignificant(5)).toEqual('500.54')
    })

    it('is correct for 0.5', () => {
      expect(snapPrice(new Price(token0, token1, 2, 1), FeeAmount.MEDIUM).toSignificant(5)).toEqual('0.49859')
    })

    it('is correct for 1/2500', () => {
      expect(snapPrice(new Price(token0, token1, 2500, 1), FeeAmount.MEDIUM).toSignificant(5)).toEqual('0.00040017')
    })

    it('is closer to 500 for smaller fee amount', () => {
      expect(snapPrice(new Price(token0, token1, 1, 500), FeeAmount.LOW).toSignificant(5)).toEqual('500.04')
    })

    it('is closer to 0.5 for smaller fee amount', () => {
      expect(snapPrice(new Price(token0, token1, 2, 1), FeeAmount.LOW).toSignificant(5)).toEqual('0.50009')
    })

    it('is farther from 500 for larger fee amount', () => {
      expect(snapPrice(new Price(token0, token1, 1, 500), FeeAmount.HIGH).toSignificant(5)).toEqual('502.55')
    })

    it('is farther from 0.5 for larger fee amount', () => {
      expect(snapPrice(new Price(token0, token1, 2, 1), FeeAmount.HIGH).toSignificant(5)).toEqual('0.4966')
    })
  })
})
