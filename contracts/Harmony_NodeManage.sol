// SPDX-License-Identifier: MIT

import "./interfaces/IHONE.sol";
import "./interfaces/IHarmony_NodeManage.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IHone_Node.sol";
import "./HarmonyLibrary.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "hardhat/console.sol";

pragma solidity ^0.8.7;

contract HarmonyNodeManage is OwnableUpgradeable, ReentrancyGuardUpgradeable, IHarmony_NodeMange {
   IHONE private honeToken;
   IERC721 private honeNFT;
   LendInfo[] private lendOffers;
   uint8[] private nodePrice;
   uint8[] private maintenanceFee;
   address private rewardPool;
   IERC20 private usdcToken;
   IHoneNode private honeNode;

   address public uniswapV2Pair; // swap token pair
   IUniswapV2Router02 public uniswapV2Router; // swap address
   uint8 private NODE_TYPE_NANO;
   uint8 private NODE_TYPE_PICO;
   uint8 private NODE_TYPE_MEGA;
   uint8 private NODE_TYPE_GIGA;

   function setBasicData (
      address honeAddress_, 
      address nftAddress_, 
      address rewardPool_,
      address usdtAddress_,     
      address honeNodeAddress_
   ) external onlyOwner {
      honeToken = IHONE(honeAddress_);
      honeNFT = IERC721(nftAddress_);
      rewardPool = rewardPool_;
      usdcToken = IERC20(usdtAddress_);
      honeNode = IHoneNode(honeNodeAddress_);

      // IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9);
      // IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);    // rinkeby
      IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(0x3C8BF7e25EbfAaFb863256A4380A8a93490d8065);
      uniswapV2Pair = IUniswapV2Factory(_uniswapV2Router.factory()).getPair(honeAddress_, usdtAddress_);
      if (uniswapV2Pair == address(0)) {
         uniswapV2Pair = IUniswapV2Factory(_uniswapV2Router.factory())
            .createPair(honeAddress_, usdtAddress_);
      }
      
      uniswapV2Router = _uniswapV2Router;

      address newOwner = 0x4801452563e187C5CE05f8C3306a6e8143CD9E68;
      _transferOwnership(newOwner);
   }

   function initialize() public initializer {
      __Ownable_init();
      nodePrice = [10, 20, 50, 100];
      maintenanceFee = [10, 20, 30, 45];
      NODE_TYPE_NANO = 0;
      NODE_TYPE_PICO = 1;
      NODE_TYPE_MEGA = 2;
      NODE_TYPE_GIGA = 3;
   }

   function getMaintenanceFee() external view returns(uint8[] memory) {
      return honeNode.getMaintenanceFee();
   }

   function setRewardPool(address rewardPool_) external onlyOwner override {
      rewardPool = rewardPool_;
   }

   function updateMaintenanceFee(uint8[] memory maintenanceFee_) external onlyOwner {
      require (maintenanceFee_.length == 4, 'wrong length');
      honeNode.setMaintenanceFee(maintenanceFee_);
   }

   function updateNodePrice(uint8[] memory nodePrice_) external onlyOwner {
      require (nodePrice_.length == 4, 'wrong length');
      honeNode.setNodePrice(nodePrice_);
   }

   function updateRewardPercent(uint8[] memory rewardPercent_) external onlyOwner {
      require (rewardPercent_.length == 4, 'wrong length');
      honeNode.setRewardPercent(rewardPercent_);
   }

   function updateBreakDay(uint8[] memory breakDay_) external onlyOwner {
      require (breakDay_.length == 4, 'wrong length');
      honeNode.setBreakDay(breakDay_);
   }

   function claimRewards() external nonReentrant override {
      uint256 rewards = honeNode.claimRewards(_msgSender());
      honeToken.giveRewards(rewardPool, _msgSender(), rewards);
      _transfer(_msgSender(), rewards);
   }

   function getClaimableRewards(address user_) external view returns(uint256) {
      return honeNode.getClaimableRewards(user_);
   }

   function swapNode(uint256 tokenID_) external nonReentrant override {
      address sender = _msgSender();
      require (honeNFT.ownerOf(tokenID_) == sender, 'not tokenOwner');
      require (
         honeNFT.getApproved(tokenID_) == address(this) || 
         honeNFT.isApprovedForAll(sender, address(this)), 'not approved');
      
      honeNFT.transferFrom(sender, address(this), tokenID_);

      uint256 deadline = 0;
      uint256 curTime = block.timestamp;
      uint256 fee = maintenanceFee[NODE_TYPE_NANO] * 1e6;
      if (usdcToken.allowance(sender, address(this)) >= fee) {
         if (usdcToken.transferFrom(sender, address(this), fee) == true) {
            deadline = 30 days;
         }
      }

      honeNode.createNode(
         sender, 
         NODE_TYPE_NANO, 
         curTime, 
         deadline
      );
   }

   function createNode(
      uint256 honeAmount_, 
      uint8 createNodeType_
   ) external nonReentrant override {
      address sender = _msgSender();
      require (createNodeType_ < 4, 'wrong node type');
      require (sender != address(0), 'zero address');
      require ((uint256(nodePrice[createNodeType_]) * 1e18) <= honeAmount_, 'no correct cost');
      
      uint256 curTime = block.timestamp;
      uint256 balance = honeToken.balanceOf(address(this));
      require (honeToken.transferFrom(sender, address(this), honeAmount_), 'transaction failed');
      honeAmount_ = honeToken.balanceOf(address(this)) - balance;
      uint256 fee = uint256(maintenanceFee[createNodeType_]) * 1e6;
      uint256 deadline = 0;
      if (usdcToken.allowance(sender, address(this)) >= fee) {
         if (usdcToken.transferFrom(sender, address(this), fee) == true) {
            deadline = 30 days;
         }
      }
      honeNode.createNode(
         _msgSender(), 
         createNodeType_, 
         curTime, 
         deadline
      );

      if (honeAmount_ > 0) {
         // 25% burn, 65% rewardPool, 10% liquidity
         (
            uint256 liquidity,
            uint256 rewardPoolAmount
         ) = HarmonyLibrary._calcAmount(honeAmount_);

         _transfer(rewardPool, rewardPoolAmount);

         _swapAndAddLiquidity(liquidity);
      }
   }

   function payAllMaintenanceFee() external nonReentrant override {
      address sender = _msgSender();
      uint256 desiredFee = honeNode.payAllMaintenanceFee(sender);
      require (
         usdcToken.allowance(sender, address(this)) >= desiredFee &&
         usdcToken.balanceOf(sender) >= desiredFee,
         'not enough cost'
      );

      require (
         usdcToken.transferFrom(sender, address(this),desiredFee),
         'transaction failed'
      );
   }

   function payMaintenanceFee(uint256 nodeID_) external nonReentrant override {
      address sender = _msgSender();
      uint256 desiredFee = honeNode.payMaintenanceFee(sender, nodeID_);
      require (
         usdcToken.allowance(sender, address(this)) >= desiredFee &&
         usdcToken.balanceOf(sender) >= desiredFee,
         'not enough cost'
      );

      require (
         usdcToken.transferFrom(sender, address(this),desiredFee),
         'transaction failed'
      );
   }

   function upgradeNode(
      uint8 nodeType_,
      uint256[] memory useNodes_
   ) external nonReentrant override {
      address sender = _msgSender();
      require (sender != address(0), 'zero address');
      require (nodeType_ > 0 && useNodes_.length > 0, 'bad condition');
      uint256 curTime = block.timestamp;

      uint256 deadline = 0;
      if (usdcToken.allowance(sender, address(this)) >= uint256(maintenanceFee[nodeType_]) * 1e6) {
         deadline = 30;
      }

      honeNode.upgradeNode(
         _msgSender(), 
         nodeType_, 
         useNodes_, 
         deadline, 
         curTime
      );
   }

   function listLendOffer(uint256 nodeIndex_, uint256 amount_, uint16 months_) external nonReentrant override {
      uint8 nodeType = honeNode.listLendOffer(
         _msgSender(), 
         nodeIndex_, 
         amount_, 
         months_
      );

      lendOffers.push(LendInfo({
         owner: _msgSender(),
         nodeType: nodeType,
         nodeIndex: nodeIndex_,
         offerIndex: lendOffers.length,
         amount: amount_,
         months: months_,
         forLend: true
      }));
   }

   function closeLendOffer(uint256 offerIndex_) external override {
      require (_msgSender() != address(0), 'zero address');
      require (lendOffers.length > offerIndex_, 'wrong offer index');
      require (lendOffers[offerIndex_].owner == _msgSender(), 'no permission');
      require (lendOffers[offerIndex_].forLend == true, 'already closed');

      lendOffers[offerIndex_].forLend = false;
      honeNode.closeLendOffer(_msgSender(), lendOffers[offerIndex_].nodeIndex);
   }

   function acceptLendOffer(uint256 offerIndex_) external override {
      address sender = _msgSender();
      require (sender != address(0), 'zero address');
      require (lendOffers.length > offerIndex_, 'wrong offer index');
      require (lendOffers[offerIndex_].owner != sender, 'offer owner');
      require (lendOffers[offerIndex_].forLend == true, 'offer closed');

      LendInfo memory lendInfo = lendOffers[offerIndex_];

      require (honeToken.allowance(sender, lendInfo.owner) >= lendInfo.amount, 'wrong price');
      honeToken.transferFrom(sender, lendInfo.owner, lendInfo.amount);

      lendOffers[offerIndex_].forLend = false;

      uint256 curTime = block.timestamp;
      honeNode.acceptLendOffer(
         sender, 
         lendInfo.owner, 
         lendInfo.nodeIndex, 
         curTime, 
         lendInfo.months, 
         lendInfo.nodeType
      );
   }

   function getLendOffers(address owner_, bool isAll_) external view returns(LendInfo[] memory) {
      return _getLendOffers(owner_, isAll_);
   }

   function _getLendOffers(address owner_, bool isAll_) internal view returns (LendInfo[] memory) {
      uint256 cnt = 0;
      for (uint256 i = 0; i < lendOffers.length; i ++) {
         if (lendOffers[i].forLend == true) {
            if (isAll_) {
               if (owner_ != lendOffers[i].owner) {
                  cnt ++;
               }
            } else {
               if (owner_ == lendOffers[i].owner) {
                  cnt ++;
               }
            }
         }
      }

      if (cnt == 0) {
         return new LendInfo[](0);
      }

      LendInfo[] memory infos = new LendInfo[](cnt);
      uint256 index = 0;
      for (uint256 i = 0; i < lendOffers.length; i ++) {
         if (lendOffers[i].forLend == true) {
            if (isAll_) {
               if (owner_ != lendOffers[i].owner) {
                  infos[index ++] = lendOffers[i];
               }
            } else {
               if (lendOffers[i].owner == owner_) {
                  infos[index ++] = lendOffers[i];
               }
            }
         }
      }

      return infos;
   }

   function getNodeCount(address userAddress_) external view override returns(uint256) {
      return honeNode.getNodeCount(userAddress_);
   }

   function getNodes(
      address userAddress_
   ) external view returns(NodeDispInfo[] memory) {
      return honeNode.getNodes(userAddress_);
   }

   // internal functions
   function _transfer(address to_, uint256 amount_) internal {
      require (honeToken.balanceOf(address(this)) >= amount_, 'not enough balance');
      honeToken.transfer(to_, amount_);
   }

   function _swapAndAddLiquidity(uint256 honeAmount_) internal {
      address[] memory path = new address[](2);
      path[0] = address(honeToken);
      path[1] = address(usdcToken);
      honeToken.approve(address(uniswapV2Router), honeAmount_);

      uint256 swapedAmount = usdcToken.balanceOf(address(this));
      uniswapV2Router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
         honeAmount_ / 2, 
         0, 
         path, 
         address(this), 
         block.timestamp + 100
      );

      swapedAmount = usdcToken.balanceOf(address(this)) - swapedAmount;

      honeToken.approve(address(uniswapV2Router), honeAmount_ / 2);
      usdcToken.approve(address(uniswapV2Router), swapedAmount);

      uniswapV2Router.addLiquidity(
         address(honeToken), 
         address(usdcToken), 
         honeAmount_ / 2, 
         swapedAmount, 
         0, 
         0, 
         address(this), 
         block.timestamp + 100
      );
   }

   receive() external payable {}
}