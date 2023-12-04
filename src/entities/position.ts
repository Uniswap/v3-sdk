import {
  BigintIsh,
  Percent,
  Price,
  CurrencyAmount,
  Token,
  MaxUint256BigInt,
  NONFUNGIBLE_POSITION_MANAGER_ADDRESSES,
  Fraction,
} from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { ZERO } from '../internalConstants'
import { maxLiquidityForAmounts } from '../utils/maxLiquidityForAmounts'
import { tickToPrice } from '../utils/priceTickConversions'
import { SqrtPriceMath } from '../utils/sqrtPriceMath'
import { TickMath } from '../utils/tickMath'
import { encodeSqrtRatioX96BigInt } from '../utils/encodeSqrtRatioX96'
import { Pool, TransactionOverrides } from './pool'
import { ethers } from 'ethers'
import { abi as positionManagerAbi } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import { ERC20_ABI, FeeAmount } from '../constants'
import { bigIntFromBigintIsh } from 'src/utils/bigintIsh'
import { nearestUsableTick } from 'src/utils'
import { IncreaseOptions, NonfungiblePositionManager } from 'src/nonfungiblePositionManager'

interface PositionConstructorArgs {
  pool: Pool
  tickLower: number
  tickUpper: number
  liquidity: BigintIsh
  positionId?: BigintIsh
}

/**
 * Represents a position on a Uniswap V3 Pool
 */
export class Position {
  public readonly pool: Pool
  public readonly tickLower: number
  public readonly tickUpper: number
  public get liquidity(): JSBI {
    return JSBI.BigInt(this._liquidity.toString(10))
  }
  public readonly _liquidity: bigint

  public readonly positionId?: bigint

  // cached resuts for the getters
  private _token0Amount: CurrencyAmount<Token> | null = null
  private _token1Amount: CurrencyAmount<Token> | null = null
  private _mintAmounts: Readonly<{ amount0: bigint; amount1: bigint }> | null = null

  /**
   * Initializes the position from a given position id using on-chain data.
   *
   * @param provider The provider to use to fetch data.
   * @param positionId The position id to fetch.
   * @returns Instance of Position.
   */
  public static async fetchWithPositionId(
    provider: ethers.providers.Provider,
    positionId: BigintIsh
  ): Promise<Position> {
    const chainId = (await provider.getNetwork()).chainId

    const contract = new ethers.Contract(NONFUNGIBLE_POSITION_MANAGER_ADDRESSES[chainId], positionManagerAbi, provider)
    const position = await contract.positions(ethers.BigNumber.from(bigIntFromBigintIsh(positionId).toString(10)))

    const token0Contract = new ethers.Contract(position.token0, ERC20_ABI, provider)
    const token1Contract = new ethers.Contract(position.token1, ERC20_ABI, provider)

    return new Position({
      pool: await Pool.initFromChain(
        provider,
        new Token(chainId, position.token0, await token0Contract.decimals()),
        new Token(chainId, position.token1, token1Contract.decimals()),
        position.fee
      ),
      liquidity: position.liquidity,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      positionId: positionId,
    })
  }

  /**
   * Returns the number of positions the given address owns. Using this, position identifiers can be fetched.
   * A position can always be fetched with the combination of (address, index), so for an address with 3 positions,
   * there are positions on index 0, 1 and 2.
   *
   * Use `getPositionForAddressAndIndex` to fetch individual positions in a paginated manner.
   *
   * @param provider The provider to use for fetching the position count.
   * @param address The address to fetch position count for.
   * @returns The number of positions of the given address.
   */
  public static async getPositionCount(provider: ethers.providers.Provider, address: string): Promise<bigint> {
    const chainId = (await provider.getNetwork()).chainId

    const contract = new ethers.Contract(NONFUNGIBLE_POSITION_MANAGER_ADDRESSES[chainId], positionManagerAbi, provider)
    const balance = await contract.balanceOf(address)

    return BigInt(balance.toString(10))
  }

  /**
   * Returns the position of the given address at the given index.
   * You need to know the number of positions an address has first. You can use
   * `getPositionCount` for that.
   *
   * @param provider The provider to use to fetch the position.
   * @param address The address to fetch a position for.
   * @param index The index of the position for the given address to fetch.
   * @returns The initialized position.
   */
  public static async getPositionForAddressAndIndex(
    provider: ethers.providers.Provider,
    address: string,
    index: BigintIsh
  ): Promise<Position> {
    const chainId = (await provider.getNetwork()).chainId
    const contract = new ethers.Contract(NONFUNGIBLE_POSITION_MANAGER_ADDRESSES[chainId], positionManagerAbi, provider)

    const positionId = contract.tokenOfOwnerByIndex(
      address,
      ethers.BigNumber.from(bigIntFromBigintIsh(index).toString(10))
    )

    return await Position.fetchWithPositionId(provider, BigInt(positionId.toString(10)))
  }

