import bn from 'bignumber.js'
import JSBI from 'jsbi'
import { BigintIsh } from '@uniswap/sdk-core'

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

// returns the sqrt price as a 64x96
export function encodePriceSqrt(reserve1: BigintIsh, reserve0: BigintIsh): JSBI {
  return JSBI.BigInt(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  )
}
