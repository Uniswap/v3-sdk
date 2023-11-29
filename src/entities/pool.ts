import { BigintIsh, CurrencyAmount, Price, Token, V3_CORE_FACTORY_ADDRESSES } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { FACTORY_ADDRESS, FeeAmount, TICK_SPACINGS } from '../constants'
import { Q192_BIGINT } from '../internalConstants'
import { computePoolAddress } from '../utils/computePoolAddress'
import { LiquidityMath } from '../utils/liquidityMath'
import { SwapMath } from '../utils/swapMath'
import { TickMath } from '../utils/tickMath'
import { Tick, TickConstructorArgs } from './tick'
import { NoTickDataProvider, TickDataProvider } from './tickDataProvider'
import { TickListDataProvider } from './tickListDataProvider'
import { bigIntFromBigintIsh } from '../utils/bigintIsh'
import { ethers } from 'ethers'
import { RPCTickDataProvider } from './rpcTickDataProvider'
import poolAbi from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import factoryAbi from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'

interface StepComputations {
  sqrtPriceStartX96: bigint
  tickNext: number
  initialized: boolean
  sqrtPriceNextX96: bigint
  amountIn: bigint
  amountOut: bigint
  feeAmount: bigint
}

interface SnapshotCumulativeInside {
  tickCumulativeInside: bigint
  secondsPerLiquidityInsideX128: bigint
  secondsInside: bigint
}

interface ObserveResponse {
  tickCumulatives: bigint[]
  secondsPerLiquidityCumulativeX128s: bigint[]
}

export interface TransactionOverrides {
  gasPrice?: BigInt
  gasLimit?: BigInt
  value?: BigInt
  nonce?: BigInt
}

interface Slot0Response {
  sqrtPriceX96: BigInt
  tick: number
  observationIndex: number
  observationCardinality: number
  observationCardinalityNext: number
  feeProtocol: number
  unlocked: boolean
}

/**
 * By default, pools will not allow operations that require ticks.
 */
const NO_TICK_DATA_PROVIDER_DEFAULT = new NoTickDataProvider()

/**
 * Represents a V3 pool
 */
export class Pool {
  public readonly token0: Token
  public readonly token1: Token
  public readonly fee: FeeAmount
  public get sqrtRatioX96(): JSBI {
    return JSBI.BigInt(this._sqrtRatioX96.toString(10))
  }
  public readonly _sqrtRatioX96: bigint
  public get liquidity(): JSBI {
    return JSBI.BigInt(this._liquidity.toString(10))
  }
  public readonly _liquidity: bigint
  public readonly tickCurrent: number
  public get tickDataProvider(): TickDataProvider {
    return this._tickDataProvider
  }
  private _tickDataProvider: TickDataProvider

  private _token0Price?: Price<Token, Token>
  private _token1Price?: Price<Token, Token>

  public readonly _provider?: ethers.providers.Provider

  public static getAddress(
    tokenA: Token,
    tokenB: Token,
    fee: FeeAmount,
    initCodeHashManualOverride?: string,
    factoryAddressOverride?: string
  ): string {
    return computePoolAddress({
      factoryAddress: factoryAddressOverride ?? FACTORY_ADDRESS,
      fee,
      tokenA,
      tokenB,
      initCodeHashManualOverride,
    })
  }

  /**
   * Initialize a pool from the latest chain data.
   *
   * @param provider The provider to fetch data from.
   * @param tokenA First token address of the pool
   * @param tokenB Second token address of the pool
   * @param fee The fee of the pool to fetch
   * @param poolAddress The pool address, optional, will be calculated if not given
   * @param initCodeHashManualOverride Init code hash override for pool address calculation. Used if pool address not given.
   * @param factoryAddressOverride Factory address override for pool address calculation. Used if pool address not given.
   * @returns The initialized Pool instance.
   */
  public static async initFromChain(
    provider: ethers.providers.Provider,
    tokenA: Token,
    tokenB: Token,
    fee: FeeAmount,
    poolAddress?: string,
    initCodeHashManualOverride?: string,
    factoryAddressOverride?: string
  ): Promise<Pool> {
    const contract = new ethers.Contract(
      poolAddress || Pool.getAddress(tokenA, tokenB, fee, initCodeHashManualOverride, factoryAddressOverride),
      poolAbi.abi,
      provider
    )
    const slot0 = await contract.slot0()
    const sqrtRatioX96 = slot0.sqrtPriceX96
    const tickCurrent = slot0.tick
    const liquidity = await contract.liquidity()

    return new Pool(tokenA, tokenB, fee, sqrtRatioX96, liquidity, tickCurrent, undefined, provider)
  }