  /**
   * WARNING: This is a potentially heavy call that takes up lots of RPC resources and can take many seconds
   * to resolve. This is the case if the address given has many positions (whether closed or open) on the network.
   * (e.g. thousands of positions are a real problem, but even 500 will take at least a few seconds).
   *
   * To create a paginated version of this, call `getPositionCount` and then `getPositionForAddressAndIndex` as many times
   * as you need to render your current page.
   *
   * Fetches all positions of the given address.
   *
   * @param provider The provider to use to fetch positions for.
   * @param address The address to fetch positions for.
   * @returns The initialized positions as an array.
   */
  public static async getAllPositionsForAddress(
    provider: ethers.providers.Provider,
    address: string
  ): Promise<Position[]> {
    const balance = await Position.getPositionCount(provider, address)

    const chainId = (await provider.getNetwork()).chainId
    const contract = new ethers.Contract(NONFUNGIBLE_POSITION_MANAGER_ADDRESSES[chainId], positionManagerAbi, provider)

    const positionIdsPromises = []
    for (let i = 0n; i < balance; i += 1n) {
      positionIdsPromises.push(contract.tokenOfOwnerByIndex(address, ethers.BigNumber.from(i.toString(10))))
    }
    const positionIds = (await Promise.all(positionIdsPromises)).map((id) => BigInt(id.toString(10)))

    return await Promise.all(positionIds.map((id) => Position.fetchWithPositionId(provider, id)))
  }

  /**
   * Constructs a position for a given pool with the given liquidity
   * @param pool For which pool the liquidity is assigned
   * @param liquidity The amount of liquidity that is in the position
   * @param tickLower The lower tick of the position
   * @param tickUpper The upper tick of the position
   * @param positionId (optional) The positionId of the existing position on-chain.
   */
  public constructor({ pool, liquidity, tickLower, tickUpper, positionId }: PositionConstructorArgs) {
    invariant(tickLower < tickUpper, 'TICK_ORDER')
    invariant(tickLower >= TickMath.MIN_TICK && tickLower % pool.tickSpacing === 0, 'TICK_LOWER')
    invariant(tickUpper <= TickMath.MAX_TICK && tickUpper % pool.tickSpacing === 0, 'TICK_UPPER')

    this.pool = pool
    this.tickLower = tickLower
    this.tickUpper = tickUpper
    if (typeof liquidity === 'bigint') {
      this._liquidity = BigInt(liquidity)
    } else {
      this._liquidity = BigInt(liquidity.toString(10))
    }

    this.positionId = positionId ? bigIntFromBigintIsh(positionId) : undefined
  }

  public static createWithAmounts(
    pool: Pool,
    token0Amount: CurrencyAmount<Token>,
    token1Amount: CurrencyAmount<Token>
  ): Position {
    return Position.fromAmounts({
      pool: pool,
      tickLower: nearestUsableTick(pool.tickCurrent, pool.tickSpacing) - pool.tickSpacing * 2,
      tickUpper: nearestUsableTick(pool.tickCurrent, pool.tickSpacing) + pool.tickSpacing * 2,
      amount0: token0Amount.quotient,
      amount1: token1Amount.quotient,
      useFullPrecision: true,
    })
  }

  public async increasePositionByPercentageOnChain(
    _signer: ethers.Signer,
    provider: ethers.providers.Provider,
    percentage: Fraction,
    options: IncreaseOptions,
    transactionOverrides?: TransactionOverrides
  ): Promise<ethers.providers.TransactionResponse> {
    const toBeIncreasedByPosition = Position.createWithAmounts(
      this.pool,
      this.amount0.multiply(percentage),
      this.amount1.multiply(percentage)
    )

    return NonfungiblePositionManager.increasePositionOnChain(
      _signer,
      provider,
      toBeIncreasedByPosition,
      options,
      transactionOverrides
    )
  }

  /**
   * Returns the price of token0 at the lower tick
   */
  public get token0PriceLower(): Price<Token, Token> {
    return tickToPrice(this.pool.token0, this.pool.token1, this.tickLower)
  }

