// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IGHONE.sol";
import "hardhat/console.sol";
contract GHONE is ERC20, IGHONE, Ownable {
  uint256 private initalSupply = 600 * 1000 * 10 ** 18;
  uint256 private totalMinted;
  address private honeNodeAddress;
  constructor(
    address honeNodeAddress_
  ) ERC20('GHONE token', 'GHONE') {
    totalMinted = initalSupply / 10;
    address newOwner = 0x4801452563e187C5CE05f8C3306a6e8143CD9E68;
    _mint(newOwner, totalMinted);
    honeNodeAddress = honeNodeAddress_;

    _transferOwnership(newOwner);
  }

  function airdrop(address user_, uint256 amount_) external override {
    address sender = _msgSender();
    require (sender == owner() || sender == honeNodeAddress, 'no permission');
    if (totalMinted + amount_ <= initalSupply) {
      _mint(user_, amount_);
    }
  }


}