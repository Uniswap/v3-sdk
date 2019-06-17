import BigNumber from 'bignumber.js'
import { ethers } from 'ethers'

import { BigNumberish } from '../types'
import { ETH } from '../constants'
import { normalizeBigNumberish, getEthToken } from '../_utils'

interface TestCase {
  input: BigNumberish
  expectedOutput: BigNumber
}

function constructTestCase(input: BigNumberish, expectedOutput: BigNumber): TestCase {
  return { input, expectedOutput }
}

function testSuccesses(expectedSuccesses: TestCase[]): void {
  test('failures', (): void => {
    expectedSuccesses.forEach(
      ({ input, expectedOutput }: TestCase): void => {
        const output: BigNumber = normalizeBigNumberish(input)
        expect(output.isEqualTo(expectedOutput)).toBe(true)
      }
    )
  })
}

function testFailures(expectedFailures: BigNumberish[]): void {
  test('failures', (): void => {
    expectedFailures.forEach(
      (expectedFailure: BigNumberish): void => {
        expect(
          (): void => {
            normalizeBigNumberish(expectedFailure)
          }
        ).toThrow()
      }
    )
  })
}

describe('normalizeBigNumberish', (): void => {
  describe('string', (): void => {
    const expectedSuccesses: TestCase[] = [
      constructTestCase('0', new BigNumber('0')),
      constructTestCase('1', new BigNumber('1')),
      constructTestCase('1.234', new BigNumber('1.234'))
    ]
    const expectedFailures: string[] = ['.', ',', 'a', '0.0.']

    testSuccesses(expectedSuccesses)
    testFailures(expectedFailures)
  })

  describe('number', (): void => {
    const expectedSuccesses: TestCase[] = [
      constructTestCase(0, new BigNumber('0')),
      constructTestCase(1, new BigNumber('1')),
      constructTestCase(1.234, new BigNumber('1.234'))
    ]
    const expectedFailures: number[] = [NaN, Infinity]

    testSuccesses(expectedSuccesses)
    testFailures(expectedFailures)
  })

  describe('BigNumber', (): void => {
    const expectedSuccesses: TestCase[] = [
      constructTestCase(new BigNumber(0), new BigNumber('0')),
      constructTestCase(new BigNumber(1), new BigNumber('1')),
      constructTestCase(new BigNumber('1.234'), new BigNumber('1.234'))
    ]
    const expectedFailures: BigNumber[] = [new BigNumber(NaN)]

    testSuccesses(expectedSuccesses)
    testFailures(expectedFailures)
  })

  describe('ethers.utils.BigNumber', (): void => {
    const expectedSuccesses: TestCase[] = [
      constructTestCase(ethers.constants.Zero, new BigNumber('0')),
      constructTestCase(ethers.constants.One, new BigNumber('1')),
      constructTestCase(ethers.utils.bigNumberify('1234'), new BigNumber('1234')),
      constructTestCase(ethers.utils.parseUnits('1.234', 3), new BigNumber('1234'))
    ]
    const expectedFailures: ethers.utils.BigNumber[] = []

    testSuccesses(expectedSuccesses)
    testFailures(expectedFailures)
  })
})

test('getEthToken', (): void => {
  expect(getEthToken(1).address).toEqual(ETH)
})
