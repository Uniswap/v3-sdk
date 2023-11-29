import { Token } from '@uniswap/sdk-core'
import { FeeAmount, Tick } from '../'
import { ethers } from 'ethers'
import poolAbi from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import { Contract, Provider } from 'ethers-multicall'

export interface PoolData {
  address: string
  tokenA: Token
  tokenB: Token
  fee: FeeAmount
  sqrtPriceX96: BigInt
  liquidity: BigInt
  tick: number
  tickSpacing: number
}

export abstract class RPCPool {
  public static async getPoolData(
    provider: ethers.providers.Provider,
    poolAddress: string,
    blockNum: number
  ): Promise<PoolData> {
    const poolContract = new ethers.Contract(poolAddress, poolAbi.abi, provider)

    const [slot0, liquidity, tickSpacing, fee, token0, token1] = await Promise.all([
      poolContract.slot0({
        blockTag: blockNum,
      }),
      poolContract.liquidity({
        blockTag: blockNum,
      }),
      poolContract.tickSpacing({
        blockTag: blockNum,
      }),
      poolContract.fee({
        blockTag: blockNum,
      }),
      poolContract.token0({
        blockTag: blockNum,
      }),
      poolContract.token1({
        blockTag: blockNum,
      }),
    ])
    return {
      address: poolAddress,
      tokenA: token0,
      tokenB: token1,
      fee: fee,
      sqrtPriceX96: BigInt(slot0.sqrtPriceX96.toString()),
      liquidity: BigInt(liquidity.toString()),
      tick: parseInt(slot0.tick),
      tickSpacing: tickSpacing,
    }
  }

  public static async getTickIndicesInWordRange(
    provider: ethers.providers.Provider,
    poolAddress: string,
    tickSpacing: number,
    startWord: number,
    endWord: number
  ): Promise<number[]> {
    const multicallProvider = new Provider(provider)
    await multicallProvider.init()
    const poolContract = new Contract(poolAddress, poolAbi.abi)

    const calls: any[] = []
    const wordPosIndices: number[] = []

    for (let i = startWord; i <= endWord; i++) {
      wordPosIndices.push(i)
      calls.push(poolContract.tickBitmap(i))
    }

    const results: bigint[] = (await multicallProvider.all(calls)).map((ethersResponse: any) => {
      return BigInt(ethersResponse.toString())
    })

    const tickIndices: number[] = []

    for (let j = 0; j < wordPosIndices.length; j++) {
      const ind = wordPosIndices[j]
      const bitmap = results[j]

      if (bitmap !== 0n) {
        for (let i = 0; i < 256; i++) {
          const bit = 1n
          const initialized = (bitmap & (bit << BigInt(i))) !== 0n
          if (initialized) {
            const tickIndex = (ind * 256 + i) * tickSpacing
            tickIndices.push(tickIndex)
          }
        }
      }
    }

    return tickIndices
  }

  public static async getAllTicks(
    provider: ethers.providers.Provider,
    poolAddress: string,
    tickIndices: number[]
  ): Promise<Tick[]> {
    const multicallProvider = new Provider(provider)
    await multicallProvider.init()
    const poolContract = new Contract(poolAddress, poolAbi.abi)

    const calls: any[] = []

    for (const index of tickIndices) {
      calls.push(poolContract.ticks(index))
    }

    const results = await multicallProvider.all(calls)
    const allTicks: Tick[] = []

    for (let i = 0; i < tickIndices.length; i++) {
      const index = tickIndices[i]
      const ethersResponse = results[i]
      const tick = new Tick({
        index,
        liquidityGross: BigInt(ethersResponse.liquidityGross.toString()),
        liquidityNet: BigInt(ethersResponse.liquidityNet.toString()),
      })
      allTicks.push(tick)
    }
    return allTicks
  }
}
