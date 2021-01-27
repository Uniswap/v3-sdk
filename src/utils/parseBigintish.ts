import { BigintIsh } from '../constants'

export function parseBigintIsh(bigintIsh: BigintIsh): bigint {
  return typeof bigintIsh === 'bigint' ? bigintIsh : BigInt(bigintIsh)
}
