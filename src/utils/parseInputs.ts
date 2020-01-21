import JSBI from 'jsbi'

import { BigintIsh } from '../types'

export function parseBigintIsh(bigintIsh: BigintIsh): JSBI {
  return typeof bigintIsh === 'bigint'
    ? JSBI.BigInt(bigintIsh.toString())
    : bigintIsh instanceof JSBI
    ? bigintIsh
    : JSBI.BigInt(bigintIsh)
}