  /**
   * Returns the price of token0 at the upper tick
   */
  public get token0PriceUpper(): Price<Token, Token> {
    return tickToPrice(this.pool.token0, this.pool.token1, this.tickUpper)
  }

  /**
   * Returns the amount of token0 that this position's liquidity could be burned for at the current pool price
   */
  public get amount0(): CurrencyAmount<Token> {
    if (this._token0Amount === null) {
      if (this.pool.tickCurrent < this.tickLower) {
        this._token0Amount = CurrencyAmount.fromRawAmount(
          this.pool.token0,
          SqrtPriceMath.getAmount0Delta(
            TickMath.getSqrtRatioAtTickBigInt(this.tickLower),
            TickMath.getSqrtRatioAtTickBigInt(this.tickUpper),
            this._liquidity,
            false
          )
        )
      } else if (this.pool.tickCurrent < this.tickUpper) {
        this._token0Amount = CurrencyAmount.fromRawAmount(
          this.pool.token0,
          SqrtPriceMath.getAmount0Delta(
            this.pool._sqrtRatioX96,
            TickMath.getSqrtRatioAtTickBigInt(this.tickUpper),
            this._liquidity,
            false
          )
        )
      } else {
        this._token0Amount = CurrencyAmount.fromRawAmount(this.pool.token0, ZERO)
      }
    }
    return this._token0Amount
  }

