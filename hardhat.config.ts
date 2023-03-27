import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-contract-sizer";

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    solidity: {
        compilers: [
            {
                version: "0.8.9",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1e8,
                    },
                },
            },
        ],
        overrides: {
            "contracts/SwapRouterHub.sol": {
                version: "0.8.9",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1e4,
                    },
                },
            },
        },
    },
    networks: {
        goerli: {
            url: `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_GOERLI_KEY}`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        sepolia: {
            url: `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        eth: {
            url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_MAINNET_KEY}`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        polygon: {
            url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_POLYGON_KEY}`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        optimism: {
            url: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_OPTIMISM_KEY}`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
        arbitrum: {
            url: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ARBITRUM_KEY}`,
            accounts: [`${process.env.PRIVATE_KEY}`],
        },
    },
    etherscan: {
        apiKey: {
            mainnet: `${process.env.ETHERSCAN_API_KEY}`,
            goerli: `${process.env.ETHERSCAN_API_KEY}`,
            arbitrumOne: `${process.env.ARBISCAN_API_KEY}`
        },
    },
    gasReporter: {},
    contractSizer: {
        runOnCompile: `${process.env.REPORT_SIZE}` == "true",
    },
};

export default config;