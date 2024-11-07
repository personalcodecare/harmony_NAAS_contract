/**
HONE 0x0288245B17988B10a082855D3785c20b307228C9
HoneNode 0x0BC3543ABd67eEEaa57AC46B4398C9A6b4E2940C 0xCC51E75E41288dCa0feE5D6982Bf966DF123ADcC
HarmonyNodeManage 0xC55d2A95929E04323eBF54FA52caa2Ac1063eA7d 0x2ecEC3413c89893248310DE4ddd69Fe911a14baA
GHONE 0x7b75226A50C181F603eB1D6872eef635d607BbEe
 */
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers } = require('hardhat');
const { deploy, deployProxy, getAt } = require('../scripts/utils')

const bigNum = num=>(num + '0'.repeat(18))
const bigNum_6 = num => (num + '0'.repeat(6))
const smallNum = num=>(parseInt(num)/bigNum(1))
const smallNum_6 = num => (parseInt(num) / bigNum_6(1));

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // const USDC = await deploy("ERC20Mock",'USDC', 'USDC') // for test
  const USDC = '0x985458E523dB3d53125813eD68c274899e9DfAb4';
  const honeNFT = '0x29fB4090175D3e6Be5c8C28665faD86071cE9ACf';
  const feeCollectWallet = '0x4801452563e187C5CE05f8C3306a6e8143CD9E68';
  const rewardPool = '0x4129bc87bf0165f78e2c706acfb0c8b48e3d4acf';

  const saleFee = 10
  const transferFee = 15
  // addr[0]: usdc address
  // addr[1]: uniswap router
  // addr[2]: fee collect wallet address
  const HONE = await deploy("HONE",
    [
        USDC,
        '0x3C8BF7e25EbfAaFb863256A4380A8a93490d8065',
        feeCollectWallet
    ],
    [
        saleFee,
        transferFee
    ]
  )

  // const honeNFT = await deploy("HarmonyNode",'honeNFT','HONENFT', '', '', USDC)
  const HoneNode = await deployProxy('HoneNode');
  const NodeManage = await deployProxy('HarmonyNodeManage');
  const GHONE = await deploy('GHONE', HoneNode.address);

  await NodeManage.setBasicData(
    HONE.address,
    honeNFT,
    rewardPool,
    USDC,
    HoneNode.address
  );

  await HoneNode.setGHoneAddress(GHONE.address);

  await HoneNode.transferOwnership(NodeManage.address);
  await HONE.setNodeManagementContract(NodeManage.address);

  console.log('deployed successfully');
}

  

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
