import { Signer } from '@ethersproject/abstract-signer'
import { Provider } from '@ethersproject/abstract-provider'
import { Contract } from '@ethersproject/contracts'
import { BigintIsh } from '@uniswap/sdk-core'
import { ERC20_ABI } from '../constants'
import { BigNumber } from 'ethers'

/**
 * Approves an address to transfer ERC20 Tokens on behalf of a Signer
 * @param contractAddress The address that is approved to transfer Tokens on behalf of a Signer
 * @param tokenAddress The address of the ERC20 token that approves the transfer
 * @param amount The amount of the Token to be approved for transfer
 * @param signer The signer that approves the transfer on his behalf
 */
export async function approveTokenTransfer(
    contractAddress: string,
    tokenAddress: string,
    amount: BigintIsh,
    signer: Signer
): Promise<void> {
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer)
   
    if (typeof amount !== "string") {
        if (BigNumber.isBigNumber(amount)) {
            amount = amount.toString()
        } else {
            amount = amount.toString(10)
        }
    }
    await tokenContract["approve"](contractAddress, amount)
}

/**
 * Fetches the transfer allowance of a contract for a signer on an ERC20 token
 * @param {string} contractAddress The address that wants to transfer tokens on behalf of a signer
 * @param {string} tokenAddress The address of the ERC20 token
 * @param {string} signerAddress The address of the signer that owns the tokens
 * @param {Provider} provider An RPC provider to make the request
 * @returns {Promise<bigint>} The transfer allowance of the contract
 */
export async function getAllowance(
    contractAddress: string,
    tokenAddress: string,
    signerAddress: string,
    provider: Provider
): Promise<bigint> {
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider)
    const allowance = await tokenContract["allowance"](signerAddress, contractAddress)
    return BigInt(allowance.toString(10))
}
