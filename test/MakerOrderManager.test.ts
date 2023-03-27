import {ethers} from "hardhat";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {deployERC20, deployGridFactory, deployMakerOrderManager, deploySwapRouter, deployWETH} from "./shared/deployer";
import {ContractFactory, utils} from "ethers";

import {createGridAndInitialize, MAX_RATIO, MIN_RATIO, Resolution, RESOLUTION_X96} from "./shared/util";
import {sortedToken} from "./shared/GridAddress";
import {expect, snapshotGasCost} from "./shared/expect";

describe("MakerOrderManager", () => {
    const tokenAddresses = [
        "0x1000000000000000000000000000000000000000",
        "0x2000000000000000000000000000000000000000",
        "0x3000000000000000000000000000000000000000",
    ];

    const startOrderId = 3;
    const startBundleId = 3;

    async function deployAndInitializeGridFixture() {
        const [signer, otherAccount] = await ethers.getSigners();
        const weth = await deployWETH();
        const {gridFactory} = await deployGridFactory(weth.address);

        const makerOrderManager = await deployMakerOrderManager(gridFactory, weth);

        const swapRouter = await deploySwapRouter(gridFactory.address, weth.address);

        const usdc = await deployERC20("USDC", "USDC", 6, 10n ** 18n * 20000n);
        await Promise.all([
            usdc.approve(makerOrderManager.address, 10n ** 18n * 10000n),
            usdc.approve(swapRouter.address, 10n ** 18n * 10000n),
            weth.approve(makerOrderManager.address, 10n ** 18n * 10000n),
            weth.approve(swapRouter.address, 10n ** 18n * 10000n),

            usdc.transfer(otherAccount.address, 10n ** 18n * 10000n),
            usdc.connect(otherAccount).approve(makerOrderManager.address, 10n ** 18n * 10000n),
            usdc.connect(otherAccount).approve(swapRouter.address, 10n ** 18n * 10000n),
            weth.connect(otherAccount).approve(makerOrderManager.address, 10n ** 18n * 10000n),
            weth.connect(otherAccount).approve(swapRouter.address, 10n ** 18n * 10000n),
        ]);

        const lowGrid = await createGridAndInitialize(
            gridFactory,
            makerOrderManager,
            usdc.address,
            weth.address,
            Resolution.LOW,
            RESOLUTION_X96,
            true
        );

        const mediumGrid = await createGridAndInitialize(
            gridFactory,
            makerOrderManager,
            usdc.address,
            weth.address,
            Resolution.MEDIUM,
            RESOLUTION_X96,
            true
        );

        const highGrid = await createGridAndInitialize(
            gridFactory,
            makerOrderManager,
            usdc.address,
            weth.address,
            Resolution.HIGH,
            RESOLUTION_X96,
            true
        );

        const gridEventJSON = require("@gridexprotocol/core/artifacts/contracts/interfaces/IGridEvents.sol/IGridEvents.json");
        const gridEventFactory = (await ethers.getContractFactory(
            gridEventJSON.abi,
            gridEventJSON.bytecode
        )) as ContractFactory;
        return {
            signer,
            otherAccount,
            gridFactory,
            weth,
            usdc,
            makerOrderManager,
            lowGrid,
            mediumGrid,
            highGrid,
            swapRouter,
            gridEventFactory,
        };
    }

    describe("#gridexPlaceMakerOrderCallback", () => {
        it("should revert with right error if invalid caller", async () => {
            const {signer, makerOrderManager} = await loadFixture(deployAndInitializeGridFixture);

            const encodeData = utils.defaultAbiCoder.encode(
                ["address", "address", "int24", "address"],
                [tokenAddresses[0], tokenAddresses[1], Resolution.LOW, signer.address]
            );
            await expect(makerOrderManager.gridexPlaceMakerOrderCallback(0, 0, encodeData)).to.revertedWith("CV_IC");
        });
    });

    describe("#placeMakerOrder", () => {
        it("should revert with right error if deadline exceeded", async () => {
            const {weth, makerOrderManager} = await loadFixture(deployAndInitializeGridFixture);
            await expect(
                makerOrderManager.placeMakerOrder({
                    deadline: 0,
                    recipient: ethers.constants.AddressZero,
                    tokenA: weth.address,
                    tokenB: weth.address,
                    resolution: Resolution.MEDIUM,
                    zero: true,
                    boundaryLower: 0n,
                    amount: 0n,
                })
            ).to.revertedWith("AP_TTO");
        });

        it("should revert if grid not found", async () => {
            const {weth, makerOrderManager} = await loadFixture(deployAndInitializeGridFixture);
            await expect(
                makerOrderManager.placeMakerOrder({
                    deadline: new Date().getTime(),
                    recipient: ethers.constants.AddressZero,
                    tokenA: weth.address,
                    tokenB: weth.address,
                    resolution: Resolution.MEDIUM,
                    zero: true,
                    boundaryLower: 0n,
                    amount: 0n,
                })
            ).to.reverted;
        });

        it("should revert with right error if insufficient balance", async () => {
            const {weth, usdc, makerOrderManager} = await loadFixture(deployAndInitializeGridFixture);
            const {token0} = await sortedToken(usdc.address, weth.address);
            const signers = await ethers.getSigners();
            await expect(
                makerOrderManager.connect(signers[2]).placeMakerOrder({
                    deadline: new Date().getTime(),
                    recipient: ethers.constants.AddressZero,
                    tokenA: usdc.address,
                    tokenB: weth.address,
                    resolution: Resolution.MEDIUM,
                    zero: token0.toLowerCase() == usdc.address.toLowerCase(),
                    boundaryLower: 0,
                    amount: 1000,
                })
            ).to.revertedWith("ERC20: insufficient allowance");

            await expect(
                makerOrderManager.connect(signers[2]).placeMakerOrder({
                    deadline: new Date().getTime(),
                    recipient: ethers.constants.AddressZero,
                    tokenA: usdc.address,
                    tokenB: weth.address,
                    resolution: Resolution.MEDIUM,
                    zero: token0.toLowerCase() == weth.address.toLowerCase(),
                    boundaryLower: 0,
                    amount: 1000,
                })
            ).to.revertedWith("SafeERC20: low-level call failed");
        });

        describe("order owner", () => {
            const tests = [
                {
                    recipient: ethers.constants.AddressZero,
                    expectRecipient: undefined,
                },
                {
                    recipient: "0x1000000000000000000000000000000000000000",
                    expectRecipient: "0x1000000000000000000000000000000000000000",
                },
            ];
            tests.forEach((test) => {
                it(`recipient is ${test.recipient}`, async () => {
                    const {
                        signer,
                        weth,
                        usdc,
                        makerOrderManager,
                        highGrid: grid,
                        gridEventFactory,
                    } = await loadFixture(deployAndInitializeGridFixture);

                    const {token1} = await sortedToken(usdc.address, weth.address);
                    await expect(
                        makerOrderManager.placeMakerOrder(
                            {
                                deadline: new Date().getTime(),
                                recipient: test.recipient,
                                tokenA: weth.address,
                                tokenB: usdc.address,
                                resolution: Resolution.HIGH,
                                zero: false,
                                boundaryLower: 0,
                                amount: 10n ** 18n,
                            },
                            {
                                value: token1.toLowerCase() == weth.address.toLowerCase() ? 10n ** 18n : 0n,
                            }
                        )
                    )
                        .to.emit(await gridEventFactory.attach(grid.address), "PlaceMakerOrder")
                        .withArgs(
                            startOrderId,
                            test.expectRecipient ?? signer.address,
                            startBundleId,
                            false,
                            0,
                            10n ** 18n
                        );

                    const {owner} = await grid.orders(startOrderId);
                    expect(owner).to.equal(test.expectRecipient ?? signer.address);
                });
            });
        });
    });

    describe("#placeMakerOrderInBatch", () => {
        it("should revert with right error if deadline exceeded", async () => {
            const {weth, usdc, makerOrderManager} = await loadFixture(deployAndInitializeGridFixture);
            await expect(
                makerOrderManager.placeMakerOrderInBatch({
                    deadline: 0,
                    recipient: ethers.constants.AddressZero,
                    tokenA: weth.address,
                    tokenB: usdc.address,
                    resolution: Resolution.MEDIUM,
                    zero: true,
                    orders: [],
                })
            ).to.revertedWith("AP_TTO");
        });

        it("should not revert if orders is empty", async () => {
            const {weth, usdc, makerOrderManager} = await loadFixture(deployAndInitializeGridFixture);
            await makerOrderManager.placeMakerOrderInBatch({
                deadline: new Date().getTime(),
                recipient: ethers.constants.AddressZero,
                tokenA: weth.address,
                tokenB: usdc.address,
                resolution: Resolution.MEDIUM,
                zero: true,
                orders: [],
            });
        });
    });

    describe("#placeRelativeOrder", () => {
        it("should revert with right error if deadline exceeded", async () => {
            const {makerOrderManager} = await loadFixture(deployAndInitializeGridFixture);
            await expect(
                makerOrderManager.placeRelativeOrder({
                    deadline: 0,
                    recipient: ethers.constants.AddressZero,
                    tokenA: ethers.constants.AddressZero,
                    tokenB: ethers.constants.AddressZero,
                    resolution: 0,
                    zero: false,
                    amount: 10n ** 18n,
                    priceDeltaX96: 0n,
                    priceMinimumX96: RESOLUTION_X96,
                    priceMaximumX96: RESOLUTION_X96,
                })
            ).to.revertedWith("AP_TTO");
        });

        it("should revert with right error if amount in is zero", async () => {
            const {makerOrderManager} = await loadFixture(deployAndInitializeGridFixture);
            await expect(
                makerOrderManager.placeRelativeOrder({
                    deadline: new Date().getTime(),
                    recipient: ethers.constants.AddressZero,
                    tokenA: ethers.constants.AddressZero,
                    tokenB: ethers.constants.AddressZero,
                    resolution: 0,
                    zero: false,
                    amount: 0n,
                    priceDeltaX96: 0n,
                    priceMinimumX96: RESOLUTION_X96,
                    priceMaximumX96: RESOLUTION_X96,
                })
            ).to.revertedWith("MOM_AIZ");
        });

        describe("should revert with right error if price out of range", () => {
            const tests = [
                {
                    name: "targetPriceX96 is less than MIN_RATIO",
                    priceDeltaX96: RESOLUTION_X96 * -1n,
                    priceMinimumX96: MIN_RATIO,
                    priceMaximumX96: MAX_RATIO,
                },

                {
                    name: "targetPriceX96 is less than priceMinimumX96",
                    priceDeltaX96: RESOLUTION_X96,
                    priceMinimumX96: RESOLUTION_X96 * 3n,
                    priceMaximumX96: MAX_RATIO,
                },
                {
                    name: "targetPriceX96 is greater than priceMaximumX96",
                    priceDeltaX96: 0n,
                    priceMinimumX96: MIN_RATIO,
                    priceMaximumX96: MIN_RATIO * 2n,
                },
            ];
            tests.forEach((test) => {
                it(`${test.name}`, async () => {
                    const {makerOrderManager, weth, usdc} = await loadFixture(deployAndInitializeGridFixture);
                    await expect(
                        makerOrderManager.placeRelativeOrder({
                            deadline: new Date().getTime(),
                            recipient: ethers.constants.AddressZero,
                            tokenA: weth.address,
                            tokenB: usdc.address,
                            resolution: Resolution.HIGH,
                            zero: false,
                            amount: 1n,
                            priceDeltaX96: test.priceDeltaX96,
                            priceMinimumX96: test.priceMinimumX96,
                            priceMaximumX96: test.priceMaximumX96,
                        })
                    ).to.revertedWith("MOM_POR");
                });
            });
        });

        it("owner should be signer when recipient is zero", async () => {
            const {
                signer,
                makerOrderManager,
                weth,
                usdc,
                highGrid: grid,
                gridEventFactory,
            } = await loadFixture(deployAndInitializeGridFixture);
            const {token0} = await sortedToken(weth.address, usdc.address);
            await expect(
                makerOrderManager.placeRelativeOrder({
                    deadline: new Date().getTime(),
                    recipient: ethers.constants.AddressZero,
                    tokenA: weth.address,
                    tokenB: usdc.address,
                    resolution: Resolution.HIGH,
                    zero: usdc.address.toLowerCase() == token0.toLowerCase(),
                    amount: 1n,
                    priceDeltaX96: 0n,
                    priceMinimumX96: RESOLUTION_X96,
                    priceMaximumX96: RESOLUTION_X96,
                })
            )
                .to.emit(await gridEventFactory.attach(grid.address), "PlaceMakerOrder")
                .withArgs(
                    startOrderId,
                    signer.address,
                    startBundleId,
                    usdc.address.toLowerCase() == token0.toLowerCase(),
                    () => true,
                    1n
                );
        });

        it("owner should be recipient when recipient is not zero", async () => {
            const {
                otherAccount,
                makerOrderManager,
                weth,
                usdc,
                highGrid: grid,
                gridEventFactory,
            } = await loadFixture(deployAndInitializeGridFixture);
            const {token0} = await sortedToken(weth.address, usdc.address);
            await expect(
                makerOrderManager.placeRelativeOrder({
                    deadline: new Date().getTime(),
                    recipient: otherAccount.address,
                    tokenA: weth.address,
                    tokenB: usdc.address,
                    resolution: Resolution.HIGH,
                    zero: usdc.address.toLowerCase() == token0.toLowerCase(),
                    amount: 1n,
                    priceDeltaX96: 0n,
                    priceMinimumX96: RESOLUTION_X96,
                    priceMaximumX96: RESOLUTION_X96,
                })
            )
                .to.emit(await gridEventFactory.attach(grid.address), "PlaceMakerOrder")
                .withArgs(
                    startOrderId,
                    otherAccount.address,
                    startBundleId,
                    usdc.address.toLowerCase() == token0.toLowerCase(),
                    () => true,
                    1n
                );
        });

        describe("relative orders", () => {
            const tests = [
                {
                    name: "price at left boundary price",
                    zero: true,
                    priceDeltaX96: 0n,
                    expectBoundaryLower: 0,
                },
                {
                    name: "price at right boundary price",
                    zero: true,
                    priceDeltaX96: 238029451933307601877824497n,
                    expectBoundaryLower: 30,
                },

                {
                    name: "price at left boundary price",
                    zero: false,
                    priceDeltaX96: 0n,
                    expectBoundaryLower: -30,
                },
                {
                    name: "price at right boundary price",
                    zero: false,
                    priceDeltaX96: 238029451933307601877824497n,
                    expectBoundaryLower: 0,
                },
                {
                    name: "price at left boundary price(avoid underflow)",
                    zero: false,
                    priceDeltaX96: -79228162514264337593542961022n,
                    expectBoundaryLower: -527400,
                },
            ];
            tests.forEach((test) => {
                it(`should place relative order for token${test.zero ? "0" : "1"}`, async () => {
                    const {
                        otherAccount,
                        makerOrderManager,
                        weth,
                        usdc,
                        highGrid: grid,
                        gridEventFactory,
                    } = await loadFixture(deployAndInitializeGridFixture);
                    await expect(
                        makerOrderManager.placeRelativeOrder(
                            {
                                deadline: new Date().getTime(),
                                recipient: otherAccount.address,
                                tokenA: weth.address,
                                tokenB: usdc.address,
                                resolution: Resolution.HIGH,
                                zero: test.zero,
                                amount: 1n,
                                priceDeltaX96: test.priceDeltaX96,
                                priceMinimumX96: MIN_RATIO,
                                priceMaximumX96: MAX_RATIO,
                            },
                            {
                                value: 1n,
                            }
                        )
                    )
                        .to.emit(await gridEventFactory.attach(grid.address), "PlaceMakerOrder")
                        .withArgs(startOrderId, otherAccount.address, startBundleId, test.zero, () => true, 1n);
                });
            });
        });
    });

    describe("#multicall", () => {
        it("initialize grid and place maker order", async () => {
            const weth = await deployWETH();
            const {gridFactory} = await deployGridFactory(weth.address);
            const usdc = await deployERC20("USDC", "USDC", 8, 10n ** 18n * 10000n);
            const makerOrderManager = await deployMakerOrderManager(gridFactory, weth);

            const {token0} = await sortedToken(weth.address, usdc.address);
            const [signer] = await ethers.getSigners();
            const call1 = makerOrderManager.interface.encodeFunctionData("createGridAndInitialize", [
                {
                    tokenA: weth.address,
                    tokenB: usdc.address,
                    resolution: Resolution.LOW,
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
                },
            ]);
            const call2 = makerOrderManager.interface.encodeFunctionData("placeMakerOrder", [
                {
                    deadline: new Date().getTime(),
                    recipient: ethers.constants.AddressZero,
                    tokenA: weth.address,
                    tokenB: usdc.address,
                    resolution: Resolution.LOW,
                    zero: token0.toLowerCase() == weth.address.toLowerCase(),
                    boundaryLower: 0,
                    amount: 10n ** 18n,
                },
            ]);

            await expect(
                makerOrderManager.multicall([call1, call2], {
                    value: 10n ** 18n,
                })
            );
        });
    });

    it("gas cost", async () => {
        const {
            signer,
            makerOrderManager,
            weth,
            usdc,
            highGrid: grid,
        } = await loadFixture(deployAndInitializeGridFixture);

        await snapshotGasCost(
            makerOrderManager.placeMakerOrder(
                {
                    deadline: new Date().getTime(),
                    recipient: ethers.constants.AddressZero,
                    tokenA: weth.address,
                    tokenB: usdc.address,
                    resolution: Resolution.HIGH,
                    zero: true,
                    boundaryLower: 0,
                    amount: 1n,
                },
                {value: 1n}
            )
        );

        await snapshotGasCost(
            makerOrderManager.placeMakerOrder(
                {
                    deadline: new Date().getTime(),
                    recipient: ethers.constants.AddressZero,
                    tokenA: weth.address,
                    tokenB: usdc.address,
                    resolution: Resolution.HIGH,
                    zero: true,
                    boundaryLower: 0,
                    amount: 1n,
                },
                {value: 1n}
            )
        );

        await snapshotGasCost(grid.settleMakerOrderAndCollect(signer.address, startOrderId + 1, false));
    });
});
