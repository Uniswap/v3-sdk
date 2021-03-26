import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { MAX_SAFE_INTEGER, ONE, THREE, TWO, ZERO } from '../internalConstants'

/// TODO: optimize this function, move to sdk-core
/**
 * Computes floor(sqrt(value))
 * @param value the value for which to compute the square root, rounded down
 */
export function sqrt(value: JSBI): JSBI {
  invariant(JSBI.greaterThanOrEqual(value, ZERO), 'NEGATIVE')

  // rely on built in sqrt if possible
  if (JSBI.lessThan(value, MAX_SAFE_INTEGER)) {
    return JSBI.BigInt(Math.floor(Math.sqrt(JSBI.toNumber(value))))
  }

  let z: JSBI = ZERO
  let x: JSBI
  if (JSBI.greaterThan(value, THREE)) {
    z = value
    x = JSBI.add(JSBI.divide(value, TWO), ONE)
    while (JSBI.lessThan(x, z)) {
      z = x
      x = JSBI.divide(JSBI.add(JSBI.divide(value, x), x), TWO)
    }
  } else if (JSBI.notEqual(value, ZERO)) {
    z = ONE
  }
  return z
}
