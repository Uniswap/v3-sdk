import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { BigintIsh } from '@uniswap/sdk-core'
import { MAX_TICK, MIN_TICK } from '../constants'

interface TickConstructorArgs {
  feeGrowthOutside0X128: BigintIsh
  feeGrowthOutside1X128: BigintIsh
  index: number
  liquidityGross: BigintIsh
  liquidityNet: BigintIsh
}

export class Tick {
  public readonly index: number
  public readonly feeGrowthOutside0X128: JSBI
  public readonly feeGrowthOutside1X128: JSBI
  public readonly liquidityGross: JSBI
  public readonly liquidityNet: JSBI

  constructor({
    index,
    feeGrowthOutside0X128,
    feeGrowthOutside1X128,
    liquidityGross,
    liquidityNet
  }: TickConstructorArgs) {
    invariant(index >= MIN_TICK && index <= MAX_TICK, 'TICK')
    this.index = index
    this.feeGrowthOutside0X128 = JSBI.BigInt(feeGrowthOutside0X128)
    this.feeGrowthOutside1X128 = JSBI.BigInt(feeGrowthOutside1X128)
    this.liquidityGross = JSBI.BigInt(liquidityGross)
    this.liquidityNet = JSBI.BigInt(liquidityNet)
  }
}
