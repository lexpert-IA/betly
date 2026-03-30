// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Mock Aave V3 Pool for testing BetlyYield.
///      supply() takes USDC and gives aUSDC 1:1.
///      withdraw() takes aUSDC and gives USDC 1:1.
contract MockAavePool {
    IERC20 public usdc;
    IERC20 public aUsdc;

    constructor(address _usdc, address _aUsdc) {
        usdc = IERC20(_usdc);
        aUsdc = IERC20(_aUsdc);
    }

    function supply(address, uint256 amount, address onBehalfOf, uint16) external {
        usdc.transferFrom(msg.sender, address(this), amount);
        aUsdc.transfer(onBehalfOf, amount);
    }

    function withdraw(address, uint256 amount, address to) external returns (uint256) {
        aUsdc.transferFrom(msg.sender, address(this), amount);
        usdc.transfer(to, amount);
        return amount;
    }
}
