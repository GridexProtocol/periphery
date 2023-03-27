import {ethers} from "hardhat";
import {BoundaryMathTest, GridBoundariesCounterTest, MockGrid} from "../typechain-types";
import {Resolution} from "./shared/util";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "./shared/expect";

describe("GridBoundariesCounter", () => {
    const gridBoundariesCounterFixture = async () => {
        const [signer] = await ethers.getSigners();
        const contractFactory = await ethers.getContractFactory("GridBoundariesCounterTest", signer);
        const gridBoundariesCounter = (await contractFactory.deploy()) as GridBoundariesCounterTest;
        const mockGridFactory = await ethers.getContractFactory("MockGrid", signer);
        const mockGrid = (await mockGridFactory.deploy()) as MockGrid;

        const boundaryMathFactory = await ethers.getContractFactory("BoundaryMathTest", signer);
        const boundaryMath = (await boundaryMathFactory.deploy()) as BoundaryMathTest;
        return {mockGrid, gridBoundariesCounter, boundaryMath};
    };

    // Bit position to boundary
    const bitPosToBoundary = (resolution: number, bitPos: number, wordPos = 0) => {
        return (bitPos + (wordPos << 8)) * resolution;
    };

    describe(`[Resolution: ${Resolution.HIGH}]: Upwards (OneForZero)`, () => {
        const resolution = Resolution.HIGH;
        const zeroForOne = false;
        it("same boundary initialized", async () => {
            const wordPos = 0;
            const bitPos = 2;
            const wordPosInBitmaps = 0;
            const bitPosInBitmaps = 0b1100; //1100

            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(wordPosInBitmaps, bitPosInBitmaps);
            const boundaryLowerBefore = bitPosToBoundary(resolution, bitPos, wordPos);
            const boundaryLowerAfter = boundaryLowerBefore;
            const boundaryBefore = boundaryLowerBefore + 10;
            const boundaryAfter = boundaryBefore + 10;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(1);
        });

        it("same boundary not initialized", async () => {
            const wordPos = 0;
            const bitPos = 1;
            const wordPosInBitmaps = 0;
            const bitPosInBitmaps = 0b1100; //1100

            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(wordPosInBitmaps, bitPosInBitmaps);
            const boundaryLowerBefore = bitPosToBoundary(resolution, bitPos, wordPos);
            const boundaryLowerAfter = boundaryLowerBefore;
            const boundaryBefore = boundaryLowerBefore + 10;
            const boundaryAfter = boundaryBefore + 10;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(0);
        });

        it("same word pos", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, 0b1111000100001110); /// 1111000100001111
            let boundaryLowerBefore = bitPosToBoundary(resolution, 8, 0);
            let boundaryLowerAfter = bitPosToBoundary(resolution, 255, 0);
            let boundaryBefore = boundaryLowerBefore + 10;
            let boundaryAfter = boundaryLowerAfter + 10;
            let priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            let priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            let result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(5);

            boundaryLowerBefore = bitPosToBoundary(resolution, 0, 0);
            boundaryLowerAfter = bitPosToBoundary(resolution, 2, 0);
            boundaryBefore = boundaryLowerBefore + 10;
            boundaryAfter = boundaryLowerAfter + 10;
            priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(2);

            boundaryLowerBefore = bitPosToBoundary(resolution, 2, 0);
            boundaryLowerAfter = bitPosToBoundary(resolution, 5, 0);
            boundaryBefore = boundaryLowerBefore + 10;
            boundaryAfter = boundaryLowerAfter + 10;
            priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(2);
        });

        it("multiple word pos", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, 0b1111000100001111); /// 1111000100001111
            await mockGrid.setBoundaryBitmaps0(1, 0b1111000100001111); /// 1111000100001111
            const boundaryLowerBefore = bitPosToBoundary(resolution, 8, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 8, 1);
            const boundaryBefore = boundaryLowerBefore + 10;
            const boundaryAfter = boundaryLowerAfter + 10;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(10);
        });

        it("counts all boundaries in a word page", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, ethers.constants.MaxUint256);
            await mockGrid.setBoundaryBitmaps0(1, 0x0);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 0, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 255, 1);
            const boundaryBefore = boundaryLowerBefore;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(256);
        });

        it("counts boundaries contains before expect after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 0, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 8, 0);
            const boundaryBefore = boundaryLowerBefore + 1;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(8);
        });

        it("counts boundaries expect before contains after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 0, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 8, 0);
            const boundaryBefore = boundaryLowerBefore + resolution;
            const boundaryAfter = boundaryLowerAfter + 1;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(8);
        });

        it("counts boundaries expect before and after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 0, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 8, 0);
            const boundaryBefore = boundaryLowerBefore + resolution;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(7);
        });

        it("counts boundaries contains before and after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 0, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 8, 0);
            const boundaryBefore = boundaryLowerBefore;
            const boundaryAfter = boundaryLowerAfter + resolution;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(9);
        });
    });

    describe(`[Resolution: ${Resolution.HIGH}]: Downwards (ZeroForOne)`, () => {
        const resolution = Resolution.HIGH;
        const zeroForOne = true;
        it("same boundary initialized", async () => {
            const wordPos = 0;
            const bitPos = 2;
            const wordPosInBitmaps = 0;
            const bitPosInBitmaps = 0b1100; //1100

            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(wordPosInBitmaps, bitPosInBitmaps);
            const boundaryLowerBefore = bitPosToBoundary(resolution, bitPos, wordPos);
            const boundaryLowerAfter = boundaryLowerBefore;
            const boundaryBefore = boundaryLowerBefore + 20;
            const boundaryAfter = boundaryLowerAfter + 10;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(1);
        });

        it("same boundary not initialized", async () => {
            const wordPos = 0;
            const bitPos = 1;
            const wordPosInBitmaps = 0;
            const bitPosInBitmaps = 0b1100; //1100

            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(wordPosInBitmaps, bitPosInBitmaps);
            const boundaryLowerBefore = bitPosToBoundary(resolution, bitPos, wordPos);
            const boundaryLowerAfter = boundaryLowerBefore;
            const boundaryBefore = boundaryLowerBefore + 20;
            const boundaryAfter = boundaryLowerAfter + 10;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(0);
        });

        it("same word pos", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, 0b1111000100001110); /// 1111000100001111
            let boundaryLowerBefore = bitPosToBoundary(resolution, 255, 0);
            let boundaryLowerAfter = bitPosToBoundary(resolution, 8, 0);
            let boundaryBefore = boundaryLowerBefore + 10;
            let boundaryAfter = boundaryLowerAfter + 10;
            let priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            let priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            let result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(5);

            boundaryLowerBefore = bitPosToBoundary(resolution, 2, 0);
            boundaryLowerAfter = bitPosToBoundary(resolution, 0, 0);
            boundaryBefore = boundaryLowerBefore + 10;
            boundaryAfter = boundaryLowerAfter + 10;
            priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(2);

            boundaryLowerBefore = bitPosToBoundary(resolution, 5, 0);
            boundaryLowerAfter = bitPosToBoundary(resolution, 2, 0);
            boundaryBefore = boundaryLowerBefore + 10;
            boundaryAfter = boundaryLowerAfter + 10;
            priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(2);
        });

        it("multiple word pos", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, 0b1111000100001111); /// 1111000100001111
            await mockGrid.setBoundaryBitmaps1(1, 0b1111000100001111); /// 1111000100001111
            const boundaryLowerBefore = bitPosToBoundary(resolution, 8, 1);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 8, 0);
            const boundaryBefore = boundaryLowerBefore + 10;
            const boundaryAfter = boundaryLowerAfter + 10;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(10);
        });

        it("counts all boundaries in a word page", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, ethers.constants.MaxUint256);
            await mockGrid.setBoundaryBitmaps1(1, 0x0);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 255, 1);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 0, 0);
            const boundaryBefore = boundaryLowerBefore + 1;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(256);
        });

        it("counts boundaries contains before expect after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 8, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 0, 0);
            const boundaryBefore = boundaryLowerBefore + 1;
            const boundaryAfter = boundaryLowerAfter + resolution;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(8);
        });

        it("counts boundaries expect before contains after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 8, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 0, 0);
            const boundaryBefore = boundaryLowerBefore;
            const boundaryAfter = boundaryLowerAfter + 1;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(8);
        });

        it("counts boundaries expect before and after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 8, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 0, 0);
            const boundaryBefore = boundaryLowerBefore;
            const boundaryAfter = boundaryLowerAfter + resolution;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(7);
        });

        it("counts boundaries contains before and after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 8, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 0, 0);
            const boundaryBefore = boundaryLowerBefore + resolution;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(9);
        });
    });

    describe(`[Resolution: ${Resolution.LOW}]: Upwards (OneForZero)`, () => {
        const resolution = Resolution.LOW;
        const zeroForOne = false;
        it("same boundary initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, 0b1100); //1100
            const boundaryLowerBefore = bitPosToBoundary(resolution, 2, 0);
            const boundaryLowerAfter = boundaryLowerBefore;
            const boundaryBefore = boundaryLowerBefore;
            const boundaryAfter = boundaryBefore + 1;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(1);
        });

        it("same boundary not initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, 0b1100); //1100
            const boundaryLowerBefore = bitPosToBoundary(resolution, 1, 0);
            const boundaryLowerAfter = boundaryLowerBefore;
            const boundaryBefore = boundaryLowerBefore;
            const boundaryAfter = boundaryBefore + 1;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(0);
        });

        it("same word pos", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, 0b1111000100001110); /// 1111000100001111
            let boundaryLowerBefore = bitPosToBoundary(resolution, 8, 0);
            let boundaryLowerAfter = bitPosToBoundary(resolution, 255, 0);
            let boundaryBefore = boundaryLowerBefore;
            let boundaryAfter = boundaryLowerAfter + 1;
            let priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            let priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            let result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(5);

            boundaryLowerBefore = bitPosToBoundary(resolution, 0, 0);
            boundaryLowerAfter = bitPosToBoundary(resolution, 2, 0);
            boundaryBefore = boundaryLowerBefore;
            boundaryAfter = boundaryLowerAfter + 1;
            priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(2);

            boundaryLowerBefore = bitPosToBoundary(resolution, 2, 0);
            boundaryLowerAfter = bitPosToBoundary(resolution, 5, 0);
            boundaryBefore = boundaryLowerBefore;
            boundaryAfter = boundaryLowerAfter + 1;
            priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(2);
        });

        it("multiple word pos", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, 0b1111000100001111); /// 1111000100001111
            await mockGrid.setBoundaryBitmaps0(1, 0b1111000100001111); /// 1111000100001111
            const boundaryLowerBefore = bitPosToBoundary(resolution, 8, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 8, 1);
            const boundaryBefore = boundaryLowerBefore;
            const boundaryAfter = boundaryLowerAfter + 1;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(10);
        });

        it("counts all boundaries in a word page", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, ethers.constants.MaxUint256);
            await mockGrid.setBoundaryBitmaps0(1, 0x0);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 0, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 255, 1);
            const boundaryBefore = boundaryLowerBefore;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(256);
        });

        it("counts boundaries contains before expect after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 0, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 8, 0);
            const boundaryBefore = boundaryLowerBefore;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(8);
        });

        it("counts boundaries expect before contains after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 0, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 8, 0);
            const boundaryBefore = boundaryLowerBefore + resolution;
            const boundaryAfter = boundaryLowerAfter + 1;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(8);
        });

        it("counts boundaries expect before and after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 0, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 8, 0);
            const boundaryBefore = boundaryLowerBefore + resolution;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(7);
        });

        it("counts boundaries contains before and after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps0(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 0, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 8, 0);
            const boundaryBefore = boundaryLowerBefore;
            const boundaryAfter = boundaryLowerAfter + resolution;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(9);
        });
    });

    describe(`[Resolution: ${Resolution.LOW}]: Downwards (ZeroForOne)`, () => {
        const resolution = Resolution.LOW;
        const zeroForOne = true;
        it("same boundary initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, 0b1100); //1100
            const boundaryLowerBefore = bitPosToBoundary(resolution, 2, 0);
            const boundaryLowerAfter = boundaryLowerBefore;
            const boundaryBefore = boundaryLowerBefore + 1;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(1);
        });

        it("same boundary not initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, 0b1100); //1100
            const boundaryLowerBefore = bitPosToBoundary(resolution, 1, 0);
            const boundaryLowerAfter = boundaryLowerBefore;
            const boundaryBefore = boundaryLowerBefore + 1;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(0);
        });

        it("same word pos", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, 0b1111000100001110); /// 1111000100001111
            let boundaryLowerBefore = bitPosToBoundary(resolution, 255, 0);
            let boundaryLowerAfter = bitPosToBoundary(resolution, 8, 0);
            let boundaryBefore = boundaryLowerBefore + 1;
            let boundaryAfter = boundaryLowerAfter;
            let priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            let priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            let result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(5);

            boundaryLowerBefore = bitPosToBoundary(resolution, 2, 0);
            boundaryLowerAfter = bitPosToBoundary(resolution, 0, 0);
            boundaryBefore = boundaryLowerBefore + 1;
            boundaryAfter = boundaryLowerAfter;
            priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(2);

            boundaryLowerBefore = bitPosToBoundary(resolution, 5, 0);
            boundaryLowerAfter = bitPosToBoundary(resolution, 2, 0);
            boundaryBefore = boundaryLowerBefore + 1;
            boundaryAfter = boundaryLowerAfter;
            priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(2);
        });

        it("multiple word pos", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, 0b1111000100001111); /// 1111000100001111
            await mockGrid.setBoundaryBitmaps1(1, 0b1111000100001111); /// 1111000100001111
            const boundaryLowerBefore = bitPosToBoundary(resolution, 8, 1);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 8, 0);
            const boundaryBefore = boundaryLowerBefore + 1;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(10);
        });

        it("counts all boundaries in a word page", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, ethers.constants.MaxUint256);
            await mockGrid.setBoundaryBitmaps1(1, 0x0);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 255, 1);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 0, 0);
            const boundaryBefore = boundaryLowerBefore;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(256);
        });

        it("counts boundaries contains before expect after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 8, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 0, 0);
            const boundaryBefore = boundaryLowerBefore + 1;
            const boundaryAfter = boundaryLowerAfter + resolution;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(8);
        });

        it("counts boundaries expect before contains after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 8, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 0, 0);
            const boundaryBefore = boundaryLowerBefore;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(8);
        });

        it("counts boundaries expect before and after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 8, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 0, 0);
            const boundaryBefore = boundaryLowerBefore;
            const boundaryAfter = boundaryLowerAfter + resolution;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(7);
        });

        it("counts boundaries contains before and after initialized", async () => {
            const {mockGrid, gridBoundariesCounter, boundaryMath} = await loadFixture(gridBoundariesCounterFixture);
            await mockGrid.setResolution(resolution);
            await mockGrid.setBoundaryBitmaps1(0, ethers.constants.MaxUint256);
            const boundaryLowerBefore = bitPosToBoundary(resolution, 8, 0);
            const boundaryLowerAfter = bitPosToBoundary(resolution, 0, 0);
            const boundaryBefore = boundaryLowerBefore + resolution;
            const boundaryAfter = boundaryLowerAfter;
            const priceBefore = await boundaryMath.getPriceX96AtBoundary(boundaryBefore);
            const priceAfter = await boundaryMath.getPriceX96AtBoundary(boundaryAfter);
            const result = await gridBoundariesCounter.countInitializedBoundariesCrossed(
                mockGrid.address,
                zeroForOne,
                priceBefore,
                boundaryBefore,
                boundaryLowerBefore,
                priceAfter,
                boundaryAfter,
                boundaryLowerAfter
            );

            expect(result).to.be.eq(9);
        });
    });
});
