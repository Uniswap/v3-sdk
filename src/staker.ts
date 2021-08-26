import { BigintIsh, Token, validateAndParseAddress } from '@uniswap/sdk-core'
import { MethodParameters } from './utils/calldata'
import { Interface } from '@ethersproject/abi'
import { abi } from '@uniswap/v3-staker/artifacts/contracts/IUniswapV3Staker.sol/IUniswapV3Staker.json'
import { Pool } from './entities'

/**
 * Represents a unisque staking program.
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
  amount?: BigintIsh

  /**
   * Set when withdrawing. The position will be sent to `owner` on withdraw.
   */
  owner?: string

  /**
   * Set when withdrawing. `data` is passed to `safeTransferFrom` when transferring the position from contract back to owner.
   */
  data?: string
}

export abstract class Staker {
  public static INTERFACE: Interface = new Interface(abi)

  protected constructor() {}

  /**
   *  To claim rewards, must unstake and then claim.
   * @param incentiveKey The unique identifier of a staking program.
   * @param options Options for producing the calldata to claim. Can't claim unlesss you unstake.
   * @returns The calldatas for 'unstakeToken' and 'claimReward'.
   */
  private static encodeClaim(incentiveKey: IncentiveKey, options: ClaimOptions): string[] {
    const calldatas: string[] = []
    calldatas.push(
      Staker.INTERFACE.encodeFunctionData('unstakeToken', [
        {
          key: incentiveKey,
          tokenId: options.tokenId
        }
      ])
    )
    const recipient: string = validateAndParseAddress(options.recipient)
    calldatas.push(
      Staker.INTERFACE.encodeFunctionData('claimReward', [
        {
          rewardToken: incentiveKey.rewardToken,
          to: recipient,
          amountRequested: options.amount
        }
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
        {
          key: incentiveKey,
          tokenId: options.tokenId
        }
      ])
    )
    return {
      calldata: Staker.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value: '0x'
    }
  }

  /**
   * Creates claim and unstake calldata. Option to withdraw token.
   * Note: Only really makes sense to either claim and continue staking or claim and withdraw.
   * Note:
   */
  /**
   *
   * @param incentiveKeys A list of incentiveKeys to unstake from. Should include all incentiveKeys (unique staking programs) that `options.tokenId` is staked in.
   * @param options Options for producing collect/claim calldata. Can't withdraw without unstaking all programs for `tokenId`.
   * @returns Calldata for unstaking, claiming, and withdrawing.
   */
  public static withdrawToken(incentiveKeys: IncentiveKey[], options: ClaimOptions): MethodParameters {
    const calldatas: string[] = []
    for (let i = 0; i < incentiveKeys.length; i++) {
      const incentiveKey = incentiveKeys[i]
      calldatas.concat(this.encodeClaim(incentiveKey, options))
    }
    if (options.owner) {
      calldatas.push(
        Staker.INTERFACE.encodeFunctionData('withdrawToken', [
          {
            tokenId: options.tokenId,
            to: options.owner,
            data: options.data
          }
        ])
      )
    }
    return {
      calldata: Staker.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value: '0x'
    }
  }
}
