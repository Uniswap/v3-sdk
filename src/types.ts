import JSBI from 'jsbi'

export type BigintIsh = JSBI | bigint | string

export enum Rounding {
  ROUND_DOWN,
  ROUND_HALF_UP,
  ROUND_UP
}
