require("@nomiclabs/hardhat-waffle");
require('@openzeppelin/hardhat-upgrades');
require("@nomiclabs/hardhat-etherscan");
require('dotenv').config()
require("hardhat-contract-sizer");
require("solidity-coverage");

const { deployerWalletPrivateKey } = require('./secrets.json');
const { etherscanAPIkey } = require('./secrets.json');
const { alchemyAPIkey } = require('./secrets.json');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.4.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.2",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      }
    ]
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${alchemyAPIkey}`,
        blockNumber: 11095000
      }
    },
    ropsten: {
      url: "https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      chainId: 3,
      accounts: [deployerWalletPrivateKey],
      allowUnlimitedContractSize: true,
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      chainId: 4,
      accounts: [deployerWalletPrivateKey],
      allowUnlimitedContractSize: true,
      gas: 2100000,
      gasPrice: 8000000000
    },
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      chainId: 80001,
      accounts: [deployerWalletPrivateKey],
      allowUnlimitedContractSize: true,
    },
    harmony_testnet: {
      url: `https://api.s0.b.hmny.io`,
      accounts: [deployerWalletPrivateKey],
      allowUnlimitedContractSize: true,
      gas: 2100000,
      gasPrice: 8000000000
    },
    harmony_mainnet: {
      url: `https://api.harmony.one`,
      accounts: [deployerWalletPrivateKey],
      allowUnlimitedContractSize: true,
      gas: 10000000,
      gasPrice: 60000000000
    }
  },
  etherscan: {
    apiKey: etherscanAPIkey
  },
  mocha: {
    timeout: 200000
  }
};
