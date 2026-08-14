// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/MockToken.sol";

/**
 * @title DeployTokens
 * @dev Script to deploy mockUSDC and mockDAI tokens
 * 
 * Usage:
 * forge script script/DeployTokens.s.sol --rpc-url <RPC_URL> --private-key <PRIVATE_KEY> --broadcast
 */
contract DeployTokens is Script {
    function run() external {
        // Start broadcasting transactions
        vm.startBroadcast();

        // Deploy mockUSDC
        // USDC typically has 6 decimal places and a large supply
        MockToken usdc = new MockToken(
            "USD Coin",           // name
            "USDC",               // symbol
            6,                    // decimals
            1_000_000             // initial supply: 1,000,000 USDC
        );

        // Deploy mockDAI
        // DAI has 18 decimal places and a large supply
        MockToken dai = new MockToken(
            "Dai Stablecoin",     // name
            "DAI",                // symbol
            18,                   // decimals
            1_000_000             // initial supply: 1,000,000 DAI
        );

        // Stop broadcasting
        vm.stopBroadcast();

        // Log the deployed addresses
        console.log("mockUSDC deployed at:", address(usdc));
        console.log("mockDAI deployed at:", address(dai));
        console.log("Deployer balance USDC:", usdc.balanceOf(msg.sender) / 10 ** 6);
        console.log("Deployer balance DAI:", dai.balanceOf(msg.sender) / 10 ** 18);
    }
}