  /**
   * Construct a pool
   * @param tokenA One of the tokens in the pool
   * @param tokenB The other token in the pool
   * @param fee The fee in hundredths of a bips of the input amount of every swap that is collected by the pool
   * @param sqrtRatioX96 The sqrt of the current ratio of amounts of token1 to token0
   * @param liquidity The current value of in range liquidity
   * @param tickCurrent The current tick of the pool
   * @param ticks The current state of the pool ticks or a data provider that can return tick data
   */
  public constructor(
    tokenA: Token,
    tokenB: Token,
    fee: FeeAmount,
    sqrtRatioX96: BigintIsh,
    liquidity: BigintIsh,
    tickCurrent: number,
    _ticks?: TickDataProvider | (Tick | TickConstructorArgs)[],
    provider?: ethers.providers.Provider
  ) {
    invariant(Number.isInteger(fee) && fee < 1_000_000, 'FEE')

    const ticks = _ticks || NO_TICK_DATA_PROVIDER_DEFAULT

    this._provider = provider

    const tickCurrentSqrtRatioX96 = TickMath.getSqrtRatioAtTickBigInt(tickCurrent)
    const nextTickSqrtRatioX96 = TickMath.getSqrtRatioAtTickBigInt(tickCurrent + 1)
    invariant(
      bigIntFromBigintIsh(sqrtRatioX96) >= tickCurrentSqrtRatioX96 &&
        bigIntFromBigintIsh(sqrtRatioX96) <= nextTickSqrtRatioX96,
      'PRICE_BOUNDS'
    )
    // always create a copy of the list since we want the pool's tick list to be immutable
    ;[this.token0, this.token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
    this.fee = fee
    this._sqrtRatioX96 = bigIntFromBigintIsh(sqrtRatioX96)
    this._liquidity = bigIntFromBigintIsh(liquidity)
    this.tickCurrent = tickCurrent
    this._tickDataProvider = Array.isArray(ticks) ? new TickListDataProvider(ticks, TICK_SPACINGS[fee]) : ticks
    if (this.tickDataProvider instanceof NoTickDataProvider && this._provider) {
      this._tickDataProvider = new RPCTickDataProvider(this._provider, Pool.getAddress(tokenA, tokenB, fee))
    }
  }

  /**
   * Returns true if the token is either token0 or token1
   * @param token The token to check
   * @returns True if token is either token0 or token
   */
  public involvesToken(token: Token): boolean {
    return token.equals(this.token0) || token.equals(this.token1)
  }

  /**
   * Returns the current mid price of the pool in terms of token0, i.e. the ratio of token1 over token0
   */
  public get token0Price(): Price<Token, Token> {
    return (
      this._token0Price ??
      (this._token0Price = new Price(this.token0, this.token1, Q192_BIGINT, this._sqrtRatioX96 * this._sqrtRatioX96))
    )
  }

  /**
   * Returns the current mid price of the pool in terms of token1, i.e. the ratio of token0 over token1
   */
  public get token1Price(): Price<Token, Token> {
    return (
      this._token1Price ??
      (this._token1Price = new Price(this.token1, this.token0, this._sqrtRatioX96 * this._sqrtRatioX96, Q192_BIGINT))
    )
  }

  /**
   * Return the price of the given token in terms of the other token in the pool.
   * @param token The token to return price of
   * @returns The price of the given token, in terms of the other.
   */
  public priceOf(token: Token): Price<Token, Token> {
    invariant(this.involvesToken(token), 'TOKEN')
    return token.equals(this.token0) ? this.token0Price : this.token1Price
  }

  /**
   * Returns the chain ID of the tokens in the pool.
   */
  public get chainId(): number {
    return this.token0.chainId
  }

  /**
   * Given an input amount of a token, return the computed output amount, and a pool with state updated after the trade
   * @param inputAmount The input amount for which to quote the output amount
   * @param sqrtPriceLimitX96 The Q64.96 sqrt price limit
   * @returns The output amount and the pool with updated state
   */
  public async getOutputAmount(
    inputAmount: CurrencyAmount<Token>,
    sqrtPriceLimitX96?: bigint | JSBI
  ): Promise<[CurrencyAmount<Token>, Pool]> {
    invariant(this.involvesToken(inputAmount.currency), 'TOKEN')

    const zeroForOne = inputAmount.currency.equals(this.token0)

    const {
      amountCalculated: outputAmount,
      sqrtRatioX96,
      liquidity,
      tickCurrent,
    } = await this.swap(zeroForOne, inputAmount.quotient, sqrtPriceLimitX96)
    const outputToken = zeroForOne ? this.token1 : this.token0

    const negation = BigInt(outputAmount.toString(10)) * -1n
    return [
      CurrencyAmount.fromRawAmount(outputToken, negation),
      new Pool(this.token0, this.token1, this.fee, sqrtRatioX96, liquidity, tickCurrent, this.tickDataProvider),
    ]
  }

  /**
   * Given a desired output amount of a token, return the computed input amount and a pool with state updated after the trade
   * @param outputAmount the output amount for which to quote the input amount
   * @param sqrtPriceLimitX96 The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap
   * @returns The input amount and the pool with updated state
   */
  public async getInputAmount(
    outputAmount: CurrencyAmount<Token>,
    sqrtPriceLimitX96?: bigint | JSBI
  ): Promise<[CurrencyAmount<Token>, Pool]> {
    invariant(outputAmount.currency.isToken && this.involvesToken(outputAmount.currency), 'TOKEN')

    const zeroForOne = outputAmount.currency.equals(this.token1)

    const {
      amountCalculated: inputAmount,
      sqrtRatioX96,
      liquidity,
      tickCurrent,
    } = await this.swap(zeroForOne, outputAmount.quotientBigInt * -1n, sqrtPriceLimitX96)
    const inputToken = zeroForOne ? this.token0 : this.token1
    return [
      CurrencyAmount.fromRawAmount(inputToken, inputAmount),
      new Pool(this.token0, this.token1, this.fee, sqrtRatioX96, liquidity, tickCurrent, this.tickDataProvider),
    ]
  }

  /**
   * Executes a swap
   * @param zeroForOne Whether the amount in is token0 or token1
   * @param amountSpecified The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative)
   * @param sqrtPriceLimitX96 The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap
   * @returns amountCalculated
   * @returns sqrtRatioX96
   * @returns liquidity
   * @returns tickCurrent
   */
  private async swap<T extends bigint | JSBI>(
    zeroForOne: boolean,
    _amountSpecified: T,
    _sqrtPriceLimitX96?: T
  ): Promise<{ amountCalculated: T; sqrtRatioX96: T; liquidity: T; tickCurrent: number }> {
    const amountSpecified = bigIntFromBigintIsh(_amountSpecified)
    const defaultSqrtPriceLimitX96 = zeroForOne
      ? TickMath.MIN_SQRT_RATIO_BIGINT + 1n
      : TickMath.MAX_SQRT_RATIO_BIGINT - 1n
    const sqrtPriceLimitX96 = _sqrtPriceLimitX96 ? bigIntFromBigintIsh(_sqrtPriceLimitX96) : defaultSqrtPriceLimitX96

    if (zeroForOne) {
      invariant(sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO_BIGINT, 'RATIO_MIN')
      invariant(sqrtPriceLimitX96 < this._sqrtRatioX96, 'RATIO_CURRENT')
    } else {
      invariant(sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO_BIGINT, 'RATIO_MAX')
      invariant(sqrtPriceLimitX96 > this._sqrtRatioX96, 'RATIO_CURRENT')
    }

    const exactInput = amountSpecified >= 0n

    // keep track of swap state

    const state = {
      amountSpecifiedRemaining: amountSpecified,
      amountCalculated: 0n,
      sqrtPriceX96: this._sqrtRatioX96,
      tick: this.tickCurrent,
      liquidity: this._liquidity,
    }

    // start swap while loop
    while (state.amountSpecifiedRemaining !== 0n && state.sqrtPriceX96 !== sqrtPriceLimitX96) {
      let step: Partial<StepComputations> = {}
      step.sqrtPriceStartX96 = state.sqrtPriceX96

      // because each iteration of the while loop rounds, we can't optimize this code (relative to the smart contract)
      // by simply traversing to the next available tick, we instead need to exactly replicate
      // tickBitmap.nextInitializedTickWithinOneWord
      ;[step.tickNext, step.initialized] = await this.tickDataProvider.nextInitializedTickWithinOneWord(
        state.tick,
        zeroForOne,
        this.tickSpacing
      )

      if (step.tickNext < TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK
      } else if (step.tickNext > TickMath.MAX_TICK) {
        step.tickNext = TickMath.MAX_TICK
      }

      step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTickBigInt(step.tickNext)
      ;[state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount] = SwapMath.computeSwapStep(
        state.sqrtPriceX96,
        (zeroForOne ? step.sqrtPriceNextX96 < sqrtPriceLimitX96 : step.sqrtPriceNextX96 > sqrtPriceLimitX96)
          ? sqrtPriceLimitX96
          : step.sqrtPriceNextX96,
        state.liquidity,
        state.amountSpecifiedRemaining,
        this.fee
      )

      if (exactInput) {
        state.amountSpecifiedRemaining = state.amountSpecifiedRemaining - (step.amountIn + step.feeAmount)
        state.amountCalculated = state.amountCalculated - step.amountOut
      } else {
        state.amountSpecifiedRemaining = state.amountSpecifiedRemaining + step.amountOut
        state.amountCalculated = state.amountCalculated + (step.amountIn + step.feeAmount)
      }

      // TODO
      if (state.sqrtPriceX96 === step.sqrtPriceNextX96) {
        // if the tick is initialized, run the tick transition
        if (step.initialized) {
          let liquidityNet = bigIntFromBigintIsh((await this.tickDataProvider.getTick(step.tickNext)).liquidityNet)
          // if we're moving leftward, we interpret liquidityNet as the opposite sign
          // safe because liquidityNet cannot be type(int128).min
          if (zeroForOne) liquidityNet = liquidityNet * -1n

          state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet)
        }

        state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext
      } else if (state.sqrtPriceX96 !== step.sqrtPriceStartX96) {
        // updated comparison function
        // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
        state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96)
      }
    }

