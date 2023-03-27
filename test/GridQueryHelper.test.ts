import {deployERC20Tokens, deployGridFactory, deployMakerOrderManager, deployWETH} from "./shared/deployer";
import {Resolution, RESOLUTION_X96} from "./shared/util";
import {computeAddress} from "./shared/GridAddress";
import {ethers} from "hardhat";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "./shared/expect";

describe("GridQueryHelper", () => {
    async function deployFixture() {
        const weth = await deployWETH();
        const {gridFactory} = await deployGridFactory(weth.address);
        const makerOrderManager = await deployMakerOrderManager(gridFactory, weth);

        const tokens = await deployERC20Tokens();

        for (let token of tokens) {
            await token.approve(makerOrderManager.address, (1n << 256n) - 1n);
        }

        await gridFactory.createGrid(tokens[0].address, tokens[1].address, Resolution.MEDIUM);

        const address = await computeAddress(
            gridFactory.address,
            tokens[0].address,
            tokens[1].address,
            Resolution.MEDIUM
        );
        const grid = await ethers.getContractAt("IGrid", address);

        const contractFactory = await ethers.getContractFactory("GridQueryHelper");
        const gridQueryHelper = await contractFactory.deploy();
        return {
            gridFactory,
            makerOrderManager,
            tokens,
            grid,
            gridQueryHelper,
        };
    }
    describe("#makerBooks", () => {
        it("should return a empty array if no boundaries are provided", async () => {
            const {grid, gridQueryHelper} = await loadFixture(deployFixture);
            let result = await gridQueryHelper.makerBooks(grid.address, true, 1);
            expect(result.length).to.equal(0);

            result = await gridQueryHelper.makerBooks(grid.address, false, 1);
            expect(result.length).to.equal(0);
        });

        describe("zero is true", () => {
            it("should return the correct maker book", async () => {
                const {grid, gridQueryHelper, makerOrderManager, tokens} = await loadFixture(deployFixture);
                const [signer] = await ethers.getSigners();
                await makerOrderManager.initialize(
                    {
                        tokenA: tokens[0].address,
                        tokenB: tokens[1].address,
                        resolution: Resolution.MEDIUM,
                        priceX96: RESOLUTION_X96,
                        recipient: signer.address,
                        orders0: [
                            {
                                boundaryLower: 220000,
                                amount: 1n,
                            },
                        ],
                        orders1: [
                            {
                                boundaryLower: 220000,
                                amount: 1n,
                            },
                        ],
                    }
                );
                await grid.settleMakerOrderAndCollectInBatch(signer.address, [1n, 2n], true);

                await makerOrderManager.placeMakerOrderInBatch({
                    deadline: new Date().getTime(),
                    recipient: ethers.constants.AddressZero,
                    tokenA: tokens[0].address,
                    tokenB: tokens[1].address,
                    resolution: Resolution.MEDIUM,
                    zero: true,
                    orders: [
                        {
                            boundaryLower: -Resolution.MEDIUM,
                            amount: 10n ** 18n,
                        },
                        {
                            boundaryLower: 0,
                            amount: 11n ** 18n,
                        },
                        {
                            boundaryLower: Resolution.MEDIUM,
                            amount: 12n ** 18n,
                        },
                        {
                            boundaryLower: Resolution.MEDIUM * 2,
                            amount: 13n ** 18n,
                        },
                    ],
                });

                const results = await gridQueryHelper.makerBooks(grid.address, true, 4);
                expect(results.length).to.equal(3);
                expect(results[0].boundaryLower).to.equal(0);
                expect(results[0].makerAmountRemaining).to.equal(11n ** 18n);
                expect(results[1].boundaryLower).to.equal(Resolution.MEDIUM);
                expect(results[1].makerAmountRemaining).to.equal(12n ** 18n);
                expect(results[2].boundaryLower).to.equal(Resolution.MEDIUM * 2);
                expect(results[2].makerAmountRemaining).to.equal(13n ** 18n);
            });
        });

        describe("zero is false", () => {
            it("should return the correct maker book", async () => {
                const {grid, gridQueryHelper, makerOrderManager, tokens} = await loadFixture(deployFixture);
                const [signer] = await ethers.getSigners();
                await makerOrderManager.initialize(
                    {
                        tokenA: tokens[0].address,
                        tokenB: tokens[1].address,
                        resolution: Resolution.MEDIUM,
                        priceX96: RESOLUTION_X96,
                        recipient: signer.address,
                        orders0: [
                            {
                                boundaryLower: 220000,
                                amount: 1n,
                            },
                        ],
                        orders1: [
                            {
                                boundaryLower: 220000,
                                amount: 1n,
                            },
                        ],
                    }
                );
                await makerOrderManager.placeMakerOrderInBatch({
                    deadline: new Date().getTime(),
                    recipient: ethers.constants.AddressZero,
                    tokenA: tokens[0].address,
                    tokenB: tokens[1].address,
                    resolution: Resolution.MEDIUM,
                    zero: false,
                    orders: [
                        {
                            boundaryLower: -Resolution.MEDIUM,
                            amount: 10n ** 18n,
                        },
                        {
                            boundaryLower: 0,
                            amount: 11n ** 18n,
                        },
                        {
                            boundaryLower: Resolution.MEDIUM,
                            amount: 12n ** 18n,
                        },
                        {
                            boundaryLower: Resolution.MEDIUM * 2,
                            amount: 13n ** 18n,
                        },
                    ],
                });
                await grid.settleMakerOrderAndCollectInBatch(signer.address, [1n, 2n], true);

                const results = await gridQueryHelper.makerBooks(grid.address, false, 4);
                expect(results.length).to.equal(1);
                expect(results[0].boundaryLower).to.equal(-Resolution.MEDIUM);
                expect(results[0].makerAmountRemaining).to.equal(10n ** 18n);
            });
        });

        it("should return the correct maker book", async () => {
            const {grid, gridQueryHelper, makerOrderManager, tokens} = await loadFixture(deployFixture);
            const [signer] = await ethers.getSigners();
            await makerOrderManager.initialize(
                {
                    tokenA: tokens[0].address,
                    tokenB: tokens[1].address,
                    resolution: Resolution.MEDIUM,
                    priceX96: RESOLUTION_X96,
                    recipient: signer.address,
                    orders0: [
                        {
                            boundaryLower: 220000,
                            amount: 1n,
                        },
                    ],
                    orders1: [
                        {
                            boundaryLower: 220000,
                            amount: 1n,
                        },
                    ],
                }
            );
            await grid.settleMakerOrderAndCollectInBatch(signer.address, [1n, 2n], true);
            await makerOrderManager.placeMakerOrderInBatch({
                deadline: new Date().getTime(),
                recipient: ethers.constants.AddressZero,
                tokenA: tokens[0].address,
                tokenB: tokens[1].address,
                resolution: Resolution.MEDIUM,
                zero: false,
                orders: [
                    {
                        boundaryLower: -Resolution.MEDIUM,
                        amount: 10n ** 18n,
                    },
                    {
                        boundaryLower: 0,
                        amount: 11n ** 18n,
                    },
                    {
                        boundaryLower: Resolution.MEDIUM,
                        amount: 12n ** 18n,
                    },
                    {
                        boundaryLower: Resolution.MEDIUM * 2,
                        amount: 13n ** 18n,
                    },
                ],
            });
            await makerOrderManager.placeMakerOrderInBatch({
                deadline: new Date().getTime(),
                recipient: ethers.constants.AddressZero,
                tokenA: tokens[0].address,
                tokenB: tokens[1].address,
                resolution: Resolution.MEDIUM,
                zero: true,
                orders: [
                    {
                        boundaryLower: -Resolution.MEDIUM,
                        amount: 10n ** 18n,
                    },
                    {
                        boundaryLower: 0,
                        amount: 11n ** 18n,
                    },
                    {
                        boundaryLower: Resolution.MEDIUM,
                        amount: 12n ** 18n,
                    },
                    {
                        boundaryLower: Resolution.MEDIUM * 2,
                        amount: 13n ** 18n,
                    },
                ],
            });

            const results = await gridQueryHelper.makerBooks(grid.address, true, 2);
            expect(results.length).to.equal(2);
            expect(results[0].boundaryLower).to.equal(0);
            expect(results[0].makerAmountRemaining).to.equal(11n ** 18n);
            expect(results[1].boundaryLower).to.equal(Resolution.MEDIUM);
            expect(results[1].makerAmountRemaining).to.equal(12n ** 18n);
        });
    });
});
