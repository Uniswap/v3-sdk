import { BigintIsh } from '@uniswap/sdk-core'
import JSBI from 'jsbi'

interface TickConstructorArgs {
  feeGrowthOutside0X128: BigintIsh
  feeGrowthOutside1X128: BigintIsh
  index: number
  liquidityGross: BigintIsh
  liquidityNet: BigintIsh
}

export class Tick {
  private readonly i: number
  private readonly feeGrowthOutside0X128: JSBI
  private readonly feeGrowthOutside1X128: JSBI
  private readonly liquidityGross: JSBI
  private readonly liquidityNet: JSBI
  constructor({
    feeGrowthOutside0X128,
    feeGrowthOutside1X128,
    index,
    liquidityGross,
    liquidityNet
  }: TickConstructorArgs) {
    this.feeGrowthOutside0X128 = JSBI.BigInt(feeGrowthOutside0X128)
    this.feeGrowthOutside1X128 = JSBI.BigInt(feeGrowthOutside1X128)
    this.i = index
    this.liquidityGross = JSBI.BigInt(liquidityGross)
    this.liquidityNet = JSBI.BigInt(liquidityNet)
  }

  public get todo(): void {
    console.log(
      this.feeGrowthOutside0X128,
      this.feeGrowthOutside1X128,
      this.index,
      this.liquidityGross,
      this.liquidityNet
    )
    return
  }

  public get index(): number {
    return this.i
  }
}
