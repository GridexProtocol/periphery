import {ethers} from "hardhat";
import {SwapPathTest} from "../typechain-types";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "./shared/expect";
import {decodePath, encodePath} from "./shared/path";
import {Resolution} from "./shared/util";

describe("Path", () => {
    let tokenAddresses = [
        "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
        "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
        "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    ];

    let resolutions = [Resolution.LOW, Resolution.MEDIUM];

    let protocols = [1, 1];

    async function deployFixture() {
        const contractFactory = await ethers.getContractFactory("SwapPathTest");
        return (await contractFactory.deploy()) as SwapPathTest;
    }

    it("should js encoding works as expected", async function () {
        let expectedPath =
            "0x" +
            tokenAddresses
                .slice(0, 2)
                .map((tokenAddresses) => tokenAddresses.slice(2).toLowerCase())
                .join("01000001");
        expect(encodePath(tokenAddresses.slice(0, 2), resolutions.slice(0, 1), protocols.slice(0, 1))).to.be.eq(
            expectedPath
        );
        // expect(
        //   encodePath(tokenAddresses.slice(0, 2), resolutions.slice(0, 1))
        // ).to.matchSnapshot();
    });

    it("should js decoding works as expected", async function () {
        const encodedPath = encodePath(tokenAddresses, resolutions, protocols);
        const [decodedTokens, decodedProtocols, decodedResolution] = decodePath(encodedPath);
        expect(decodedTokens).to.deep.eq(tokenAddresses);
        expect(decodedResolution).to.deep.eq(resolutions);
        expect(decodedProtocols).to.deep.eq(protocols);
    });

    describe("#hasMultipleGrids", () => {
        it("should be true", async function () {
            const path = await loadFixture(deployFixture);
            const encodedPath = encodePath(tokenAddresses, resolutions, protocols);
            expect(await path.hasMultipleGrids(encodedPath)).to.be.true;
        });

        it("should be false", async function () {
            const path = await loadFixture(deployFixture);
            const encodedPath = encodePath(tokenAddresses.slice(0, 2), resolutions.slice(0, 1), protocols.slice(0, 1));
            expect(await path.hasMultipleGrids(encodedPath)).to.be.false;
        });
    });

    describe("#decodeFirstGrid", () => {
        it("should return a right grid if the path contains one grid be given", async function () {
            const path = await loadFixture(deployFixture);
            const encodedPath = encodePath(tokenAddresses.slice(0, 2), resolutions.slice(0, 1), protocols.slice(0, 1));
            const {tokenA, tokenB, resolution} = await path.decodeFirstGrid(encodedPath);
            expect(tokenA).to.be.eq(tokenAddresses[0]);
            expect(tokenB).to.be.eq(tokenAddresses[1]);
            expect(resolution).to.be.eq(resolutions[0]);
        });

        it("should return a right grid if the path contains multiple grids be given", async function () {
            const path = await loadFixture(deployFixture);
            const encodedPath = encodePath(tokenAddresses, resolutions, protocols);
            const {tokenA, tokenB, resolution} = await path.decodeFirstGrid(encodedPath);
            expect(tokenA).to.be.eq(tokenAddresses[0]);
            expect(tokenB).to.be.eq(tokenAddresses[1]);
            expect(resolution).to.be.eq(resolutions[0]);
        });
    });

    describe("#getFirstGrid", () => {
        let expectedFirstGridPath =
            "0x" +
            tokenAddresses
                .slice(0, 2)
                .map((tokenAddresses) => tokenAddresses.slice(2).toLowerCase())
                .join("01000001");

        it("should get a right first grid if the path contains one grid be given", async function () {
            const path = await loadFixture(deployFixture);
            const encodedPath = encodePath(tokenAddresses.slice(0, 2), resolutions.slice(0, 1), protocols.slice(0, 1));

            expect(await path.getFirstGrid(encodedPath)).to.be.eq(expectedFirstGridPath);
            // expect(await path.getFirstGrid(encodedPath)).to.be.matchSnapshot();
        });

        it("should get a right first grid if the path contains multiple grids be given", async function () {
            const path = await loadFixture(deployFixture);
            const encodedPath = encodePath(tokenAddresses, resolutions, protocols);
            expect(await path.getFirstGrid(encodedPath)).to.be.eq(expectedFirstGridPath);
            // expect(await path.getFirstGrid(encodedPath)).to.be.matchSnapshot();
        });
    });

    describe("#skipToken", () => {
        it("should get a empty byte array if the path contains one grid be given", async function () {
            const path = await loadFixture(deployFixture);
            const encodedPath = encodePath(tokenAddresses.slice(0, 2), resolutions.slice(0, 1), protocols.slice(0, 1));
            let expectedFirstGridPath = "0x" + tokenAddresses[1].slice(2).toLowerCase();
            expect(await path.skipToken(encodedPath)).to.be.eq(expectedFirstGridPath);
        });

        it("should get a right last bytes if the path contains multiple grids be given", async function () {
            const path = await loadFixture(deployFixture);
            const encodedPath = encodePath(tokenAddresses, resolutions, protocols);
            let expectedPath =
                "0x" +
                tokenAddresses
                    .slice(1, 3)
                    .map((tokenAddresses) => tokenAddresses.slice(2).toLowerCase())
                    .join("01000005");
            expect(await path.skipToken(encodedPath)).to.be.eq(expectedPath);
            // expect(await path.skipToken(encodedPath)).to.be.matchSnapshot();
        });
    });
});
