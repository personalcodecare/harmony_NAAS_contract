const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require('fs');

const bigNum = num=>(num + '0'.repeat(18))
const bigNum_6 = num => (num + '0'.repeat(6))
const smallNum = num=>(parseInt(num)/bigNum(1))
const smallNum_6 = num => (parseInt(num) / bigNum_6(1));

const NODE_TYPE_NANO = 0;
const NODE_TYPE_PICO = 1;
const NODE_TYPE_MEGA = 2;
const NODE_TYPE_GIGA = 3;

const { deploy, deployProxy, getAt } = require('../scripts/utils')

describe("Deploying a Hone Token Contract and test their functionalities ", function () {

  before (async function () {
    [
      this.owner,
      this.dev,
      this.feeWallet,
      this.rewardPool,
      this.renter,
    ] = await ethers.getSigners();

    // deploy uniswap
    this.WETH = await deploy("WETH");
    this.USDC = await deploy("ERC20Mock",'USDC', 'USDC');
    const Factory = await deploy("PancakeFactory",this.WETH.address);
    const path = './contracts/Uniswap/Router.sol';
    const content = fs.readFileSync(path);
    fs.writeFileSync(
      path,
      content.toString('utf8').replace(/[\da-f]{64}/mi,
      String(await Factory.INIT_CODE_PAIR_HASH()).slice(2))
    );
    this.Router = await deploy("PancakeRouter", Factory.address, this.WETH.address);

    // addr: USDC address, router address, feeCollectWallet
    // value: saleFee, transferFee
    const saleFee = 10;
    const transferFee = 15;

    this.HONE = await deploy("HONE",
      [
          this.USDC.address,
          this.Router.address,
          this.feeWallet.address
      ],
      [
          saleFee,
          transferFee
      ]
    )

    this.honeNFT = await deploy(
      "HarmonyNode",
      'honeNFT',
      'HONENFT', 
      '', 
      '', 
      this.USDC.address
    );

    await this.honeNFT.whitelistUsers([
      this.owner.address,
      this.dev.address
    ]);

    this.HoneNode = await deployProxy('HoneNode');
    this.NodeManage = await deployProxy('HarmonyNodeManage');
    this.GHONE = await deploy('GHONE', this.HoneNode.address);

    await this.NodeManage.setBasicData(
      this.HONE.address,
      this.honeNFT.address,
      this.feeWallet.address,
      this.USDC.address,
      this.HoneNode.address
    );

    await this.HoneNode.setGHoneAddress(this.GHONE.address);

    await this.HoneNode.transferOwnership(this.NodeManage.address);
    await this.HONE.setNodeManagementContract(this.NodeManage.address);
  })

  it ('check initial state', async function () {
    const transferFee = await this.HONE.transferFee();
    const saleFee = await this.HONE.saleFee();
    const checkHasNode = await this.HONE.checkHasNode();
    let balance = await this.HONE.balanceOf(this.owner.address);
    balance = smallNum(balance);

    expect(transferFee).to.equal(15);
    expect(saleFee).to.equal(10);
    expect(checkHasNode).to.equal(0);
    expect(balance).to.equal(600000);

    await this.HONE.transfer(this.dev.address, bigNum(2000));
    await this.USDC.transfer(this.dev.address, bigNum_6(10000));

    await this.HONE.transfer(this.renter.address, bigNum(2000));
    await this.USDC.transfer(this.renter.address, bigNum_6(10000));
  })

  it.only ('make liquidity', async function () {
    await this.HONE.approve(this.Router.address, ethers.utils.parseEther("100000000"))
    await this.USDC.approve(this.Router.address, ethers.utils.parseEther("100000000"))
    await this.Router.addLiquidity(
       this.HONE.address, 
       this.USDC.address, 
       bigNum(500000), 
       bigNum_6(800000) ,
       "0",
       "0", 
       this.owner.address, 
       parseInt(new Date().getTime()/1000)+100
    )
    
    await this.USDC.transfer(this.dev.address, bigNum_6(10000))
    await this.USDC.transfer(this.renter.address, bigNum_6(10000))

    await this.NodeManage.getReserve();
  })

  describe('Harmony NodeManagement', async function () {
    it ('change rewardPool', async function() {
      await expect(
        this.NodeManage.connect(this.dev).setRewardPool(this.rewardPool.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await this.NodeManage.setRewardPool(this.rewardPool.address);
    })

    context ('create Node exception test', async function () {
      it ('wrong nodeType', async function () {
        const nodeType = 4;
        await expect(
          this.NodeManage.createNode(0, nodeType)
        ).revertedWith('wrong node type');
      })

      it ('wrong cost', async function () {
        const nodeType = 0;
        const honeAmount = bigNum(0);

        await expect(
          this.NodeManage.connect(this.dev).createNode(
            honeAmount,
            nodeType
          )
        ).revertedWith('no correct cost');
      })
    })

    it ('create Node with only hone', async function () {
      const nodeType = 0;
      const honeAmount = bigNum(10);
      await this.HONE.connect(this.dev).approve(this.NodeManage.address, bigNum(10));      

      await this.NodeManage.connect(this.dev).createNode(
        honeAmount,
        nodeType
      );

      expect (smallNum(await this.GHONE.balanceOf(this.dev.address))).to.equal(1);

      expect (await this.NodeManage.getNodeCount(this.dev.address)).to.equal(1);

      await network.provider.send("evm_increaseTime", [1000 * 60]);
      await network.provider.send("evm_mine");
      const claimableReward = await this.NodeManage.getClaimableRewards(this.dev.address);
      expect(claimableReward).to.equal(0);
    })

    it ('get Node count and deadline', async function () {
      const nodeCount = await this.NodeManage.getNodeCount(this.dev.address);
      expect(nodeCount).to.equal(1);

      const devNodes = await this.NodeManage.getNodes(this.dev.address);
      expect(devNodes.length).to.equal(1);
    })

    it ('claim rewards should be zero', async function () {
      await network.provider.send("evm_increaseTime", [10]);
      await network.provider.send("evm_mine");

      const claimAmount = await this.NodeManage.getClaimableRewards(this.dev.address);
      expect(claimAmount).to.equal(0);
    })

    it ('create node with first month fee', async function () {
      const nodeType = 0;
      const honeAmount = bigNum(10);
      await this.HONE.connect(this.dev).approve(this.NodeManage.address, bigNum(10));
      await this.USDC.connect(this.dev).approve(this.NodeManage.address, bigNum_6(10));

      const oldbalance = smallNum_6(await this.USDC.balanceOf(this.dev.address));

      await this.NodeManage.connect(this.dev).createNode(
        honeAmount,
        nodeType
      );

      const transferAmount = oldbalance - smallNum_6(await this.USDC.balanceOf(this.dev.address));
      expect(transferAmount).to.equal(10);
      expect (await this.NodeManage.getNodeCount(this.dev.address)).to.equal(2);

    })

    it ('claim rewards should be greater than zero', async function () {
      await network.provider.send("evm_increaseTime", [60 * 1000]);
      await network.provider.send("evm_mine");

      let claimAmount = await this.NodeManage.getClaimableRewards(this.dev.address);
      claimAmount = smallNum(claimAmount);
      expect(claimAmount).to.greaterThan(0);

      let oldBalance = await this.HONE.balanceOf(this.dev.address);
      oldBalance = smallNum(oldBalance);

      await this.NodeManage.connect(this.dev).claimRewards();
      const transferedAmount = smallNum(await this.HONE.balanceOf(this.dev.address)) - oldBalance;
      expect(transferedAmount).to.greaterThan(0);

      await expect(
        this.NodeManage.claimRewards()
      ).revertedWith('no node');
    })

    context ('Rent exception case', async function () {
      it ('list none exist node', async function () {
        const rentNodeIndex = 0;
        const amount = bigNum(10);
        const months = 1;
        await expect(
          this.NodeManage.listLendOffer(rentNodeIndex, amount, months)
        ).revertedWith('wrong offer');
      })

      it ('list node with zero amount', async function () {
        const rentNodeIndex = 2;
        const amount = bigNum(0);
        const months = 1;
        await expect(
          this.NodeManage.connect(this.dev).listLendOffer(rentNodeIndex, amount, months)
        ).revertedWith('wrong offer');
      })

      it ('list node with 0 months', async function () {
        const rentNodeIndex = 2;
        const amount = bigNum(01);
        const months = 0;
        await expect(
          this.NodeManage.connect(this.dev).listLendOffer(rentNodeIndex, amount, months)
        ).revertedWith('wrong offer');
      })

      // it ('list dead node', async function () {
      //   const rentNodeIndex = 0;
      //   const amount = bigNum(01);
      //   const months = 5;
      //   await expect(
      //     this.NodeManage.connect(this.dev).listLendOffer(rentNodeIndex, amount, months)
      //   ).revertedWith('dead node');
      // })
    })

    it ('list node for lend', async function () {
      const rentNodeIndex = 1;
      const amount = bigNum(10);
      const months = 5;
      this.NodeManage.connect(this.dev).listLendOffer(rentNodeIndex, amount, months);

      await expect(
        this.NodeManage.connect(this.dev).listLendOffer(rentNodeIndex, amount, months)
      ).revertedWith('already listed');
    })

    it ('close lend offer', async function () {
      let lendOffers = await this.NodeManage.getLendOffers(this.dev.address, true);
      expect(lendOffers.length).to.equal(0);
      lendOffers = await this.NodeManage.getLendOffers(this.dev.address, false);
      expect(lendOffers.length).to.equal(1);

      await expect(
        this.NodeManage.connect(this.dev).closeLendOffer(1)
      ).revertedWith('wrong offer index');

      await expect(
        this.NodeManage.closeLendOffer(0)
      ).revertedWith('no permission');

      await this.NodeManage.connect(this.dev).closeLendOffer(0);

      await expect(
        this.NodeManage.connect(this.dev).closeLendOffer(0)
      ).revertedWith('already closed');
    })

    it ('accept lend offer', async function () {
      const rentNodeIndex = 1;
      const amount = bigNum(10);
      const months = 5;
      await this.NodeManage.connect(this.dev).listLendOffer(rentNodeIndex, amount, months);
      lendOffers = await this.NodeManage.getLendOffers(this.dev.address, false);

      await expect(
        this.NodeManage.connect(this.renter).acceptLendOffer(3)
      ).revertedWith('wrong offer index');

      await expect(
        this.NodeManage.connect(this.dev).acceptLendOffer(lendOffers[0].offerIndex)
      ).revertedWith('offer owner');

      await expect(
        this.NodeManage.connect(this.renter).acceptLendOffer(0)
      ).revertedWith('offer closed');

      await expect(
        this.NodeManage.connect(this.renter).acceptLendOffer(lendOffers[0].offerIndex)
      ).revertedWith('wrong price');

      // get claimable rewards before rent
      await network.provider.send("evm_increaseTime", [60 * 1000]);
      await network.provider.send("evm_mine");
      expect(await this.NodeManage.getClaimableRewards(this.renter.address)).to.equal(0);

      await this.HONE.connect(this.renter).approve(this.NodeManage.address, lendOffers[0].amount);
      await this.HONE.connect(this.renter).approve(lendOffers[0].owner, lendOffers[0].amount);
      await this.NodeManage.connect(this.renter).acceptLendOffer(lendOffers[0].offerIndex);

      expect(await this.NodeManage.getNodeCount(this.renter.address)).to.equal(1);
    })

    it ('get cliamable reward after rent', async function () {
      let claimAmount = await this.NodeManage.getClaimableRewards(this.dev.address);
      claimAmount = smallNum(claimAmount);
      await this.NodeManage.connect(this.dev).claimRewards();

      await network.provider.send("evm_increaseTime", [60 * 1000]);
      await network.provider.send("evm_mine");

      claimAmount = await this.NodeManage.getClaimableRewards(this.renter.address);
      claimAmount = smallNum(claimAmount);
      expect(claimAmount).to.greaterThan(0);

      let oldBalance = await this.HONE.balanceOf(this.renter.address);
      oldBalance = smallNum(oldBalance);

      await this.NodeManage.connect(this.renter).claimRewards();
      const transferedAmount = smallNum(await this.HONE.balanceOf(this.renter.address)) - oldBalance;
      expect(transferedAmount).to.greaterThan(0);

      expect(await this.NodeManage.getClaimableRewards(this.renter.address)).to.equal(0);
    })

    it ('get upgrade node', async function () {
      const nodeType = 0;
      const honeAmount = bigNum(10);
      await this.HONE.connect(this.dev).approve(this.NodeManage.address, bigNum(10));

      for (let i = 0; i < 2; i ++) {
        await this.HONE.connect(this.dev).approve(this.NodeManage.address, bigNum(10));
        await this.NodeManage.connect(this.dev).createNode(
          honeAmount,
          nodeType
        );
      }

      const upgradeNodeType = 1;
      
      let nodes = await this.NodeManage.getNodes(this.dev.address);
      await this.USDC.connect(this.dev).approve(this.NodeManage.address, bigNum_6(20));   
      await this.NodeManage.connect(this.dev).upgradeNode(
        upgradeNodeType,
        [
          nodes[3].nodeIndex,
          nodes[2].nodeIndex
        ]
      );

      expect (await this.NodeManage.getNodeCount(this.dev.address)).to.equal(3);   

      await network.provider.send("evm_increaseTime", [60 * 1000]);
      await network.provider.send("evm_mine");

      claimAmount = await this.NodeManage.getClaimableRewards(this.dev.address);
      claimAmount = smallNum(claimAmount);
      expect(claimAmount).to.greaterThan(0);
    })

    it ('create pico node with monthly fee', async function () {
      const nodeType = NODE_TYPE_PICO;
      const honeAmount = bigNum(20);
      await this.HONE.connect(this.dev).approve(this.NodeManage.address, bigNum(20));
      await this.USDC.connect(this.dev).approve(this.NodeManage.address, bigNum_6(20));

      const oldbalance = smallNum_6(await this.USDC.balanceOf(this.dev.address));

      await this.NodeManage.connect(this.dev).createNode(
        honeAmount,
        nodeType
      );

      const transferAmount = oldbalance - smallNum_6(await this.USDC.balanceOf(this.dev.address));
      expect(transferAmount).to.equal(20);
      expect (await this.NodeManage.getNodeCount(this.dev.address)).to.equal(4);   
    })

    it ('create mega node with monthly fee', async function () {
      const nodeType = NODE_TYPE_MEGA;
      const honeAmount = bigNum(50);
      await this.HONE.connect(this.dev).approve(this.NodeManage.address, bigNum(50));
      await this.USDC.connect(this.dev).approve(this.NodeManage.address, bigNum_6(30));

      const oldbalance = smallNum_6(await this.USDC.balanceOf(this.dev.address));

      await this.NodeManage.connect(this.dev).createNode(
        honeAmount,
        nodeType
      );

      const transferAmount = oldbalance - smallNum_6(await this.USDC.balanceOf(this.dev.address));
      expect(transferAmount).to.equal(30);
      expect (await this.NodeManage.getNodeCount(this.dev.address)).to.equal(5);
    })

    it ('create giga node with monthly fee', async function () {
      const nodeType = NODE_TYPE_GIGA;
      const honeAmount = bigNum(100);
      await this.HONE.connect(this.dev).approve(this.NodeManage.address, bigNum(100));
      await this.USDC.connect(this.dev).approve(this.NodeManage.address, bigNum_6(45));

      const oldbalance = smallNum_6(await this.USDC.balanceOf(this.dev.address));

      await this.NodeManage.connect(this.dev).createNode(
        honeAmount,
        nodeType
      );

      const transferAmount = oldbalance - smallNum_6(await this.USDC.balanceOf(this.dev.address));
      expect(transferAmount).to.equal(45);
      expect (await this.NodeManage.getNodeCount(this.dev.address)).to.equal(6);
    })

    it ('get claim rewards after some times', async function() {
      await network.provider.send("evm_increaseTime", [60 * 1000]);
      await network.provider.send("evm_mine");

      const claimableReward = await this.NodeManage.getClaimableRewards(this.dev.address);
      expect(smallNum(claimableReward)).to.greaterThan(1.5);
    })

    it ('create node with NFT', async function () {
      await this.USDC.connect(this.dev).approve(this.honeNFT.address, BigInt(10**6 * 3));
      await this.honeNFT.connect(this.dev).mint(3);
      await this.honeNFT.connect(this.dev).setApprovalForAll(this.NodeManage.address, true);

      const tokenIDs = await this.honeNFT.walletOfOwner(this.dev.address);
      expect(tokenIDs.length).to.equal(3);
      let nodeCount = await this.NodeManage.getNodeCount(this.dev.address);
      
      await this.NodeManage.connect(this.dev).swapNode(tokenIDs[0]);
      expect(await this.NodeManage.getNodeCount(this.dev.address) - nodeCount)
      .to.equal(1);
    })

    it ('pay maintenance fee', async function () {
      let nodes = await this.NodeManage.getNodes(this.dev.address);
      const oldDeadline = nodes[1].deadline;

      await this.USDC.connect(this.dev).approve(this.NodeManage.address, bigNum_6(10));
      await this.NodeManage.connect(this.dev).payMaintenanceFee(nodes[1].nodeIndex);
      nodes = await this.NodeManage.getNodes(this.dev.address);
      expect(Number(nodes[1].deadline)).to.greaterThan(Number(oldDeadline));
    })

    it ('pay all maintenance fee', async function () {
      let nodes = await this.NodeManage.getNodes(this.dev.address);
      const oldDeadline = nodes[0].deadline;

      await this.USDC.connect(this.dev).approve(this.NodeManage.address, bigNum_6(300));
      await this.NodeManage.connect(this.dev).payAllMaintenanceFee();
      nodes = await this.NodeManage.getNodes(this.dev.address);
      expect(Number(nodes[0].deadline)).to.greaterThan(Number(oldDeadline));
    })

    it ('update maintenance fee', async function () {
      let maintenanceFees = await this.NodeManage.getMaintenanceFee();
      expect(maintenanceFees.length).to.equal(4);
      expect(maintenanceFees[0]).to.equal(10);
      expect(maintenanceFees[1]).to.equal(20);
      expect(maintenanceFees[2]).to.equal(30);
      expect(maintenanceFees[3]).to.equal(45);

      await this.NodeManage.updateMaintenanceFee([10, 20, 30, 40]);
      maintenanceFees = await this.NodeManage.getMaintenanceFee();
      expect(maintenanceFees.length).to.equal(4);
      expect(maintenanceFees[0]).to.equal(10);
      expect(maintenanceFees[1]).to.equal(20);
      expect(maintenanceFees[2]).to.equal(30);
      expect(maintenanceFees[3]).to.equal(40);
    })
  })

});