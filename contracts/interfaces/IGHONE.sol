// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IGHONE is IERC20 {
   function airdrop(address user_, uint256 amount_) external;
}