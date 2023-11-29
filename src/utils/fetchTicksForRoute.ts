import { Currency } from "@uniswap/sdk-core";
import { Route } from "../entities/route";
import { Provider } from '@ethersproject/abstract-provider';
import { NoTickDataProvider } from "../entities";
import invariant from 'tiny-invariant'

export async function fetchTickDataForAllPoolsInRoute<TInput extends Currency, TOutput extends Currency>(
    route: Route<TInput, TOutput>,
    provider?: Provider | undefined
): Promise<void> {

    if (!provider) {
        invariant(route.pools.every((pool) => 
        !(pool.tickDataProvider instanceof NoTickDataProvider)
        ))
    }

    let promises = []
    for (let pool of route.pools) {
        promises.push(pool.initializeTicks(provider))
    }
    await Promise.all(promises)
}