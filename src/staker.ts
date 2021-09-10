import { BigintIsh, Token, validateAndParseAddress } from '@uniswap/sdk-core'
import { ethers } from 'ethers'
import { MethodParameters, toHex } from './utils/calldata'
import { Interface } from '@ethersproject/abi'
import { abi } from '@uniswap/v3-staker/artifacts/contracts/UniswapV3Staker.sol/UniswapV3Staker.json'
import { Pool } from './entities'

export type FullWithdrawOptions = ClaimOptions & WithdrawOptions
/**
 * Represents a unique staking program.
 */
export interface IncentiveKey {
  /**
   * The token rewarded for participating in the staking program.
   */
  rewardToken: Token
  /**
   * The pool that the staked positions must provide in.
   */
  pool: Pool
  /**
   * The time when the incentive program begins.
   */
  startTime: BigintIsh
  /**
   * The time that the incentive program ends.
   */
  endTime: BigintIsh
  /**
   * The address which receives any remaining reward tokens at `endTime`.
   */
  refundee: string
}

/**
 * Options to specify when claiming rewards.
 */
export interface ClaimOptions {
  /**
   * The id of the NFT
   */
  tokenId: BigintIsh

  /**
   * Address to send rewards to.
   */
  recipient: string

  /**
   * The amount of `rewardToken` to claim. 0 claims all.
   */
  amount: BigintIsh
}

/**
 * Options to specify when withdrawing a position.
 */
export interface WithdrawOptions {
  /**
   * Set when withdrawing. The position will be sent to `owner` on withdraw.
   */
  owner: string

  /**
   * Set when withdrawing. `data` is passed to `safeTransferFrom` when transferring the position from contract back to owner.
   */
  data: string
}

export abstract class Staker {
  public static INTERFACE: Interface = new Interface(abi)

  protected constructor() {}
  private static INCENTIVE_KEY_ABI =
    'tuple(address rewardToken, address pool, uint256 startTime, uint256 endTime, address refundee)'

  /**
   *  To claim rewards, must unstake and then claim.
   * @param incentiveKey The unique identifier of a staking program.
   * @param options Options for producing the calldata to claim. Can't claim unless you unstake.
   * @returns The calldatas for 'unstakeToken' and 'claimReward'.
   */
  private static encodeClaim(incentiveKey: IncentiveKey, options: ClaimOptions): string[] {
    const calldatas: string[] = []
    calldatas.push(
      Staker.INTERFACE.encodeFunctionData('unstakeToken', [
          this._encodeIncentiveKey(incentiveKey),
          toHex(options.tokenId)
      ])
    )
    const recipient: string = validateAndParseAddress(options.recipient)
    calldatas.push(
      Staker.INTERFACE.encodeFunctionData('claimReward', [
        incentiveKey.rewardToken.address,
        recipient,
        toHex(options.amount)
      ])
    )
    return calldatas
  }

  /**
   * Only claims rewards. Must unstake, claim, and then restake.
   */
  public static collectRewards(incentiveKey: IncentiveKey, options: ClaimOptions): MethodParameters {
    const calldatas = this.encodeClaim(incentiveKey, options)
    calldatas.push(
      Staker.INTERFACE.encodeFunctionData('stakeToken', [
          this._encodeIncentiveKey(incentiveKey),
          toHex(options.tokenId)
      ])
    )
    return {
      calldata: Staker.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value: toHex(0)
    }
  }

  /**
   *
   * @param incentiveKeys A list of incentiveKeys to unstake from. Should include all incentiveKeys (unique staking programs) that `options.tokenId` is staked in.
   * @param withdrawOptions Options for producing claim calldata and withdraw calldata. Can't withdraw without unstaking all programs for `tokenId`.
   * @returns Calldata for unstaking, claiming, and withdrawing.
   */
  public static withdrawToken(incentiveKeys: IncentiveKey | IncentiveKey[], withdrawOptions: FullWithdrawOptions): MethodParameters {
    let calldatas: string[] = []

    incentiveKeys = (incentiveKeys instanceof Array) ? incentiveKeys : [incentiveKeys]
    
    const claimOptions = {
      tokenId: withdrawOptions.tokenId,
      recipient: withdrawOptions.recipient,
      amount: withdrawOptions.amount 
    }

    for (let i = 0; i < incentiveKeys.length; i ++) {
      const incentiveKey = incentiveKeys[i];
      calldatas = calldatas.concat(this.encodeClaim(incentiveKey, claimOptions));
    }
    if (withdrawOptions.owner) {
      const owner = validateAndParseAddress(withdrawOptions.owner)
      calldatas.push(
        Staker.INTERFACE.encodeFunctionData('withdrawToken', [
            toHex(withdrawOptions.tokenId),
            owner,
            withdrawOptions.data
        ])
      )
    }
    return {
      calldata: Staker.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value: toHex(0)
    }
  }

  /**
   *
   * @param incentiveKeys A single IncentiveKey or array of IncentiveKeys to be encoded and used in the data parameter in `safeTransferFrom`
   * @returns An IncentiveKey as a string
   */
  public static encodeDeposit(incentiveKeys: IncentiveKey | IncentiveKey[]): string {
    incentiveKeys = incentiveKeys instanceof Array ? incentiveKeys : [incentiveKeys]
    let data: string

    if (incentiveKeys.length > 1) {
      const keys = []
      for (let i = 0; i < incentiveKeys.length; i++) {
        const incentiveKey = incentiveKeys[i]
        keys.push(this._encodeIncentiveKey(incentiveKey))
      }
      data = ethers.utils.defaultAbiCoder.encode([`${Staker.INCENTIVE_KEY_ABI}[]`], [keys])
    } else {
      data = ethers.utils.defaultAbiCoder.encode([Staker.INCENTIVE_KEY_ABI], [this._encodeIncentiveKey(incentiveKeys[0])])
    }
    return data
  }
  /**
   *
   * @param incentiveKey An `IncentiveKey` which represents a unique staking program.
   * @returns An encoded IncentiveKey to be read by ethers
   */
  private static _encodeIncentiveKey(incentiveKey: IncentiveKey): {} {
    const pool = incentiveKey.pool
    const refundee = validateAndParseAddress(incentiveKey.refundee)
    return {
      rewardToken: incentiveKey.rewardToken.address,
      pool: Pool.getAddress(pool.token0, pool.token1, pool.fee),
      startTime: toHex(incentiveKey.startTime),
      endTime: toHex(incentiveKey.endTime),
      refundee: refundee
    }
  }
}
