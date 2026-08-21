// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Chat.sol";

/**
 * @title DeployChat
 * @dev Deploys Chat with an initial message fee.
 *
 * Usage (testnet only — see script/ChatDeploy.md):
 *   export SEPOLIA_RPC_URL=...
 *   forge script script/DeployChat.s.sol \
 *     --rpc-url $SEPOLIA_RPC_URL --account <account-name> --sender <YOUR_ADDRESS>
 *   # dry-run, then re-run with --broadcast
 */
contract DeployChat is Script {
    // 0.0001 ETH in wei
    uint256 constant INITIAL_FEE = 100000000000000;

    function run() external {
        vm.startBroadcast();

        Chat chat = new Chat(INITIAL_FEE);

        vm.stopBroadcast();

        console.log("Chat deployed at:", address(chat));
        console.log("Initial fee (wei):", chat.fee());
        console.log("Owner:", chat.owner());
    }
}