    if (typeof _amountSpecified === 'bigint') {
      return {
        amountCalculated: state.amountCalculated as T,
        sqrtRatioX96: state.sqrtPriceX96 as T,
        liquidity: state.liquidity as T,
        tickCurrent: state.tick,
      }
    } else {
      return {
        amountCalculated: JSBI.BigInt(state.amountCalculated.toString(10)) as T,
        sqrtRatioX96: JSBI.BigInt(state.sqrtPriceX96.toString(10)) as T,
        liquidity: JSBI.BigInt(state.liquidity.toString(10)) as T,
        tickCurrent: state.tick,
      }
    }
  }

  public get tickSpacing(): number {
    return TICK_SPACINGS[this.fee]
  }

  // ---- RPC Functions - Fetch data from on-chain state ----

  public async initializeTicks(provider?: ethers.providers.Provider | undefined): Promise<void> {
    if (this.tickDataProvider instanceof NoTickDataProvider) {
      invariant(provider !== undefined, 'Pool has no RPC connection and no Provider was provided.')
      this._tickDataProvider = new RPCTickDataProvider(provider, Pool.getAddress(this.token0, this.token1, this.fee))
    }
    await this.initializeTicksFromRpc()
    // If the TickDataProvider is neither a NoTickDataProvider nor an RPCTickDataProvider ticks are present
  }

  public async initializeTicksFromRpc(): Promise<void> {
    invariant(!(this.tickDataProvider instanceof NoTickDataProvider), 'Pool has no RPC connection')
    if (this.tickDataProvider instanceof RPCTickDataProvider) {
      await this.tickDataProvider.rpcFetchTicks()
    }
    // If the TickDataProvider is neither a NoTickDataProvider nor an RPCTickDataProvider ticks are present
  }

  /**
   * Create a new Uniswap V3 pool with the given details (this will cost gas).
   *
   * @param _signer The wallet to use to sign the transaction.
   * @param provider The provider to use to propagate the transaction.
   * @param tokenA First token of the pool
   * @param tokenB Second token of the pool
   * @param fee The fee amount of the pool
   * @param transactionOverrides In case you want to override details of the transaction like gas, nonce, etc. optional.
   * @param factoryAddress The factory address to use. Only customize if you are using a fork. optional.
   * @returns The transaction response. You will still need to wait for tx inclusion.
   */
  public static async rpcCreatePool(
    _signer: ethers.Signer,
    provider: ethers.providers.Provider,
    tokenA: string,
    tokenB: string,
    fee: FeeAmount,
    transactionOverrides?: TransactionOverrides,
    factoryAddress?: string
  ): Promise<ethers.providers.TransactionResponse> {
    const signer = _signer.connect(provider)

    let factory: string
    if (factoryAddress) {
      factory = factoryAddress
    } else {
      const network = await provider.getNetwork()
      factory = V3_CORE_FACTORY_ADDRESSES[network.chainId]
    }

    const contract = new ethers.Contract(factory, factoryAbi.abi, signer)

    const response = contract.createPool(tokenA, tokenB, fee, Pool.ethersTransactionOverrides(transactionOverrides))

    return response
  }

  public static ethersTransactionOverrides(transactionOverrides?: TransactionOverrides): any {
    return {
      gasPrice: transactionOverrides?.gasPrice
        ? ethers.BigNumber.from(transactionOverrides.gasPrice.toString(10))
        : undefined,
      gasLimit: transactionOverrides?.gasLimit
        ? ethers.BigNumber.from(transactionOverrides.gasLimit.toString(10))
        : undefined,
      value: transactionOverrides?.value ? ethers.BigNumber.from(transactionOverrides.value.toString(10)) : undefined,
      nonce: transactionOverrides?.nonce ? ethers.BigNumber.from(transactionOverrides.nonce.toString(10)) : undefined,
    }
  }

  public async rpcContract(poolAddress?: string, signer?: ethers.Signer): Promise<ethers.Contract> {
    invariant(this._provider, 'provider not initialized')

    const provider = signer ? signer.connect(this._provider) : this._provider
    return new ethers.Contract(
      poolAddress || Pool.getAddress(this.token0, this.token1, this.fee),
      poolAbi.abi,
      provider
    )
  }

  /**
   * Returns whether this pool exists on-chain.
   * @param poolAddress The address to check. optional.
   * @param blockNum The block number at which to check. Latest is assumed.
   * @returns true if the pool exists on-chain. false otherwise.
   */
  public async rpcPoolExists(poolAddress?: string, blockNum?: number): Promise<boolean> {
    try {
      await this.rpcSlot0(poolAddress, blockNum)
      return true
    } catch {
      return false
    }
  }

  /**
   * Returns the slot0 value of the pool from on-chain data.
   *
   * @param poolAddress Optional. The pool address.
   * @param blockNum Optional. The block number at which to fetch slot0. Latest is assumed.
   * @returns Slot0Response.
   */
  public async rpcSlot0(poolAddress?: string, blockNum?: number): Promise<Slot0Response> {
    invariant(this._provider, 'provider not initialized')

    const contract = await this.rpcContract(poolAddress)

    const response = await contract.slot0({ blockTag: blockNum || 'latest' })

    return {
      sqrtPriceX96: BigInt(response.sqrtPriceX96.toString()),
      tick: response.tick as number,
      observationIndex: response.observationIndex as number,
      observationCardinality: response.observationCardinality as number,
      observationCardinalityNext: response.observationCardinalityNext as number,
      feeProtocol: response.feeProtocol as number,
      unlocked: response.unlocked as boolean,
    }
  }

  /**
   * Returns the snapshot cumulative inside the pool from on-chain data.
   *
   * @param tickLower The lower tick to include into the range
   * @param tickUpper The upper tick to include into the range
   * @param poolAddress The pool address. optional.
   * @param blockNum The block number at which to fetch. optional. Latest is assumed.
   * @returns SnapshotCumulativeInside values.
   */
  public async rpcSnapshotCumulativesInside(
    tickLower: number,
    tickUpper: number,
    poolAddress?: string,
    blockNum?: number
  ): Promise<SnapshotCumulativeInside> {
    invariant(this._provider, 'provider not initialized')

    const contract = await this.rpcContract(poolAddress)

    const response = await contract.snapshotCumulativesInside(tickLower, tickUpper, { blockTag: blockNum || 'latest' })

    return {
      secondsInside: BigInt(response.secondsInside.toString()),
      secondsPerLiquidityInsideX128: BigInt(response.secondsPerLiquidityInsideX128.toString()),
      tickCumulativeInside: BigInt(response.tickCumulativeInside.toString()),
    }
  }

  /**
   * Observation responses of the pool oracle.
   *
   * @param secondsAgo Array of timings for the oracle values.
   * @param poolAddress The pool address. optional.
   * @param blockNum The block number to fetch. optional.
   * @returns ObserveResponse values.
   */
  public async rpcObserve(secondsAgo: number[], poolAddress?: string, blockNum?: number): Promise<ObserveResponse> {
    invariant(this._provider, 'provider not initialized')

    const contract = await this.rpcContract(poolAddress)

    const response = await contract.observe(secondsAgo, { blockTag: blockNum || 'latest' })

    return {
      secondsPerLiquidityCumulativeX128s: response.secondsPerLiquidityCumulativeX128s.map((num: any) =>
        BigInt(num.toString())
      ),
      tickCumulatives: response.tickCumulatives.map((num: any) => BigInt(num.toString())),
    }
  }

  /**
   * Increase the observation cardinality for this pool (this tx requires gas).
   *
   * @param signer The signer to use to sign the transaction.
   * @param observationCardinalityNext The next cardinality (you pay for).
   * @param poolAddress The pool address. optional.
   * @param transactionOverrides If you want to customize gas, nonce, etc. optional.
   * @returns The transaction response. You will still need to wait for tx inclusion.
   */
  public async rpcIncreaseObservationCardinalityNext(
    signer: ethers.Signer,
    observationCardinalityNext: number,
    poolAddress?: string,
    transactionOverrides?: TransactionOverrides
  ): Promise<ethers.providers.TransactionResponse> {
    invariant(this._provider, 'provider not initialized')

    const contract = await this.rpcContract(poolAddress, signer)

    const response = await contract.increaseObservationCardinalityNext(
      observationCardinalityNext,
      Pool.ethersTransactionOverrides(transactionOverrides)
    )

    return response
  }

  /**
   * Collects tokens owed to a position
   *
   * Does not recompute fees earned, which must be done either via mint or burn of any amount of liquidity.
   * Collect must be called by the position owner. To withdraw only token0 or only token1, amount0Requested or amount1Requested may be set to zero.
   * To withdraw all tokens owed, caller may pass any value greater than the actual tokens owed, e.g. type(uint128).max.
   * Tokens owed may be from accumulated swap fees or burned liquidity.
   *
   * This tx requires gas.
   *
   * @param signer The signer to use to sign the transaction.
   * @param recipient The recipient of the fees.
   * @param tickLower The lower tick of the position for which to collect fees
   * @param tickUpper The upper tick of the position for which to collect fees
   * @param amount0Requested How much token0 should be withdrawn from the fees owed
   * @param amount1Requested How much token1 should be withdrawn from the fees owed
   * @param poolAddress The pool address. optional.
   * @param transactionOverrides If you want to customize gas, nonce, etc. optional.
   * @returns The transaction response. You will still need to wait for tx inclusion.
   */
  public async rpcCollect(
    signer: ethers.Signer,
    recipient: string,
    tickLower: number,
    tickUpper: number,
    amount0Requested: BigInt,
    amount1Requested: BigInt,
    poolAddress?: string,
    transactionOverrides?: TransactionOverrides
  ): Promise<ethers.providers.TransactionResponse> {
    invariant(this._provider, 'provider not initialized')

    const contract = await this.rpcContract(poolAddress, signer)

    const response = await contract.collect(
      recipient,
      tickLower,
      tickUpper,
      amount0Requested,
      amount1Requested,
      Pool.ethersTransactionOverrides(transactionOverrides)
    )

    return response
  }

  /**
   * Burn liquidity from the sender and account tokens owed for the liquidity to the position.
   * This tx requires gas.
   *
   * @param signer The signer to use to sign the tx.
   * @param tickLower The lower tick of the position for which to burn liquidity
   * @param tickUpper The upper tick of the position for which to burn liquidity
   * @param amount How much liquidity to burn
   * @param poolAddress The pool address. optional.
   * @param transactionOverrides If you want to customize gas, nonce, etc. optional.
   * @returns The transaction response. You will still need to wait for tx inclusion.
   */
  public async rpcBurn(
    signer: ethers.Signer,
    tickLower: number,
    tickUpper: number,
    amount: BigInt,
    poolAddress?: string,
    transactionOverrides?: TransactionOverrides
  ): Promise<ethers.providers.TransactionResponse> {
    invariant(this._provider, 'provider not initialized')

    const contract = await this.rpcContract(poolAddress, signer)

    const response = await contract.burn(
      tickLower,
      tickUpper,
      amount,
      Pool.ethersTransactionOverrides(transactionOverrides)
    )

    return response
  }
}
