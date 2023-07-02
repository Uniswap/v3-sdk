import { Token, BigintIsh, CurrencyAmount } from '@uniswap/sdk-core'
import { Pool } from 'src/entities/pool'
import { TickDataProvider } from 'src/entities/tickDataProvider'
import { Tick, TickConstructorArgs } from 'src/entities/tick'
import { TickList } from 'src/utils/tickList'
import fs from 'fs'

export class CustomTickListDataProvider implements TickDataProvider {
  private ticks: readonly Tick[]

  constructor(ticks: (Tick | TickConstructorArgs)[]) {
    const ticksMapped: Tick[] = ticks.map((t) => (t instanceof Tick ? t : new Tick(t)))
    this.ticks = ticksMapped
  }

  async getTick(tick: number): Promise<{ liquidityNet: BigintIsh; liquidityGross: BigintIsh }> {
    return TickList.getTick(this.ticks, tick)
  }

  async nextInitializedTickWithinOneWord(tick: number, lte: boolean, tickSpacing: number): Promise<[number, boolean]> {
    return TickList.nextInitializedTickWithinOneWord(this.ticks, tick, lte, tickSpacing)
  }
}

describe('Automated Swap Test Runner', () => {
  const stubsDir = `${__dirname}/../stubs/swap`
  const jsonStubs = fs.readdirSync(stubsDir)
  it('should contain at least 1 json stub test', () => {
    expect(jsonStubs.length).toBeGreaterThanOrEqual(1)
  })

  for (const fileName of jsonStubs) {
    const testsJson = JSON.parse(fs.readFileSync(`${stubsDir}/${fileName}`).toString())

    // Run the tests defined in the file

    describe(`${testsJson.poolName}`, () => {
      const tokenA = new Token(testsJson.tokenA.chainId, testsJson.tokenA.address, testsJson.tokenA.decimals)
      const tokenB = new Token(testsJson.tokenB.chainId, testsJson.tokenB.address, testsJson.tokenB.decimals)
      const pool = new Pool(
        tokenA,
        tokenB,
        testsJson.fee,
        testsJson.sqrtRatioX96,
        testsJson.liquidity,
        testsJson.tickCurrent,
        new CustomTickListDataProvider(testsJson.ticks)
      )

      for (const test of testsJson.tests) {
        if (test.exactInput) {
          it(`should calculate output ${test.expectedAmountCalculated}`, async () => {
            const [output, _pool]: [CurrencyAmount<typeof tokenB>, Pool] = await pool.getOutputAmount(
              CurrencyAmount.fromRawAmount(tokenA, test.amountSpecified)
            )
            expect(output.asFraction.toFixed(0)).toBe(test.expectedAmountCalculated)
          })
        } else {
          it(`should calculate input ${test.expectedAmountCalculated}`, async () => {
            const [input, _pool]: [CurrencyAmount<typeof tokenA>, Pool] = await pool.getInputAmount(
              CurrencyAmount.fromRawAmount(tokenB, test.amountSpecified)
            )
            expect(input.asFraction.toFixed(0)).toBe(test.expectedAmountCalculated)
          })
        }
      }
    })
  }
})