  /**
   * Returns the amount of token1 that this position's liquidity could be burned for at the current pool price
   */
  public get amount1(): CurrencyAmount<Token> {
    if (this._token1Amount === null) {
      if (this.pool.tickCurrent < this.tickLower) {
        this._token1Amount = CurrencyAmount.fromRawAmount(this.pool.token1, ZERO)
      } else if (this.pool.tickCurrent < this.tickUpper) {
        this._token1Amount = CurrencyAmount.fromRawAmount(
          this.pool.token1,
          SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTickBigInt(this.tickLower),
            this.pool._sqrtRatioX96,
            this._liquidity,
            false
          )
        )
      } else {
        this._token1Amount = CurrencyAmount.fromRawAmount(
          this.pool.token1,
          SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTickBigInt(this.tickLower),
            TickMath.getSqrtRatioAtTickBigInt(this.tickUpper),
            this._liquidity,
            false
          )
        )
      }
    }
    return this._token1Amount
  }

  /**
   * Returns the lower and upper sqrt ratios if the price 'slips' up to slippage tolerance percentage
   * @param slippageTolerance The amount by which the price can 'slip' before the transaction will revert
   * @returns The sqrt ratios after slippage
   */
  private ratiosAfterSlippage(slippageTolerance: Percent): {
    sqrtRatioX96Lower: bigint
    sqrtRatioX96Upper: bigint
  } {
    const priceLower = this.pool.token0Price.asFraction.multiply(new Percent(1).subtract(slippageTolerance))
    const priceUpper = this.pool.token0Price.asFraction.multiply(slippageTolerance.add(1))
    let sqrtRatioX96Lower = encodeSqrtRatioX96BigInt(priceLower._numerator, priceLower._denominator)
    if (sqrtRatioX96Lower <= TickMath.MIN_SQRT_RATIO_BIGINT) {
      sqrtRatioX96Lower = TickMath.MIN_SQRT_RATIO_BIGINT + 1n
    }
    let sqrtRatioX96Upper = encodeSqrtRatioX96BigInt(priceUpper._numerator, priceUpper._denominator)
    if (sqrtRatioX96Upper >= TickMath.MAX_SQRT_RATIO_BIGINT) {
      sqrtRatioX96Upper = TickMath.MAX_SQRT_RATIO_BIGINT - 1n
    }
    return {
      sqrtRatioX96Lower,
      sqrtRatioX96Upper,
    }
  }

  /**
   * Returns the minimum amounts that must be sent in order to safely mint the amount of liquidity held by the position
   * with the given slippage tolerance
   * @param slippageTolerance Tolerance of unfavorable slippage from the current price
   * @returns The amounts, with slippage
   */
  public mintAmountsWithSlippageBigInt(slippageTolerance: Percent): Readonly<{ amount0: bigint; amount1: bigint }> {
    // get lower/upper prices
    const { sqrtRatioX96Upper, sqrtRatioX96Lower } = this.ratiosAfterSlippage(slippageTolerance)

    // construct counterfactual pools
    const poolLower = new Pool(
      this.pool.token0,
      this.pool.token1,
      this.pool.fee,
      sqrtRatioX96Lower,
      0 /* liquidity doesn't matter */,
      TickMath.getTickAtSqrtRatio(sqrtRatioX96Lower)
    )
    const poolUpper = new Pool(
      this.pool.token0,
      this.pool.token1,
      this.pool.fee,
      sqrtRatioX96Upper,
      0 /* liquidity doesn't matter */,
      TickMath.getTickAtSqrtRatio(sqrtRatioX96Upper)
    )

    // because the router is imprecise, we need to calculate the position that will be created (assuming no slippage)
    const positionThatWillBeCreated = Position.fromAmounts({
      pool: this.pool,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper,
      ...this.mintAmountsBigInt, // the mint amounts are what will be passed as calldata
      useFullPrecision: false,
    })

    // we want the smaller amounts...
    // ...which occurs at the upper price for amount0...
    const { amount0 } = new Position({
      pool: poolUpper,
      liquidity: positionThatWillBeCreated.liquidity,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper,
    }).mintAmountsBigInt
    // ...and the lower for amount1
    const { amount1 } = new Position({
      pool: poolLower,
      liquidity: positionThatWillBeCreated.liquidity,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper,
    }).mintAmountsBigInt

    return { amount0, amount1 }
  }
  /**
   * Returns the minimum amounts that must be sent in order to safely mint the amount of liquidity held by the position
   * with the given slippage tolerance
   * @param slippageTolerance Tolerance of unfavorable slippage from the current price
   * @returns The amounts, with slippage
   */
  public mintAmountsWithSlippage(slippageTolerance: Percent): Readonly<{ amount0: JSBI; amount1: JSBI }> {
    const bigInts = this.mintAmountsWithSlippageBigInt(slippageTolerance)

    return {
      amount0: JSBI.BigInt(bigInts.amount0.toString(10)),
      amount1: JSBI.BigInt(bigInts.amount1.toString(10)),
    }
  }

  /**
   * Returns the minimum amounts that should be requested in order to safely burn the amount of liquidity held by the
   * position with the given slippage tolerance
   * @param slippageTolerance tolerance of unfavorable slippage from the current price
   * @returns The amounts, with slippage
   */
  public burnAmountsWithSlippageBigInt(slippageTolerance: Percent): Readonly<{ amount0: bigint; amount1: bigint }> {
    // get lower/upper prices
    const { sqrtRatioX96Upper, sqrtRatioX96Lower } = this.ratiosAfterSlippage(slippageTolerance)

    // construct counterfactual pools
    const poolLower = new Pool(
      this.pool.token0,
      this.pool.token1,
      this.pool.fee,
      sqrtRatioX96Lower,
      0 /* liquidity doesn't matter */,
      TickMath.getTickAtSqrtRatio(sqrtRatioX96Lower)
    )
    const poolUpper = new Pool(
      this.pool.token0,
      this.pool.token1,
      this.pool.fee,
      sqrtRatioX96Upper,
      0 /* liquidity doesn't matter */,
      TickMath.getTickAtSqrtRatio(sqrtRatioX96Upper)
    )

    // we want the smaller amounts...
    // ...which occurs at the upper price for amount0...
    const amount0 = new Position({
      pool: poolUpper,
      liquidity: this.liquidity,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper,
    }).amount0
    // ...and the lower for amount1
    const amount1 = new Position({
      pool: poolLower,
      liquidity: this.liquidity,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper,
    }).amount1

    return { amount0: amount0.quotientBigInt, amount1: amount1.quotientBigInt }
  }
  /**
   * Returns the minimum amounts that should be requested in order to safely burn the amount of liquidity held by the
   * position with the given slippage tolerance
   * @param slippageTolerance tolerance of unfavorable slippage from the current price
   * @returns The amounts, with slippage
   */
  public burnAmountsWithSlippage(slippageTolerance: Percent): Readonly<{ amount0: JSBI; amount1: JSBI }> {
    const bigInts = this.burnAmountsWithSlippageBigInt(slippageTolerance)

    return {
      amount0: JSBI.BigInt(bigInts.amount0.toString(10)),
      amount1: JSBI.BigInt(bigInts.amount1.toString(10)),
    }
  }

  /**
   * Returns the minimum amounts that must be sent in order to mint the amount of liquidity held by the position at
   * the current price for the pool
   */
  public get mintAmountsBigInt(): Readonly<{ amount0: bigint; amount1: bigint }> {
    if (this._mintAmounts === null) {
      if (this.pool.tickCurrent < this.tickLower) {
        return {
          amount0: SqrtPriceMath.getAmount0Delta(
            TickMath.getSqrtRatioAtTickBigInt(this.tickLower),
            TickMath.getSqrtRatioAtTickBigInt(this.tickUpper),
            this._liquidity,
            true
          ),
          amount1: 0n,
        }
      } else if (this.pool.tickCurrent < this.tickUpper) {
        return {
          amount0: SqrtPriceMath.getAmount0Delta(
            this.pool._sqrtRatioX96,
            TickMath.getSqrtRatioAtTickBigInt(this.tickUpper),
            this._liquidity,
            true
          ),
          amount1: SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTickBigInt(this.tickLower),
            this.pool._sqrtRatioX96,
            this._liquidity,
            true
          ),
        }
      } else {
        return {
          amount0: 0n,
          amount1: SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTickBigInt(this.tickLower),
            TickMath.getSqrtRatioAtTickBigInt(this.tickUpper),
            this._liquidity,
            true
          ),
        }
      }
    }
    return this._mintAmounts
  }
  /**
   * Returns the minimum amounts that must be sent in order to mint the amount of liquidity held by the position at
   * the current price for the pool
   */
  public get mintAmounts(): Readonly<{ amount0: JSBI; amount1: JSBI }> {
    const bigInts = this.mintAmountsBigInt

    return { amount0: JSBI.BigInt(bigInts.amount0.toString(10)), amount1: JSBI.BigInt(bigInts.amount1.toString(10)) }
  }

  /**
   * Computes the maximum amount of liquidity received for a given amount of token0, token1,
   * and the prices at the tick boundaries.
   * @param pool The pool for which the position should be created
   * @param tickLower The lower tick of the position
   * @param tickUpper The upper tick of the position
   * @param amount0 token0 amount
   * @param amount1 token1 amount
   * @param useFullPrecision If false, liquidity will be maximized according to what the router can calculate,
   * not what core can theoretically support
   * @returns The amount of liquidity for the position
   */
  public static fromAmounts({
    pool,
    tickLower,
    tickUpper,
    amount0,
    amount1,
    useFullPrecision,
  }: {
    pool: Pool
    tickLower: number
    tickUpper: number
    amount0: BigintIsh
    amount1: BigintIsh
    useFullPrecision: boolean
  }) {
    const sqrtRatioAX96 = TickMath.getSqrtRatioAtTickBigInt(tickLower)
    const sqrtRatioBX96 = TickMath.getSqrtRatioAtTickBigInt(tickUpper)
    return new Position({
      pool,
      tickLower,
      tickUpper,
      liquidity: maxLiquidityForAmounts(
        pool._sqrtRatioX96,
        sqrtRatioAX96,
        sqrtRatioBX96,
        amount0,
        amount1,
        useFullPrecision
      ),
    })
  }

  /**
   * Computes a position with the maximum amount of liquidity received for a given amount of token0, assuming an unlimited amount of token1
   * @param pool The pool for which the position is created
   * @param tickLower The lower tick
   * @param tickUpper The upper tick
   * @param amount0 The desired amount of token0
   * @param useFullPrecision If true, liquidity will be maximized according to what the router can calculate,
   * not what core can theoretically support
   * @returns The position
   */
  public static fromAmount0({
    pool,
    tickLower,
    tickUpper,
    amount0,
    useFullPrecision,
  }: {
    pool: Pool
    tickLower: number
    tickUpper: number
    amount0: BigintIsh
    useFullPrecision: boolean
  }) {
    return Position.fromAmounts({ pool, tickLower, tickUpper, amount0, amount1: MaxUint256BigInt, useFullPrecision })
  }

  /**
   * Computes a position with the maximum amount of liquidity received for a given amount of token1, assuming an unlimited amount of token0
   * @param pool The pool for which the position is created
   * @param tickLower The lower tick
   * @param tickUpper The upper tick
   * @param amount1 The desired amount of token1
   * @returns The position
   */
  public static fromAmount1({
    pool,
    tickLower,
    tickUpper,
    amount1,
  }: {
    pool: Pool
    tickLower: number
    tickUpper: number
    amount1: BigintIsh
  }) {
    // this function always uses full precision,
    return Position.fromAmounts({
      pool,
      tickLower,
      tickUpper,
      amount0: MaxUint256BigInt,
      amount1,
      useFullPrecision: true,
    })
  }
}
