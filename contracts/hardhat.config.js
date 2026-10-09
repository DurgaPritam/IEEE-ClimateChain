require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const { DEPLOYER_PRIVATE_KEY, AMOY_RPC_URL, SEPOLIA_RPC_URL, POLYGONSCAN_API_KEY, ETHERSCAN_API_KEY } = process.env;
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    amoy: { url: AMOY_RPC_URL || "https://rpc-amoy.polygon.technology", accounts, chainId: 80002 },
    sepolia: { url: SEPOLIA_RPC_URL || "https://rpc.sepolia.org", accounts, chainId: 11155111 },
  },
  etherscan: {
    apiKey: { polygonAmoy: POLYGONSCAN_API_KEY || "", sepolia: ETHERSCAN_API_KEY || "" },
  },
};
