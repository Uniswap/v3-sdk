import { BigintIsh } from '../types'

export function parseBigintIsh(bigintIsh: BigintIsh): bigint {
  return typeof bigintIsh === 'string' ? BigInt(bigintIsh) : bigintIsh
}
