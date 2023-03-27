import {ethers} from "hardhat";
import {
    ERC20Test,
    IERC20,
    IGridFactory,
    IWETHMinimum,
    MakerOrderManager,
    Quoter,
    SwapRouterHub,
} from "../../typechain-types";
import {BigNumberish, ContractFactory} from "ethers";
import {MAX_UINT_128} from "./util";
import {bytecode} from "@gridexprotocol/core/artifacts/contracts/Grid.sol/Grid.json";
import {isHexPrefixed} from "hardhat/internal/hardhat-network/provider/utils/isHexPrefixed";

export const deployWETH = async () => {
    const WETH9 = require("../contracts/WETH9.json");
    const contractFactory = (await ethers.getContractFactory(WETH9.abi, WETH9.bytecode)) as ContractFactory;
    const weth = await contractFactory.deploy();
    await weth.deployed();
    return weth as IWETHMinimum;
};

export const deployGridFactory = async (weth9: string) => {
    const gridFactoryJSON = require("@gridexprotocol/core/artifacts/contracts/GridFactory.sol/GridFactory.json");
    const gridFactoryContractFactory = (await ethers.getContractFactory(
        gridFactoryJSON.abi,
        gridFactoryJSON.bytecode
    )) as ContractFactory;

    const bytecodeBytes = hexToBytes(bytecode);
    const prefixLength = Math.floor(bytecodeBytes.length / 2);
    const gridFactory = (await gridFactoryContractFactory.deploy(
        weth9,
        bytecodeBytes.slice(0, prefixLength)
    )) as IGridFactory;
    await gridFactory.deployed();
    await gridFactory.concatGridSuffixCreationCode(bytecodeBytes.slice(prefixLength));

    return {
        gridFactory,
    };
};

function hexToBytes(hex: string) {
    if (isHexPrefixed(hex)) {
        hex = hex.substring(2);
    }
    let bytes = [];
    for (let c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}

export const deploySwapRouter = async (gridFactoryAddress: string, weth9Address: string) => {
    const contractFactory = await ethers.getContractFactory("SwapRouterHub");
    const swapRouter = await contractFactory.deploy(
        gridFactoryAddress,
        gridFactoryAddress,
        gridFactoryAddress,
        weth9Address
    );
    await swapRouter.deployed();
    return swapRouter as SwapRouterHub;
};

export const deployERC20 = async (
    name: string,
    symbol: string,
    decimals: number,
    initialSupply: BigNumberish | undefined
) => {
    const [signer] = await ethers.getSigners();
    const contractFactory = await ethers.getContractFactory("ERC20Test", signer);
    const erc20 = await contractFactory.deploy(name, symbol, decimals, initialSupply == undefined ? 0 : initialSupply);
    await erc20.deployed();
    return erc20 as IERC20;
};

export const deployERC20Tokens = async () => {
    const tokenFactory = await ethers.getContractFactory("ERC20Test");
    const tokens: [ERC20Test, ERC20Test, ERC20Test] = [
        (await tokenFactory.deploy("Test ERC20", "Test", 18, MAX_UINT_128.div(2))) as ERC20Test,
        (await tokenFactory.deploy("Test ERC20", "Test", 18, MAX_UINT_128.div(2))) as ERC20Test,
        (await tokenFactory.deploy("Test ERC20", "Test", 18, MAX_UINT_128.div(2))) as ERC20Test,
    ];

    const promises: Promise<ERC20Test>[] = [];
    for (let t of tokens) {
        promises.push(t.deployed());
    }
    await Promise.all(promises);

    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1));
    return tokens;
};

export const deployMakerOrderManager = async (gridFactory: IGridFactory, weth: IWETHMinimum) => {
    const contractFactory = await ethers.getContractFactory("MakerOrderManager");
    const makerOrderManager = await contractFactory.deploy(gridFactory.address, weth.address);

    await makerOrderManager.deployed();
    return makerOrderManager as MakerOrderManager;
};

export const deployQuoter = async (gridFactory: IGridFactory, weth: IWETHMinimum) => {
    const contractFactory = await ethers.getContractFactory("Quoter");
    const quote = await contractFactory.deploy(
        gridFactory.address,
        gridFactory.address,
        gridFactory.address,
        weth.address
    );
    await quote.deployed();
    return quote as Quoter;
};
