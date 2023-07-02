import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { BigintIsh } from '@uniswap/sdk-core'
import { TickMath } from '../utils'
import { bigIntFromBigintIsh } from 'src/utils/bigintIsh'

export interface TickConstructorArgs {
  index: number
  liquidityGross: BigintIsh
  liquidityNet: BigintIsh
}

export class Tick {
  public readonly index: number
  public get liquidityGross(): JSBI {
    return JSBI.BigInt(this._liquidityGross.toString(10))
  }
  public get liquidityNet(): JSBI {
    return JSBI.BigInt(this._liquidityNet.toString(10))
  }
  public readonly _liquidityGross: bigint
  public readonly _liquidityNet: bigint

  constructor({ index, liquidityGross, liquidityNet }: TickConstructorArgs) {
    invariant(index >= TickMath.MIN_TICK && index <= TickMath.MAX_TICK, 'TICK')
    this.index = index
    this._liquidityGross = bigIntFromBigintIsh(liquidityGross)
    this._liquidityNet = bigIntFromBigintIsh(liquidityNet)
  }
}
