import "./shared/deployer";
import {deployERC20, deployGridFactory, deployMakerOrderManager, deploySwapRouter, deployWETH} from "./shared/deployer";
import {ERC20, IERC20, IGridFactory, IWETHMinimum, MakerOrderManager, SwapRouter} from "../typechain-types";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {BigNumber, constants, ContractTransaction, Wallet} from "ethers";
import {
    createGridAndInitialize,
    formatBoundaryToBoundaryLower,
    MAX_RATIO,
    MIN_RATIO,
    Resolution,
    RESOLUTION_X96,
} from "./shared/util";
import {expect} from "./shared/expect";
import {encodePath} from "./shared/path";
import {computeAddress, sortedToken} from "./shared/GridAddress";

describe("SwapRouter", function () {
    async function deployFixture() {
        const [maker, taker] = await (ethers as any).getSigners();
        const weth9 = await deployWETH();
        const {gridFactory} = await deployGridFactory(weth9.address);
        const router = await deploySwapRouter(gridFactory.address, weth9.address);
        const tokens = await Promise.all([
            deployERC20("T18", "T18", 18, 10000n * 10n ** 18n),
            deployERC20("T6", "T6", 6, 10000n * 10n ** 6n),
            deployERC20("T0", "T0", 0, 10000n),
        ]);
        tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1));

        const makerOrderManager = await deployMakerOrderManager(gridFactory, weth9);

        for (const token of tokens) {
            await token.approve(makerOrderManager.address, token.totalSupply());
            await token.transfer(taker.address, 5000n * 10n ** BigInt(await (token as ERC20).decimals()));
            await token.connect(taker).approve(router.address, token.totalSupply());
        }

        return {
            maker,
            taker,
            weth9,
            gridFactory,
            router,
            tokens,
            makerOrderManager,
        };
    }

    let maker: Wallet;
    let taker: Wallet;
    let weth9: IWETHMinimum;
    let gridFactory: IGridFactory;
    let router: SwapRouter;
    let tokens: IERC20[];
    let makerOrderManager: MakerOrderManager;
    let getBalances: (who: string) => Promise<{
        weth9: BigNumber;
        token0: BigNumber;
        token1: BigNumber;
        token2: BigNumber;
    }>;

    beforeEach("load fixture", async () => {
        ({maker, taker, weth9, gridFactory, router, tokens, makerOrderManager} = await loadFixture(deployFixture));
        getBalances = async (who: string) => {
            const balances = await Promise.all([
                weth9.balanceOf(who),
                tokens[0].balanceOf(who),
                tokens[1].balanceOf(who),
                tokens[2].balanceOf(who),
            ]);
            return {
                weth9: balances[0],
                token0: balances[1],
                token1: balances[2],
                token2: balances[3],
            };
        };
    });
    // ensure the swap router never ends up with a balance
    afterEach("load fixture", async () => {
        const balances = await getBalances(router.address);
        expect(Object.values(balances).every((b) => b.eq(0))).to.be.eq(true);
        const balance = await ethers.provider.getBalance(router.address);
        expect(balance.eq(0)).to.be.eq(true);
    });
    it("bytecode size", async () => {
        expect(((await router.provider.getCode(router.address)).length - 2) / 2).to.matchSnapshot();
    });
    describe("swaps", () => {
        async function createGrid(tokenAddressA: string, tokenAddressB: string) {
            let grid = await createGridAndInitialize(
                gridFactory,
                makerOrderManager,
                tokenAddressA,
                tokenAddressB,
                Resolution.MEDIUM,
                RESOLUTION_X96
            );

            const {boundary: boundaryBefore} = await grid.slot0();
            const boundaryLowerBefore = await formatBoundaryToBoundaryLower(boundaryBefore, Resolution.MEDIUM);
            const {token0, token1} = await sortedToken(tokenAddressA, tokenAddressB);

            await makerOrderManager.placeMakerOrder(
                {
                    deadline: new Date().getTime(),
                    zero: false,
                    recipient: maker.address,
                    tokenA: token0,
                    tokenB: token1,
                    resolution: Resolution.MEDIUM,
                    boundaryLower: boundaryLowerBefore - Resolution.MEDIUM,
                    amount: 1000,
                },
                {
                    value: token0.toLowerCase() == weth9.address.toLowerCase() ? 0 : 1000,
                }
            );
            await makerOrderManager.placeMakerOrder(
                {
                    deadline: new Date().getTime(),
                    zero: true,
                    recipient: maker.address,
                    tokenA: token0,
                    tokenB: token1,
                    resolution: Resolution.MEDIUM,
                    boundaryLower: boundaryLowerBefore + Resolution.MEDIUM,
                    amount: 1000,
                },
                {
                    value: token0.toLowerCase() == weth9.address.toLowerCase() ? 1000 : 0,
                }
            );
            return grid;
        }

        async function createGridWETH9(tokenAddress: string) {
            await weth9.deposit({value: 1000});
            await weth9.approve(router.address, constants.MaxUint256);
            return createGrid(weth9.address, tokenAddress);
        }

        beforeEach("create 0-1 and 1-2 grids", async () => {
            await createGrid(tokens[0].address, tokens[1].address);
            await createGrid(tokens[1].address, tokens[2].address);
        });

        describe("#exactInput", () => {
            async function exactInput(
                tokens: string[],
                amountIn: number = 3,
                amountOutMinimum: number = 1
            ): Promise<ContractTransaction> {
                const inputIsWETH = weth9.address === tokens[0];
                const outputIsWETH9 = tokens[tokens.length - 1] === weth9.address;

                const value = inputIsWETH ? amountIn : 0;

                const params = {
                    path: encodePath(
                        tokens,
                        new Array(tokens.length - 1).fill(Resolution.MEDIUM),
                        new Array(tokens.length - 1).fill(1)
                    ),
                    recipient: outputIsWETH9 ? constants.AddressZero : taker.address,
                    deadline: new Date().getTime(),
                    amountIn,
                    amountOutMinimum,
                };

                const data = [router.interface.encodeFunctionData("exactInput", [params])];
                if (outputIsWETH9)
                    data.push(router.interface.encodeFunctionData("unwrapWETH9", [amountOutMinimum, taker.address]));

                // ensure that the swap fails if the limit is any tighter
                params.amountOutMinimum += 1;
                await expect(router.connect(taker).exactInput(params, {value})).to.be.revertedWith("SR_TLR");
                params.amountOutMinimum -= 1;

                // optimized for the gas test
                return data.length === 1
                    ? router.connect(taker).exactInput(params, {value})
                    : router.connect(taker).multicall(data, {value});
            }

            describe("single-grid", () => {
                it("0 -> 1", async () => {
                    const grid = await gridFactory.grids(tokens[0].address, tokens[1].address, Resolution.MEDIUM);

                    // get balances before
                    const gridBefore = await getBalances(grid);
                    const takerBefore = await getBalances(taker.address);

                    await exactInput(tokens.slice(0, 2).map((token) => token.address));

                    // get balances after
                    const gridAfter = await getBalances(grid);
                    const takerAfter = await getBalances(taker.address);

                    expect(takerAfter.token0).to.be.eq(takerBefore.token0.sub(3));
                    expect(takerAfter.token1).to.be.eq(takerBefore.token1.add(1));
                    expect(gridAfter.token0).to.be.eq(gridBefore.token0.add(3));
                    expect(gridAfter.token1).to.be.eq(gridBefore.token1.sub(1));
                });
            });

            describe("multi-grid", () => {
                it("0 -> 1 -> 2", async () => {
                    const takerBefore = await getBalances(taker.address);

                    await exactInput(
                        tokens.map((token) => token.address),
                        5,
                        1
                    );

                    const takerAfter = await getBalances(taker.address);

                    expect(takerAfter.token0).to.be.eq(takerBefore.token0.sub(5));
                    expect(takerAfter.token2).to.be.eq(takerBefore.token2.add(1));
                });

                it("events", async () => {
                    await expect(
                        exactInput(
                            tokens.map((token) => token.address),
                            5,
                            1
                        )
                    )
                        .to.emit(tokens[0], "Transfer")
                        .withArgs(
                            taker.address,
                            await computeAddress(
                                gridFactory.address,
                                tokens[0].address,
                                tokens[1].address,
                                Resolution.MEDIUM
                            ),
                            5
                        )
                        .to.emit(tokens[1], "Transfer")
                        .withArgs(
                            await computeAddress(
                                gridFactory.address,
                                tokens[0].address,
                                tokens[1].address,
                                Resolution.MEDIUM
                            ),
                            router.address,
                            3
                        )
                        .to.emit(tokens[1], "Transfer")
                        .withArgs(
                            router.address,
                            await computeAddress(
                                gridFactory.address,
                                tokens[1].address,
                                tokens[2].address,
                                Resolution.MEDIUM
                            ),
                            3
                        )
                        .to.emit(tokens[2], "Transfer")
                        .withArgs(
                            await computeAddress(
                                gridFactory.address,
                                tokens[1].address,
                                tokens[2].address,
                                Resolution.MEDIUM
                            ),
                            taker.address,
                            1
                        );
                });
            });

            describe("ETH input", () => {
                describe("WETH9", () => {
                    beforeEach(async () => {
                        await createGridWETH9(tokens[0].address);
                    });

                    it("WETH9 -> 0", async () => {
                        const {token0} = await sortedToken(weth9.address, tokens[0].address);
                        if (token0.toLowerCase() != weth9.address.toLowerCase()) {
                            return;
                        }

                        const grid = await gridFactory.grids(weth9.address, tokens[0].address, Resolution.MEDIUM);

                        // get balances before
                        const gridBefore = await getBalances(grid);
                        const takerBefore = await getBalances(taker.address);

                        await expect(exactInput([weth9.address, tokens[0].address]))
                            .to.emit(weth9, "Deposit")
                            .withArgs(router.address, 3);

                        // get balances after
                        const gridAfter = await getBalances(grid);
                        const takerAfter = await getBalances(taker.address);

                        expect(takerAfter.token0).to.be.eq(takerBefore.token0.add(1));
                        expect(gridAfter.weth9).to.be.eq(gridBefore.weth9.add(3));
                        expect(gridAfter.token0).to.be.eq(gridBefore.token0.sub(1));
                    });

                    it("WETH9 -> 0 -> 1", async () => {
                        const {token0} = await sortedToken(weth9.address, tokens[0].address);
                        if (token0.toLowerCase() != weth9.address.toLowerCase()) {
                            return;
                        }

                        const takerBefore = await getBalances(taker.address);

                        await expect(exactInput([weth9.address, tokens[0].address, tokens[1].address], 5))
                            .to.emit(weth9, "Deposit")
                            .withArgs(router.address, 5);

                        const takerAfter = await getBalances(taker.address);

                        expect(takerAfter.token1).to.be.eq(takerBefore.token1.add(1));
                    });
                });
            });
        });

        describe("#exactInputSingle", () => {
            async function exactInputSingle(
                tokenIn: string,
                tokenOut: string,
                amountIn: number = 3,
                amountOutMinimum: number = 1,
                priceLimitX96?: BigNumber
            ): Promise<ContractTransaction> {
                const inputIsWETH = weth9.address === tokenIn;
                const outputIsWETH9 = tokenOut === weth9.address;

                const value = inputIsWETH ? amountIn : 0;

                const params = {
                    tokenIn,
                    tokenOut,
                    resolution: Resolution.MEDIUM,
                    priceLimitX96:
                        priceLimitX96 ?? tokenIn.toLowerCase() < tokenOut.toLowerCase() ? MIN_RATIO : MAX_RATIO,
                    recipient: outputIsWETH9 ? constants.AddressZero : taker.address,
                    deadline: new Date().getTime(),
                    amountIn,
                    amountOutMinimum,
                };

                const data = [router.interface.encodeFunctionData("exactInputSingle", [params])];
                if (outputIsWETH9)
                    data.push(router.interface.encodeFunctionData("unwrapWETH9", [amountOutMinimum, taker.address]));

                // ensure that the swap fails if the limit is any tighter
                params.amountOutMinimum += 1;
                await expect(router.connect(taker).exactInputSingle(params, {value})).to.be.revertedWith("SR_TLR");
                params.amountOutMinimum -= 1;

                // optimized for the gas test
                return data.length === 1
                    ? router.connect(taker).exactInputSingle(params, {value})
                    : router.connect(taker).multicall(data, {value});
            }

            it("0 -> 1", async () => {
                const grid = await gridFactory.grids(tokens[0].address, tokens[1].address, Resolution.MEDIUM);

                // get balances before
                const gridBefore = await getBalances(grid);
                const takerBefore = await getBalances(taker.address);

                await exactInputSingle(tokens[0].address, tokens[1].address);

                // get balances after
                const gridAfter = await getBalances(grid);
                const takerAfter = await getBalances(taker.address);

                expect(takerAfter.token0).to.be.eq(takerBefore.token0.sub(3));
                expect(takerAfter.token1).to.be.eq(takerBefore.token1.add(1));
                expect(gridAfter.token0).to.be.eq(gridBefore.token0.add(3));
                expect(gridAfter.token1).to.be.eq(gridBefore.token1.sub(1));
            });

            describe("ETH input", () => {
                describe("WETH9", () => {
                    beforeEach(async () => {
                        await createGridWETH9(tokens[0].address);
                    });

                    it("WETH9 -> 0", async () => {
                        const {token0} = await sortedToken(weth9.address, tokens[0].address);
                        if (token0.toLowerCase() != weth9.address.toLowerCase()) {
                            return;
                        }
                        const grid = await gridFactory.grids(weth9.address, tokens[0].address, Resolution.MEDIUM);

                        // get balances before
                        const gridBefore = await getBalances(grid);
                        const takerBefore = await getBalances(taker.address);

                        await expect(exactInputSingle(weth9.address, tokens[0].address))
                            .to.emit(weth9, "Deposit")
                            .withArgs(router.address, 3);

                        // get balances after
                        const gridAfter = await getBalances(grid);
                        const takerAfter = await getBalances(taker.address);

                        expect(takerAfter.token0).to.be.eq(takerBefore.token0.add(1));
                        expect(gridAfter.weth9).to.be.eq(gridBefore.weth9.add(3));
                        expect(gridAfter.token0).to.be.eq(gridBefore.token0.sub(1));
                    });
                });
            });
        });

        describe("#exactOutput", () => {
            async function exactOutput(
                tokens: string[],
                amountOut: number = 1,
                amountInMaximum: number = 3
            ): Promise<ContractTransaction> {
                const inputIsWETH9 = tokens[0] === weth9.address;
                const outputIsWETH9 = tokens[tokens.length - 1] === weth9.address;

                const value = inputIsWETH9 ? amountInMaximum : 0;

                const params = {
                    path: encodePath(
                        tokens.slice().reverse(),
                        new Array(tokens.length - 1).fill(Resolution.MEDIUM),
                        new Array(tokens.length - 1).fill(1)
                    ),
                    recipient: outputIsWETH9 ? constants.AddressZero : taker.address,
                    deadline: new Date().getTime(),
                    amountOut,
                    amountInMaximum,
                };

                const data = [router.interface.encodeFunctionData("exactOutput", [params])];
                if (inputIsWETH9) data.push(router.interface.encodeFunctionData("unwrapWETH9", [0, taker.address]));
                if (outputIsWETH9)
                    data.push(router.interface.encodeFunctionData("unwrapWETH9", [amountOut, taker.address]));

                // ensure that the swap fails if the limit is any tighter
                params.amountInMaximum -= 1;
                await expect(router.connect(taker).exactOutput(params, {value})).to.be.revertedWith("SR_TMR");
                params.amountInMaximum += 1;

                return router.connect(taker).multicall(data, {value});
            }

            describe("single-grid", () => {
                it("0 -> 1", async () => {
                    const grid = await gridFactory.grids(tokens[0].address, tokens[1].address, Resolution.MEDIUM);

                    // get balances before
                    const gridBefore = await getBalances(grid);
                    const takerBefore = await getBalances(taker.address);

                    await exactOutput(tokens.slice(0, 2).map((token) => token.address));

                    // get balances after
                    const gridAfter = await getBalances(grid);
                    const takerAfter = await getBalances(taker.address);

                    expect(takerAfter.token0).to.be.eq(takerBefore.token0.sub(3));
                    expect(takerAfter.token1).to.be.eq(takerBefore.token1.add(1));
                    expect(gridAfter.token0).to.be.eq(gridBefore.token0.add(3));
                    expect(gridAfter.token1).to.be.eq(gridBefore.token1.sub(1));
                });

                it("1 -> 0", async () => {
                    const grid = await gridFactory.grids(tokens[1].address, tokens[0].address, Resolution.MEDIUM);

                    // get balances before
                    const gridBefore = await getBalances(grid);
                    const takerBefore = await getBalances(taker.address);

                    await exactOutput(
                        tokens
                            .slice(0, 2)
                            .reverse()
                            .map((token) => token.address)
                    );

                    // get balances after
                    const gridAfter = await getBalances(grid);
                    const takerAfter = await getBalances(taker.address);

                    expect(takerAfter.token0).to.be.eq(takerBefore.token0.add(1));
                    expect(takerAfter.token1).to.be.eq(takerBefore.token1.sub(3));
                    expect(gridAfter.token0).to.be.eq(gridBefore.token0.sub(1));
                    expect(gridAfter.token1).to.be.eq(gridBefore.token1.add(3));
                });
            });

            describe("multi-grid", () => {
                it("0 -> 1 -> 2", async () => {
                    const takerBefore = await getBalances(taker.address);

                    await exactOutput(
                        tokens.map((token) => token.address),
                        1,
                        5
                    );

                    const takerAfter = await getBalances(taker.address);

                    expect(takerAfter.token0).to.be.eq(takerBefore.token0.sub(5));
                    expect(takerAfter.token2).to.be.eq(takerBefore.token2.add(1));
                });

                it("2 -> 1 -> 0", async () => {
                    const takerBefore = await getBalances(taker.address);

                    await exactOutput(tokens.map((token) => token.address).reverse(), 1, 5);

                    const takerAfter = await getBalances(taker.address);

                    expect(takerAfter.token2).to.be.eq(takerBefore.token2.sub(5));
                    expect(takerAfter.token0).to.be.eq(takerBefore.token0.add(1));
                });

                it("events", async () => {
                    await expect(
                        exactOutput(
                            tokens.map((token) => token.address),
                            1,
                            5
                        )
                    )
                        .to.emit(tokens[2], "Transfer")
                        .withArgs(
                            await computeAddress(
                                gridFactory.address,
                                tokens[2].address,
                                tokens[1].address,
                                Resolution.MEDIUM
                            ),
                            taker.address,
                            1
                        )
                        .to.emit(tokens[1], "Transfer")
                        .withArgs(
                            await computeAddress(
                                gridFactory.address,
                                tokens[1].address,
                                tokens[0].address,
                                Resolution.MEDIUM
                            ),
                            await computeAddress(
                                gridFactory.address,
                                tokens[2].address,
                                tokens[1].address,
                                Resolution.MEDIUM
                            ),
                            3
                        )
                        .to.emit(tokens[0], "Transfer")
                        .withArgs(
                            taker.address,
                            await computeAddress(
                                gridFactory.address,
                                tokens[1].address,
                                tokens[0].address,
                                Resolution.MEDIUM
                            ),
                            5
                        );
                });
            });

            describe("ETH input", () => {
                describe("WETH9", () => {
                    beforeEach(async () => {
                        await createGridWETH9(tokens[0].address);
                    });

                    it("WETH9 -> 0", async () => {
                        const grid = await gridFactory.grids(weth9.address, tokens[0].address, Resolution.MEDIUM);

                        // get balances before
                        const gridBefore = await getBalances(grid);
                        const takerBefore = await getBalances(taker.address);

                        await expect(exactOutput([weth9.address, tokens[0].address]))
                            .to.emit(weth9, "Deposit")
                            .withArgs(router.address, 3);

                        // get balances after
                        const gridAfter = await getBalances(grid);
                        const takerAfter = await getBalances(taker.address);

                        expect(takerAfter.token0).to.be.eq(takerBefore.token0.add(1));
                        expect(gridAfter.weth9).to.be.eq(gridBefore.weth9.add(3));
                        expect(gridAfter.token0).to.be.eq(gridBefore.token0.sub(1));
                    });

                    it("WETH9 -> 0 -> 1", async () => {
                        const takerBefore = await getBalances(taker.address);

                        await expect(exactOutput([weth9.address, tokens[0].address, tokens[1].address], 1, 5))
                            .to.emit(weth9, "Deposit")
                            .withArgs(router.address, 5);

                        const takerAfter = await getBalances(taker.address);

                        expect(takerAfter.token1).to.be.eq(takerBefore.token1.add(1));
                    });
                });
            });

            describe("ETH output", () => {
                describe("WETH9", () => {
                    beforeEach(async () => {
                        await createGridWETH9(tokens[0].address);
                        await createGridWETH9(tokens[1].address);
                    });

                    it("0 -> WETH9", async () => {
                        const grid = await gridFactory.grids(tokens[0].address, weth9.address, Resolution.MEDIUM);

                        // get balances before
                        const gridBefore = await getBalances(grid);
                        const takerBefore = await getBalances(taker.address);

                        await expect(exactOutput([tokens[0].address, weth9.address]))
                            .to.emit(weth9, "Withdrawal")
                            .withArgs(router.address, 1);

                        // get balances after
                        const gridAfter = await getBalances(grid);
                        const takerAfter = await getBalances(taker.address);

                        expect(takerAfter.token0).to.be.eq(takerBefore.token0.sub(3));
                        expect(gridAfter.weth9).to.be.eq(gridBefore.weth9.sub(1));
                        expect(gridAfter.token0).to.be.eq(gridBefore.token0.add(3));
                    });

                    it("0 -> 1 -> WETH9", async () => {
                        // get balances before
                        const takerBefore = await getBalances(taker.address);

                        await expect(exactOutput([tokens[0].address, tokens[1].address, weth9.address], 1, 5))
                            .to.emit(weth9, "Withdrawal")
                            .withArgs(router.address, 1);

                        // get balances after
                        const takerAfter = await getBalances(taker.address);

                        expect(takerAfter.token0).to.be.eq(takerBefore.token0.sub(5));
                    });
                });
            });
        });
        describe("#exactOutputSingle", () => {
            async function exactOutputSingle(
                tokenIn: string,
                tokenOut: string,
                amountOut: number = 1,
                amountInMaximum: number = 3,
                priceLimitX96?: BigNumber
            ): Promise<ContractTransaction> {
                const inputIsWETH9 = tokenIn === weth9.address;
                const outputIsWETH9 = tokenOut === weth9.address;

                const value = inputIsWETH9 ? amountInMaximum : 0;

                const params = {
                    tokenIn,
                    tokenOut,
                    resolution: Resolution.MEDIUM,
                    recipient: outputIsWETH9 ? constants.AddressZero : taker.address,
                    deadline: new Date().getTime(),
                    amountOut,
                    amountInMaximum,
                    priceLimitX96:
                        priceLimitX96 ?? tokenIn.toLowerCase() < tokenOut.toLowerCase() ? MIN_RATIO : MAX_RATIO,
                };

                const data = [router.interface.encodeFunctionData("exactOutputSingle", [params])];
                if (inputIsWETH9) data.push(router.interface.encodeFunctionData("refundNativeToken"));
                if (outputIsWETH9)
                    data.push(router.interface.encodeFunctionData("unwrapWETH9", [amountOut, taker.address]));

                // ensure that the swap fails if the limit is any tighter
                params.amountInMaximum -= 1;
                await expect(router.connect(taker).exactOutputSingle(params, {value})).to.be.revertedWith("SR_TMR");
                params.amountInMaximum += 1;

                return router.connect(taker).multicall(data, {value});
            }

            it("0 -> 1", async () => {
                const grid = await gridFactory.grids(tokens[0].address, tokens[1].address, Resolution.MEDIUM);

                // get balances before
                const gridBefore = await getBalances(grid);
                const takerBefore = await getBalances(taker.address);

                await exactOutputSingle(tokens[0].address, tokens[1].address);

                // get balances after
                const gridAfter = await getBalances(grid);
                const takerAfter = await getBalances(taker.address);

                expect(takerAfter.token0).to.be.eq(takerBefore.token0.sub(3));
                expect(takerAfter.token1).to.be.eq(takerBefore.token1.add(1));
                expect(gridAfter.token0).to.be.eq(gridBefore.token0.add(3));
                expect(gridAfter.token1).to.be.eq(gridBefore.token1.sub(1));
            });

            it("1 -> 0", async () => {
                const grid = await gridFactory.grids(tokens[1].address, tokens[0].address, Resolution.MEDIUM);

                // get balances before
                const gridBefore = await getBalances(grid);
                const takerBefore = await getBalances(taker.address);

                await exactOutputSingle(tokens[1].address, tokens[0].address);

                // get balances after
                const gridAfter = await getBalances(grid);
                const takerAfter = await getBalances(taker.address);

                expect(takerAfter.token0).to.be.eq(takerBefore.token0.add(1));
                expect(takerAfter.token1).to.be.eq(takerBefore.token1.sub(3));
                expect(gridAfter.token0).to.be.eq(gridBefore.token0.sub(1));
                expect(gridAfter.token1).to.be.eq(gridBefore.token1.add(3));
            });

            describe("ETH input", () => {
                describe("WETH9", () => {
                    beforeEach(async () => {
                        await createGridWETH9(tokens[0].address);
                    });

                    it("WETH9 -> 0", async () => {
                        const grid = await gridFactory.grids(weth9.address, tokens[0].address, Resolution.MEDIUM);

                        // get balances before
                        const gridBefore = await getBalances(grid);
                        const takerBefore = await getBalances(taker.address);

                        await expect(exactOutputSingle(weth9.address, tokens[0].address))
                            .to.emit(weth9, "Deposit")
                            .withArgs(router.address, 3);

                        // get balances after
                        const gridAfter = await getBalances(grid);
                        const takerAfter = await getBalances(taker.address);

                        expect(takerAfter.token0).to.be.eq(takerBefore.token0.add(1));
                        expect(gridAfter.weth9).to.be.eq(gridBefore.weth9.add(3));
                        expect(gridAfter.token0).to.be.eq(gridBefore.token0.sub(1));
                    });
                });
            });

            describe("ETH output", () => {
                describe("WETH9", () => {
                    beforeEach(async () => {
                        await createGridWETH9(tokens[0].address);
                        await createGridWETH9(tokens[1].address);
                    });

                    it("0 -> WETH9", async () => {
                        const grid = await gridFactory.grids(tokens[0].address, weth9.address, Resolution.MEDIUM);

                        // get balances before
                        const gridBefore = await getBalances(grid);
                        const takerBefore = await getBalances(taker.address);

                        await expect(exactOutputSingle(tokens[0].address, weth9.address))
                            .to.emit(weth9, "Withdrawal")
                            .withArgs(router.address, 1);

                        // get balances after
                        const gridAfter = await getBalances(grid);
                        const takerAfter = await getBalances(taker.address);

                        expect(takerAfter.token0).to.be.eq(takerBefore.token0.sub(3));
                        expect(gridAfter.weth9).to.be.eq(gridBefore.weth9.sub(1));
                        expect(gridAfter.token0).to.be.eq(gridBefore.token0.add(3));
                    });
                });
            });
        });
    });
});
