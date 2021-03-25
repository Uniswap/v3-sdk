import { defaultAbiCoder } from '@ethersproject/abi'
import { getCreate2Address } from '@ethersproject/address'
import { keccak256 } from '@ethersproject/solidity'
import { Token } from '@uniswap/sdk-core'
import { FeeAmount, POOL_INIT_CODE_HASH } from '../constants'

export const computePoolAddress = ({
  factoryAddress,
  tokenA,
  tokenB,
  fee
}: {
  factoryAddress: string
  tokenA: Token
  tokenB: Token
  fee: FeeAmount
}): string => {
  const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA] // does safety checks
  return getCreate2Address(
    factoryAddress,
    keccak256(
      ['bytes'],
      [defaultAbiCoder.encode(['address', 'address', 'uint24'], [token0.address, token1.address, fee])]
    ),
    POOL_INIT_CODE_HASH
  )
}
