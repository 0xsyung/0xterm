// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ERC20Base} from "../src/ERC20Base.sol";

/**
 * @title DeployERC20Base
 * @dev Deploys the ERC20Base logic contract and a ready-to-use EIP-1167 minimal
 *      proxy pointing at it, initialized with the provided name/symbol/decimals.
 *
 * Usage:
 *   forge script script/DeployERC20Base.s.sol --rpc-url <RPC_URL> --private-key <KEY> --broadcast
 *
 *   # Deploy only the logic contract (skip the proxy + init):
 *   forge script script/DeployERC20Base.s.sol --sig "run(address)" \
 *     --rpc-url <RPC_URL> --private-key <KEY> --broadcast
 */
contract DeployERC20Base is Script {
    function run() external {
        vm.startBroadcast();

        ERC20Base implementation = new ERC20Base();

        // Canonical OZ minimal-proxy bytecode (no self-delegation at CREATE).
        // The init code copies this runtime and returns immediately; the
        // delegatecall only happens for real calls, so it works even when the
        // logic contract has no permissive fallback.
        bytes20 impl = bytes20(address(implementation));
        bytes memory runtimeCode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            impl,
            hex"5af43d82803e903d91602b57fd5bf3"
        );

        address proxy;
        assembly {
            proxy := create(0, add(runtimeCode, 0x20), mload(runtimeCode))
        }
        require(proxy != address(0), "DeployERC20Base: PROXY_CREATE_FAILED");

        // Initialize the proxy with the example token metadata.
        ERC20Base(payable(proxy)).initialize("0xTERM Test Token", "0XT", 18);

        vm.stopBroadcast();

        console.log("ERC20Base implementation at:", address(implementation));
        console.log("Token proxy at:", proxy);
        console.log("Proxy name:", ERC20Base(payable(proxy)).name());
        console.log("Proxy symbol:", ERC20Base(payable(proxy)).symbol());
        console.log("Proxy decimals:", ERC20Base(payable(proxy)).decimals());
    }
}
