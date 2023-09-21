import { Percent, validateAndParseAddress, SUPPORTED_CHAINS, CHAIN_TO_ADDRESSES_MAP } from "@uniswap/sdk-core"
import { Pool } from "./entities/pool"
import { MethodParameters, toHex } from "./utils"
import { Provider } from '@ethersproject/abstract-provider'
import { Signer } from '@ethersproject/abstract-signer'
import { TransactionResponse } from '@ethersproject/providers'
import { Interface } from '@ethersproject/abi'
import IV3Migrator from '@uniswap/v3-periphery/artifacts/contracts/V3Migrator.sol/V3Migrator.json'
import invariant from "tiny-invariant"

export interface MigrationParameters {
    pairAddress: string
    targetPool: Pool
    liquidityToMigrate: bigint
    percentageToMigrate: Percent
    tickLower: number
    tickUpper: number
    amount0Min: bigint | undefined
    amount1Min: bigint | undefined
    recipient: string
    deadline: bigint,
    refundAsEth: boolean | undefined
}

export abstract class V3Migrator {
    public static INTERFACE: Interface = new Interface(IV3Migrator.abi)

    private constructor() { }

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