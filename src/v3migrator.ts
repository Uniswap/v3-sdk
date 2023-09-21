import { Percent, validateAndParseAddress, SUPPORTED_CHAINS, CHAIN_TO_ADDRESSES_MAP } from "@uniswap/sdk-core"
import { Pool } from "./entities/pool"
import { MethodParameters, toHex } from "./utils"
import { Provider } from '@ethersproject/abstract-provider'
import { Signer } from '@ethersproject/abstract-signer'
import { TransactionResponse } from '@ethersproject/providers'
import { Interface } from '@ethersproject/abi'
import IV3Migrator from '@uniswap/v3-periphery/artifacts/contracts/V3Migrator.sol/V3Migrator.json'
import invariant from "tiny-invariant"

/**
 * Parameters to create calldata for migrating liquidity from V2 to V3
 */
export interface MigrationParameters {
    /**
     * The address of the V2 Pair.
     */
    pairAddress: string

    /**
     * The Pool to which the liquidity will be migrated.
     */
    targetPool: Pool

    /**
     * The amount of V2 liquidity to migrate.
     */
    liquidityToMigrate: bigint

    /**
     * The percentage of the V2 liquidity to migrate to V3.
     * The rest of the liquidity is refunded to msg.sender.
     */
    percentageToMigrate: Percent

    /**
     * Lower Tick of the V3 Position to create.
     */
    tickLower: number

    /**
     * Upper Tick of the V3 Position to create.
     */
    tickUpper: number

    /**
     * Optional. Minimum Liquidity of token0 in V3 Position.
     */
    amount0Min: bigint | undefined

    /**
     * Optional. Minimum Liquidity of token1 in V3 Position.
     */
    amount1Min: bigint | undefined

    /**
     * Recipient of the V3 Position NFT that will be minted.
     */
    recipient: string

    /**
     * Epoch second time of when the transaction expires.
     */
    deadline: bigint

    /**
     * Wether to refund the unused V2 liquidity as ETH (true) or WETH (false).
     */
    refundAsEth: boolean | undefined
}

/**
 * Represents the Uniswap V3 Migrator Contract. Has static functions to help create/execute 'migrate' calls.
 */
export abstract class V3Migrator {
    public static INTERFACE: Interface = new Interface(IV3Migrator.abi)

    /**
     * Cannot be constructed
     */
    private constructor() { }

    /**
     * Produces on-chain calldata to call the migrate function
     * @param params MigrationParams that define the transaction
     * @returns MethodParameters that include the calldata and value for the transaction calling 'migrate'
     */
    public static migrateCallParameters(
        params: MigrationParameters
    ): MethodParameters {
        if (!params.refundAsEth) {
            params.refundAsEth = false
        }
        if (params.amount0Min === undefined) {
            params.amount0Min = 0n
        }
        if (params.amount1Min === undefined) {
            params.amount1Min = 0n
        }

        const calldata = this.INTERFACE.encodeFunctionData(
            'migrate',
            [{
                pair: validateAndParseAddress(params.pairAddress),
                liquidityToMigrate: params.liquidityToMigrate,
                percentageToMigrate: params.percentageToMigrate.quotientBigInt,
                token0: params.targetPool.token0.address,
                token1: params.targetPool.token1.address,
                fee: params.targetPool.fee,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min,
                recipient: validateAndParseAddress(params.recipient),
                deadline: params.deadline,
                refundAsETH: params.refundAsEth
            }]
        )
        return {
            calldata: calldata,
            value: toHex(0)
        }
    }

    /**
     * Calls the V3 Migrator contract 'migrate' function. Includes some sanity checks.
     * @param params MigrationParams that define the transaction parameters
     * @param provider to connect to the network
     * @param signer to sign the transaction
     * @returns Promise<TransactionResponse> TransactionResponse of the transaction.
     */
    public static async callMigrate(
        params: MigrationParameters,
        provider: Provider,
        signer: Signer
    ): Promise<TransactionResponse> {

        const chainId = params.targetPool.token0.chainId
        const chain = SUPPORTED_CHAINS[chainId]

        invariant(chain !== undefined, 'Unsupported Chain')

        const v3MigratorAddress = CHAIN_TO_ADDRESSES_MAP[chain].v3MigratorAddress

        invariant(v3MigratorAddress !== undefined, 'V3 Migrator not deployed on this network')

        let rpcPool: Pool
        if (params.targetPool._provider === undefined) {
            rpcPool = new Pool(
                params.targetPool.token0,
                params.targetPool.token1,
                params.targetPool.fee,
                params.targetPool.sqrtRatioX96,
                params.targetPool.liquidity,
                params.targetPool.tickCurrent,
                params.targetPool.tickDataProvider,
                provider
            )
        } else {
            rpcPool = params.targetPool
        }
        const poolExists = await rpcPool.rpcPoolExists()

        invariant(poolExists, "Target Pool is not deployed")

        const methodParameters = this.migrateCallParameters(params)

        if (signer.provider === undefined) {
            signer.connect(provider)
        }

        const tx = {
            data: methodParameters.calldata,
            to: v3MigratorAddress,
            value: methodParameters.value,
            from: await signer.getAddress()
        }

        return signer.sendTransaction(tx)
    }
}