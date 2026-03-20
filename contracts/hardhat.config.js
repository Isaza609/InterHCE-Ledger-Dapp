require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const sepoliaUrl = process.env.SEPOLIA_RPC_URL || "";
const privateKey = process.env.DEPLOYER_PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: sepoliaUrl,
      accounts: privateKey ? [privateKey] : []
    }
  }
};
