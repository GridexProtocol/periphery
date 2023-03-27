import {ethers} from "hardhat";
import {BigNumber, BigNumberish, utils} from "ethers";
import {PromiseOrValue} from "../../typechain-types/common";
import {expect} from "chai";
import {computeAddress} from "./GridAddress";
import {IGrid, IGridFactory, IMakerOrderManager} from "../../typechain-types";
import {ParamType} from "ethers/lib/utils";

enum Resolution {
    LOW = 1,
    MEDIUM = 5,
    HIGH = 30,
}

const RESOLUTION_X96 = 1n << 96n;
const MAX_UINT_128 = BigNumber.from(2).pow(128).sub(1);
const MIN_BOUNDARY = -527400;
const MAX_BOUNDARY = 443635;
const MIN_RATIO = 989314n;
const MAX_RATIO = 1461300573427867316570072651998408279850435624081n;

async function createGridAndInitialize(
    gridFactory: IGridFactory,
    makerOrderManager: IMakerOrderManager,
    tokenA: PromiseOrValue<string>,
    tokenB: PromiseOrValue<string>,
    resolution: PromiseOrValue<number>,
    priceX96: PromiseOrValue<BigNumberish>,
    isWeth?: boolean
): Promise<IGrid> {
    const [signer] = await ethers.getSigners();
    await makerOrderManager.createGridAndInitialize(
        {
            tokenA: tokenA,
            tokenB: tokenB,
            resolution: resolution,
            priceX96: priceX96,
            recipient: signer.address,
            orders0: [
                {
                    boundaryLower: 220020,
                    amount: 1n,
                },
            ],
            orders1: [
                {
                    boundaryLower: 220020,
                    amount: 1n,
                },
            ],
        },
        {
            value: isWeth ? 1n : 0n,
        }
    );
    const gridAddress = await gridFactory.grids(tokenA, tokenB, resolution);
    expect(gridAddress).to.equal(await computeAddress(gridFactory.address, tokenA, tokenB, resolution));
    const grid = (await ethers.getContractAt("IGrid", gridAddress)) as IGrid;
    await grid.settleMakerOrderAndCollectInBatch(signer.address, [1n, 2n], true);

    return grid;
}

export function encodePrice(reserve1: BigNumberish, reserve0: BigNumberish): BigNumber {
    return BigNumber.from(reserve1).shl(96).div(reserve0);
}

export function encodePriceWithBaseAndQuote(
    base: string,
    baseReserve1: BigNumberish,
    quote: string,
    quoteReserve0: BigNumberish
): BigNumber {
    const token0 = base.toLowerCase() < quote.toLowerCase() ? base : quote;
    if (token0 == base) {
        return encodePrice(quoteReserve0, baseReserve1);
    }
    return encodePrice(baseReserve1, quoteReserve0);
}

function position(boundary: number, resolution: number) {
    boundary = boundary / resolution;
    return [boundary >> 8, boundary % 256];
}

async function formatBoundaryToBoundaryLower(boundary: PromiseOrValue<number>, resolution: number): Promise<number> {
    const boundaryValue = await boundary;
    const remainder = boundaryValue % resolution;
    let boundaryLower = boundaryValue - remainder;
    boundaryLower = remainder >= 0 ? boundaryLower : boundaryLower - resolution;
    return boundaryLower;
}

export {
    RESOLUTION_X96,
    MAX_UINT_128,
    MIN_BOUNDARY,
    MAX_BOUNDARY,
    MIN_RATIO,
    MAX_RATIO,
    Resolution,
    createGridAndInitialize,
    position,
    formatBoundaryToBoundaryLower,
};
