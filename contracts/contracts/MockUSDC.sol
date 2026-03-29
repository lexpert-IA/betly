// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC — testnet-only faucet token (6 decimals like real USDC)
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) { return 6; }

    /// Anyone can mint — testnet only
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
