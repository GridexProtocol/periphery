import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {
    deployERC20Tokens,
    deployGridFactory,
    deployMakerOrderManager,
    deployQuoter,
    deploySwapRouter,
    deployWETH,
} from "./shared/deployer";
import {ethers} from "hardhat";
import {
    createGridAndInitialize,
    encodePriceWithBaseAndQuote,
    formatBoundaryToBoundaryLower,
    Resolution,
} from "./shared/util";
import {BigNumber} from "ethers";
import {expect} from "./shared/expect";
import {encodePath} from "./shared/path";

describe("Quoter", () => {
    async function deployFixture() {
        // deploy weth
        const weth = await deployWETH();
        // deploy grid factory
        const {gridFactory} = await deployGridFactory(weth.address);
        // deploy quoter
        const quoter = await deployQuoter(gridFactory, weth);
        // deploy swap router
        const swapRouter = await deploySwapRouter(gridFactory.address, weth.address);
        // deploy tokens
        const tokens = await deployERC20Tokens();

        // deploy MakerOrderManager
        const makerOrderManager = await deployMakerOrderManager(gridFactory, weth);

        // approve
        for (let i = 0; i < tokens.length; i++) {
            await tokens[i].approve(makerOrderManager.address, BigNumber.from(1).shl(18));
        }

        // create and initialize grids
        const grid01 = await createGridAndInitialize(
            gridFactory,
            makerOrderManager,
            tokens[0].address,
            tokens[1].address,
            Resolution.MEDIUM,
            encodePriceWithBaseAndQuote(tokens[0].address, 1, tokens[1].address, 1)
        );
        const grid12 = await createGridAndInitialize(
            gridFactory,
            makerOrderManager,
            tokens[1].address,
            tokens[2].address,
            Resolution.MEDIUM,
            encodePriceWithBaseAndQuote(tokens[1].address, 1, tokens[2].address, 1)
        );

        // approve
        tokens.forEach((token, i) => {
            Promise.all([
                token.approve(grid01.address, 10n ** 18n),
                token.approve(grid12.address, 10n ** 18n),
                token.approve(makerOrderManager.address, 10n ** 18n),
                token.approve(swapRouter.address, 10n ** 18n),
            ]);
        });

        const [signer] = await ethers.getSigners();

        const {boundary: boundary01} = await grid01.slot0();
        const grid01BoundaryLower = await formatBoundaryToBoundaryLower(boundary01, Resolution.MEDIUM);

        // place maker orders to add liquidity of grids
        await makerOrderManager.placeMakerOrderInBatch({
            orders: [
                {
                    boundaryLower: grid01BoundaryLower - Resolution.MEDIUM * 2,
                    amount: 1000,
                },
                {
                    boundaryLower: grid01BoundaryLower - Resolution.MEDIUM,
                    amount: 1000,
                },
                {
                    boundaryLower: grid01BoundaryLower,
                    amount: 1000,
                },
                {
                    boundaryLower: grid01BoundaryLower + Resolution.MEDIUM,
                    amount: 1000,
                },
                {
                    boundaryLower: grid01BoundaryLower + Resolution.MEDIUM * 2,
                    amount: 1000,
                },
            ],
            resolution: Resolution.MEDIUM,
            tokenA: tokens[0].address,
            tokenB: tokens[1].address,
            zero: false,
            deadline: new Date().getTime(),
            recipient: signer.address,
        });

        await makerOrderManager.placeMakerOrderInBatch({
            orders: [
                {
                    boundaryLower: grid01BoundaryLower - Resolution.MEDIUM * 2,
                    amount: 1000,
                },
                {
                    boundaryLower: grid01BoundaryLower - Resolution.MEDIUM,
                    amount: 1000,
                },
                {
                    boundaryLower: grid01BoundaryLower,
                    amount: 1000,
                },
                {
                    boundaryLower: grid01BoundaryLower + Resolution.MEDIUM,
                    amount: 1000,
                },
                {
                    boundaryLower: grid01BoundaryLower + Resolution.MEDIUM * 2,
                    amount: 1000,
                },
            ],
            resolution: Resolution.MEDIUM,
            tokenA: tokens[0].address,
            tokenB: tokens[1].address,
            zero: true,
            deadline: new Date().getTime(),
            recipient: signer.address,
        });

        const {boundary: boundary12} = await grid12.slot0();
        const grid12BoundaryLower = await formatBoundaryToBoundaryLower(boundary12, Resolution.MEDIUM);

        await makerOrderManager.placeMakerOrderInBatch({
            orders: [
                {
                    boundaryLower: grid12BoundaryLower - Resolution.MEDIUM * 2,
                    amount: 1000,
                },
                {
                    boundaryLower: grid12BoundaryLower - Resolution.MEDIUM,
                    amount: 1000,
                },
                {
                    boundaryLower: grid12BoundaryLower,
                    amount: 1000,
                },
                {
                    boundaryLower: grid12BoundaryLower + Resolution.MEDIUM,
                    amount: 1000,
                },
                {
                    boundaryLower: grid12BoundaryLower + Resolution.MEDIUM * 2,
                    amount: 1000,
                },
            ],
            resolution: Resolution.MEDIUM,
            tokenA: tokens[1].address,
            tokenB: tokens[2].address,
            zero: false,
            deadline: new Date().getTime(),
            recipient: signer.address,
        });

        await makerOrderManager.placeMakerOrderInBatch({
            orders: [
                {
                    boundaryLower: grid12BoundaryLower - Resolution.MEDIUM * 2,
                    amount: 1000,
                },
                {
                    boundaryLower: grid12BoundaryLower - Resolution.MEDIUM,
                    amount: 1000,
                },
                {
                    boundaryLower: grid12BoundaryLower,
                    amount: 1000,
                },
                {
                    boundaryLower: grid12BoundaryLower + Resolution.MEDIUM,
                    amount: 1000,
                },
                {
                    boundaryLower: grid12BoundaryLower + Resolution.MEDIUM * 2,
                    amount: 1000,
                },
            ],
            resolution: Resolution.MEDIUM,
            tokenA: tokens[1].address,
            tokenB: tokens[2].address,
            zero: true,
            deadline: new Date().getTime(),
            recipient: signer.address,
        });

        return {
            signer,
            quoter,
            swapRouter,
            tokens,
            grid01,
            grid12,
        };
    }

    describe("#quoteExactOutput", function () {
        it("0 -> 1: should cross one boundary when amountOut is lower than make amount in the boundary crossed", async function () {
            const {quoter, swapRouter, tokens, grid01, signer} = await loadFixture(deployFixture);

            const token0BalanceBefore = await tokens[0].balanceOf(grid01.address);

            const amountOut = 100;
            const path = encodePath([tokens[1].address, tokens[0].address], [Resolution.MEDIUM], [1]);

            const {
                amountIn: quoteAmountIn,
                priceAfterList: quotePriceX96AfterList,
                initializedBoundariesCrossedList,
            } = await quoter.callStatic.quoteExactOutput(path, amountOut);

            // call swap router to get real result
            await swapRouter.exactOutput({
                path: path,
                recipient: signer.address,
                deadline: new Date().getTime(),
                amountOut: amountOut,
                amountInMaximum: 10000,
            });

            const token0BalanceAfter = await tokens[0].balanceOf(grid01.address);
            const amountIn = token0BalanceAfter.sub(token0BalanceBefore);
            const {priceX96: priceX96After} = await grid01.slot0();

            expect(quoteAmountIn).to.eq(amountIn);
            expect(quotePriceX96AfterList.length).to.eq(1);
            expect(initializedBoundariesCrossedList.length).to.eq(1);
            expect(quotePriceX96AfterList[0]).to.eq(priceX96After);
            expect(initializedBoundariesCrossedList[0]).to.eq(1);
        });

        it("0 -> 1: should cross multi boundaries when amountOut is higher than make amount in one of the boundaries crossed", async function () {
            const {quoter, swapRouter, tokens, grid01, signer} = await loadFixture(deployFixture);

            const token0BalanceBefore = await tokens[0].balanceOf(grid01.address);

            const amountOut = 1500;
            const path = encodePath([tokens[1].address, tokens[0].address], [Resolution.MEDIUM], [1]);

            const {
                amountIn: quoteAmountIn,
                priceAfterList: quotePriceX96AfterList,
                initializedBoundariesCrossedList,
            } = await quoter.callStatic.quoteExactOutput(path, amountOut);

            // call swap router to get real result
            await swapRouter.exactOutput({
                path: path,
                recipient: signer.address,
                deadline: new Date().getTime(),
                amountOut: amountOut,
                amountInMaximum: 10000,
            });

            const token0BalanceAfter = await tokens[0].balanceOf(grid01.address);
            const amountIn = token0BalanceAfter.sub(token0BalanceBefore);
            const {priceX96: priceX96After} = await grid01.slot0();

            expect(quoteAmountIn).to.eq(amountIn);
            expect(quotePriceX96AfterList.length).to.eq(1);
            expect(initializedBoundariesCrossedList.length).to.eq(1);
            expect(quotePriceX96AfterList[0]).to.eq(priceX96After);
            expect(initializedBoundariesCrossedList[0]).to.eq(2);
        });

        it("1 -> 0: should cross one boundary when amountOut is lower than make amount in the boundary crossed", async function () {
            const {quoter, swapRouter, tokens, grid01, signer} = await loadFixture(deployFixture);

            const token1BalanceBefore = await tokens[1].balanceOf(grid01.address);

            const amountOut = 100;
            const path = encodePath([tokens[0].address, tokens[1].address], [Resolution.MEDIUM], [1]);

            const {
                amountIn: quoteAmountIn,
                priceAfterList: quotePriceX96AfterList,
                initializedBoundariesCrossedList,
            } = await quoter.callStatic.quoteExactOutput(path, amountOut);

            // call swap router to get real result
            await swapRouter.exactOutput({
                path: path,
                recipient: signer.address,
                deadline: new Date().getTime(),
                amountOut: amountOut,
                amountInMaximum: 10000,
            });

            const token1BalanceAfter = await tokens[1].balanceOf(grid01.address);
            const amountIn = token1BalanceAfter.sub(token1BalanceBefore);
            const {priceX96: priceX96After} = await grid01.slot0();

            expect(quoteAmountIn).to.eq(amountIn);
            expect(quotePriceX96AfterList.length).to.eq(1);
            expect(initializedBoundariesCrossedList.length).to.eq(1);
            expect(quotePriceX96AfterList[0]).to.eq(priceX96After);
            expect(initializedBoundariesCrossedList[0]).to.eq(1);
        });

        it("1 -> 0: should cross multi boundaries when amountOut is higher than make amount in one of the boundaries crossed", async function () {
            const {quoter, swapRouter, tokens, grid01, signer} = await loadFixture(deployFixture);

            const token1BalanceBefore = await tokens[1].balanceOf(grid01.address);

            const amountOut = 1500;
            const path = encodePath([tokens[0].address, tokens[1].address], [Resolution.MEDIUM], [1]);

            const {
                amountIn: quoteAmountIn,
                priceAfterList: quotePriceX96AfterList,
                initializedBoundariesCrossedList,
            } = await quoter.callStatic.quoteExactOutput(path, amountOut);

            // call swap router to get real result
            await swapRouter.exactOutput({
                path: path,
                recipient: signer.address,
                deadline: new Date().getTime(),
                amountOut: amountOut,
                amountInMaximum: 10000,
            });

            const token1BalanceAfter = await tokens[1].balanceOf(grid01.address);
            const amountIn = token1BalanceAfter.sub(token1BalanceBefore);
            const {priceX96: priceX96After} = await grid01.slot0();

            expect(quoteAmountIn).to.eq(amountIn);
            expect(quotePriceX96AfterList.length).to.eq(1);
            expect(initializedBoundariesCrossedList.length).to.eq(1);
            expect(quotePriceX96AfterList[0]).to.eq(priceX96After);
            expect(initializedBoundariesCrossedList[0]).to.eq(2);
        });

        it("0 -> 1 -> 2: should cross one boundary when amountOut is lower than make amount in the boundary crossed", async function () {
            const {quoter, swapRouter, tokens, grid01, grid12, signer} = await loadFixture(deployFixture);

            const token0BalanceBefore = await tokens[0].balanceOf(grid01.address);

            const amountOut = 100;
            const path = encodePath(
                [tokens[2].address, tokens[1].address, tokens[0].address],
                [Resolution.MEDIUM, Resolution.MEDIUM],
                [1, 1]
            );

            const {
                amountIn: quoteAmountIn,
                priceAfterList: quotePriceX96AfterList,
                initializedBoundariesCrossedList,
            } = await quoter.callStatic.quoteExactOutput(path, amountOut);

            // call swap router to get real result
            await swapRouter.exactOutput({
                path: path,
                recipient: signer.address,
                deadline: new Date().getTime(),
                amountOut: amountOut,
                amountInMaximum: 10000,
            });

            const token0BalanceAfter = await tokens[0].balanceOf(grid01.address);
            const amountIn = token0BalanceAfter.sub(token0BalanceBefore);
            const {priceX96: priceX96After01} = await grid01.slot0();
            const {priceX96: priceX96After12} = await grid12.slot0();

            expect(quoteAmountIn).to.eq(amountIn);
            expect(quotePriceX96AfterList.length).to.eq(2);
            expect(initializedBoundariesCrossedList.length).to.eq(2);
            expect(quotePriceX96AfterList[1]).to.eq(priceX96After01);
            expect(quotePriceX96AfterList[0]).to.eq(priceX96After12);
            expect(initializedBoundariesCrossedList[1]).to.eq(1);
            expect(initializedBoundariesCrossedList[0]).to.eq(1);
        });

        it("0 -> 1 -> 2: should cross multi boundary when amountOut is higher than make amount in one of the boundaries crossed", async function () {
            const {quoter, swapRouter, tokens, grid01, grid12, signer} = await loadFixture(deployFixture);

            const token0BalanceBefore = await tokens[0].balanceOf(grid01.address);

            const amountOut = 1500;
            const path = encodePath(
                [tokens[2].address, tokens[1].address, tokens[0].address],
                [Resolution.MEDIUM, Resolution.MEDIUM],
                [1, 1]
            );

            const {
                amountIn: quoteAmountIn,
                priceAfterList: quotePriceX96AfterList,
                initializedBoundariesCrossedList,
            } = await quoter.callStatic.quoteExactOutput(path, amountOut);

            // call swap router to get real result
            await swapRouter.exactOutput({
                path: path,
                recipient: signer.address,
                deadline: new Date().getTime(),
                amountOut: amountOut,
                amountInMaximum: 10000,
            });

            const token0BalanceAfter = await tokens[0].balanceOf(grid01.address);
            const amountIn = token0BalanceAfter.sub(token0BalanceBefore);
            const {priceX96: priceX96After01} = await grid01.slot0();
            const {priceX96: priceX96After12} = await grid12.slot0();

            expect(quoteAmountIn).to.eq(amountIn);
            expect(quotePriceX96AfterList.length).to.eq(2);
            expect(initializedBoundariesCrossedList.length).to.eq(2);
            expect(quotePriceX96AfterList[1]).to.eq(priceX96After01);
            expect(quotePriceX96AfterList[0]).to.eq(priceX96After12);
            expect(initializedBoundariesCrossedList[1]).to.eq(2);
            expect(initializedBoundariesCrossedList[0]).to.eq(2);
        });

        it("2 -> 1 -> 0: should cross one boundary when amountOut is lower than make amount in the boundary crossed", async function () {
            const {quoter, swapRouter, tokens, grid01, grid12, signer} = await loadFixture(deployFixture);

            const token2BalanceBefore = await tokens[2].balanceOf(grid12.address);

            const amountOut = 100;
            const path = encodePath(
                [tokens[0].address, tokens[1].address, tokens[2].address],
                [Resolution.MEDIUM, Resolution.MEDIUM],
                [1, 1]
            );

            const {
                amountIn: quoteAmountIn,
                priceAfterList: quotePriceX96AfterList,
                initializedBoundariesCrossedList,
            } = await quoter.callStatic.quoteExactOutput(path, amountOut);

            // call swap router to get real result
            await swapRouter.exactOutput({
                path: path,
                recipient: signer.address,
                deadline: new Date().getTime(),
                amountOut: amountOut,
                amountInMaximum: 10000,
            });

            const token2BalanceAfter = await tokens[2].balanceOf(grid12.address);
            const amountIn = token2BalanceAfter.sub(token2BalanceBefore);
            const {priceX96: priceX96After01} = await grid01.slot0();
            const {priceX96: priceX96After12} = await grid12.slot0();

            expect(quoteAmountIn).to.eq(amountIn);
            expect(quotePriceX96AfterList.length).to.eq(2);
            expect(initializedBoundariesCrossedList.length).to.eq(2);
            expect(quotePriceX96AfterList[1]).to.eq(priceX96After12);
            expect(quotePriceX96AfterList[0]).to.eq(priceX96After01);
            expect(initializedBoundariesCrossedList[1]).to.eq(1);
            expect(initializedBoundariesCrossedList[0]).to.eq(1);
        });

        it("2 -> 1 -> 0: should cross multi boundary when amountOut is higher than make amount in one of the boundaries crossed", async function () {
            const {quoter, swapRouter, tokens, grid01, grid12, signer} = await loadFixture(deployFixture);

            const token2BalanceBefore = await tokens[2].balanceOf(grid12.address);

            const amountOut = 1500;
            const path = encodePath(
                [tokens[0].address, tokens[1].address, tokens[2].address],
                [Resolution.MEDIUM, Resolution.MEDIUM],
                [1, 1]
            );

            const {
                amountIn: quoteAmountIn,
                priceAfterList: quotePriceX96AfterList,
                initializedBoundariesCrossedList,
            } = await quoter.callStatic.quoteExactOutput(path, amountOut);

            // call swap router to get real result
            await swapRouter.exactOutput({
                path: path,
                recipient: signer.address,
                deadline: new Date().getTime(),
                amountOut: amountOut,
                amountInMaximum: 10000,
            });

            const token2BalanceAfter = await tokens[2].balanceOf(grid12.address);
            const amountIn = token2BalanceAfter.sub(token2BalanceBefore);
            const {priceX96: priceX96After01} = await grid01.slot0();
            const {priceX96: priceX96After12} = await grid12.slot0();

            expect(quoteAmountIn).to.eq(amountIn);
            expect(quotePriceX96AfterList.length).to.eq(2);
            expect(initializedBoundariesCrossedList.length).to.eq(2);
            expect(quotePriceX96AfterList[1]).to.eq(priceX96After12);
            expect(quotePriceX96AfterList[0]).to.eq(priceX96After01);
            expect(initializedBoundariesCrossedList[1]).to.eq(2);
            expect(initializedBoundariesCrossedList[0]).to.eq(2);
        });
    });

    describe("#quoteExactInput", function () {
        it("0 -> 1: should cross one boundary when amountOut is lower than make amount in the boundary crossed", async function () {
            const {quoter, swapRouter, tokens, grid01, signer} = await loadFixture(deployFixture);

            const token1BalanceBefore = await tokens[1].balanceOf(grid01.address);

            const amountIn = 100;
            const path = encodePath([tokens[0].address, tokens[1].address], [Resolution.MEDIUM], [1]);

            const {
                amountOut: quoteAmountOut,
                priceAfterList: quotePriceX96AfterList,
                initializedBoundariesCrossedList,
            } = await quoter.callStatic.quoteExactInput(path, amountIn);

            // call swap router to get real result
            await swapRouter.exactInput({
                path: path,
                recipient: signer.address,
                deadline: new Date().getTime(),
                amountIn: amountIn,
                amountOutMinimum: 1,
            });

            const token1BalanceAfter = await tokens[1].balanceOf(grid01.address);
            const amountOut = token1BalanceBefore.sub(token1BalanceAfter);
            const {priceX96: priceX96After} = await grid01.slot0();

            expect(quoteAmountOut).to.eq(amountOut);
            expect(quotePriceX96AfterList.length).to.eq(1);
            expect(initializedBoundariesCrossedList.length).to.eq(1);
            expect(quotePriceX96AfterList[0]).to.eq(priceX96After);
            expect(initializedBoundariesCrossedList[0]).to.eq(1);
        });

        it("0 -> 1: should cross multi boundaries when amountOut is higher than make amount in one of the boundaries crossed", async function () {
            const {quoter, swapRouter, tokens, grid01, signer} = await loadFixture(deployFixture);

            const token1BalanceBefore = await tokens[1].balanceOf(grid01.address);

            const amountIn = 1500;
            const path = encodePath([tokens[0].address, tokens[1].address], [Resolution.MEDIUM], [1]);

            const {
                amountOut: quoteAmountOut,
                priceAfterList: quotePriceX96AfterList,
                initializedBoundariesCrossedList,
            } = await quoter.callStatic.quoteExactInput(path, amountIn);

            // call swap router to get real result
            await swapRouter.exactInput({
                path: path,
                recipient: signer.address,
                deadline: new Date().getTime(),
                amountIn: amountIn,
                amountOutMinimum: 1,
            });

            const token1BalanceAfter = await tokens[1].balanceOf(grid01.address);
            const amountOut = token1BalanceBefore.sub(token1BalanceAfter);
            const {priceX96: priceX96After} = await grid01.slot0();

            expect(quoteAmountOut).to.eq(amountOut);
            expect(quotePriceX96AfterList.length).to.eq(1);
            expect(initializedBoundariesCrossedList.length).to.eq(1);
            expect(quotePriceX96AfterList[0]).to.eq(priceX96After);
            expect(initializedBoundariesCrossedList[0]).to.eq(2);
        });

        it("0 -> 1 -> 2: should cross one boundary when amountOut is lower than make amount in the boundary crossed", async function () {
            const {quoter, swapRouter, tokens, grid01, grid12, signer} = await loadFixture(deployFixture);

            const token2BalanceBefore = await tokens[2].balanceOf(grid12.address);

            const amountIn = 100;
            const path = encodePath(
                [tokens[0].address, tokens[1].address, tokens[2].address],
                [Resolution.MEDIUM, Resolution.MEDIUM],
                [1, 1]
            );

            const {
                amountOut: quoteAmountOut,
                priceAfterList: quotePriceX96AfterList,
                initializedBoundariesCrossedList,
            } = await quoter.callStatic.quoteExactInput(path, amountIn);

            // call swap router to get real result
            await swapRouter.exactInput({
                path: path,
                recipient: signer.address,
                deadline: new Date().getTime(),
                amountIn: amountIn,
                amountOutMinimum: 1,
            });

            const token2BalanceAfter = await tokens[2].balanceOf(grid12.address);
            const amountOut = token2BalanceBefore.sub(token2BalanceAfter);
            const {priceX96: priceX96After01} = await grid01.slot0();
            const {priceX96: priceX96After12} = await grid12.slot0();

            expect(quoteAmountOut).to.eq(amountOut);
            expect(quotePriceX96AfterList.length).to.eq(2);
            expect(initializedBoundariesCrossedList.length).to.eq(2);
            expect(quotePriceX96AfterList[1]).to.eq(priceX96After12);
            expect(quotePriceX96AfterList[0]).to.eq(priceX96After01);
            expect(initializedBoundariesCrossedList[1]).to.eq(1);
            expect(initializedBoundariesCrossedList[0]).to.eq(1);
        });

        it("0 -> 1 -> 2: should cross multi boundary when amountOut is higher than make amount in one of the boundaries crossed", async function () {
            const {quoter, swapRouter, tokens, grid01, grid12, signer} = await loadFixture(deployFixture);

            const token2BalanceBefore = await tokens[2].balanceOf(grid12.address);

            const amountIn = 1500;
            const path = encodePath(
                [tokens[0].address, tokens[1].address, tokens[2].address],
                [Resolution.MEDIUM, Resolution.MEDIUM],
                [1, 1]
            );

            const {
                amountOut: quoteAmountOut,
                priceAfterList: quotePriceX96AfterList,
                initializedBoundariesCrossedList,
            } = await quoter.callStatic.quoteExactInput(path, amountIn);

            // call swap router to get real result
            await swapRouter.exactInput({
                path: path,
                recipient: signer.address,
                deadline: new Date().getTime(),
                amountIn: amountIn,
                amountOutMinimum: 1,
            });

            const token2BalanceAfter = await tokens[2].balanceOf(grid12.address);
            const amountOut = token2BalanceBefore.sub(token2BalanceAfter);
            const {priceX96: priceX96After01} = await grid01.slot0();
            const {priceX96: priceX96After12} = await grid12.slot0();

            expect(quoteAmountOut).to.eq(amountOut);
            expect(quotePriceX96AfterList.length).to.eq(2);
            expect(initializedBoundariesCrossedList.length).to.eq(2);
            expect(quotePriceX96AfterList[1]).to.eq(priceX96After12);
            expect(quotePriceX96AfterList[0]).to.eq(priceX96After01);
            expect(initializedBoundariesCrossedList[1]).to.eq(2);
            expect(initializedBoundariesCrossedList[0]).to.eq(2);
        });
    });
});
