// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Chat.sol";
import "../src/ChatFactory.sol";

/**
 * @title DeployChatFactory
 * @dev Deploys a shared Chat implementation + ChatFactory for EIP-1167 clones.
 *      Wire implementation + factory into frontend CHAT_IMPLEMENTATION / CHAT_FACTORY.
 *
 * Usage (testnet):
 *   forge script script/DeployChatFactory.s.sol \
 *     --rpc-url $SEPOLIA_RPC_URL --account <account-name> --sender <YOUR_ADDRESS>
 */
contract DeployChatFactory is Script {
    uint256 constant INITIAL_FEE = 100000000000000; // documented default; clones pass their own

    function run() external {
        vm.startBroadcast();

        Chat impl = new Chat();
        ChatFactory factory = new ChatFactory(address(impl));

        vm.stopBroadcast();

        console.log("Chat implementation at:", address(impl));
        console.log("ChatFactory at:", address(factory));
        console.log("Default fee hint (wei):", INITIAL_FEE);
        console.log("Factory owner:", factory.owner());
    }
}
