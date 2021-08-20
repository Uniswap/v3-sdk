import { BigintIsh, Token, validateAndParseAddress } from '@uniswap/sdk-core'
import { MethodParameters, toHex } from './utils/calldata'
import { Interface } from '@ethersproject/abi'
import { abi } from '@uniswap/v3-staker/artifacts/contracts/UniswapV3Staker.sol/UniswapV3Staker.json'
import { Pool } from './entities'

/**
 * Represents a unisque staking program.
 */
export interface IncentiveKey {
  /**
   * The token awarded in the program.
   */
  token: Token
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
   * The token rewarded for participating in the staking program.
   */
  rewardToken: string

  /**
   * Address to send rewards to.
   */
  recipient: string

  /**
   * The amount of `rewardToken` to claim.
   */
  amount: BigintIsh

  /**
   * The amount of `rewardToken` to claim.
   */
  withdraw?: boolean

  /**
   * The owner of the position.
   */
  owner?: string

  /**
   * Optional parameter passed to the callback `onERC721Received`.
   */
  data?: string
}

export abstract class Staker {
  public static INTERFACE: Interface = new Interface(abi)

  protected constructor() {}

  /** To claim rewards, must unstake and then claim. */
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
          rewardToken: options.rewardToken,
          to: recipient,
          amountRequested: options.amount
        }
      ])
    )
    return calldatas
  }

  /** Only claims rewards.
   * Must unstake, claim, and then restake.
   */
  public static claimCallParameters(incentiveKey: IncentiveKey, options: ClaimOptions): MethodParameters {
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
      value: toHex(0)
    }
  }

  /**
   * Creates claim and unstake calldata. Option to withdraw token.
   * Note: Only really makes sense to either claim and continue staking or claim and withdraw.
   */
  public static unstakeAndClaimCallParameters(incentiveKey: IncentiveKey, options: ClaimOptions): MethodParameters {
    const calldatas = this.encodeClaim(incentiveKey, options)
    if (options.withdraw && options.owner) {
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
      value: toHex(0)
    }
  }
}
