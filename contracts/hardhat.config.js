require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const { DEPLOYER_PRIVATE_KEY, AMOY_RPC_URL, SEPOLIA_RPC_URL, POLYGONSCAN_API_KEY, ETHERSCAN_API_KEY } = process.env;
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    amoy: { url: AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com", accounts, chainId: 80002, gasPrice: 30_000_000_000 },
    sepolia: { url: SEPOLIA_RPC_URL || "https://rpc.sepolia.org", accounts, chainId: 11155111 },
  },
  // Etherscan API V2: one key covers every supported chain, Polygon Amoy included.
  etherscan: { apiKey: ETHERSCAN_API_KEY || POLYGONSCAN_API_KEY || "" },
  sourcify: { enabled: false },
};
