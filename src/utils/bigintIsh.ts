import { BigintIsh } from '@uniswap/sdk-core'

export function bigIntFromBigintIsh(bigintIsh: BigintIsh): bigint {
  if (typeof bigintIsh === 'bigint') {
    return BigInt(bigintIsh)
  }

  return BigInt(bigintIsh.toString(10))
}
