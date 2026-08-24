// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Chat.sol";

/**
 * @title UpgradeChat
 * @dev UUPS upgrade: deploy a new Chat implementation and point the existing
 *      proxy at it via upgradeToAndCall(newImpl, ""). The proxy owns the
 *      storage, so ALL chat history (inbox / messageCount) is preserved.
 *
 *      Only the proxy owner (the --sender that deployed) may run this.
 *
 * Usage:
 *   forge script script/UpgradeChat.s.sol:UpgradeChat \
 *     --rpc-url $RPC_URL --account <account-name> --sender <OWNER_ADDRESS> \
 *     --sig "run(address)" <PROXY_ADDRESS> --broadcast --slow
 *
 *   (Keep the storage layout identical — new fields must be APPENDED at the
 *   end, never reordered or renamed. See script/ChatDeploy.md §7.)
 */
contract UpgradeChat is Script {
    function run(address proxyAddr) external returns (address newImpl) {
        vm.startBroadcast();

        Chat newImplContract = new Chat();
        Chat(proxyAddr).upgradeToAndCall(address(newImplContract), "");

        vm.stopBroadcast();

        console.log("Chat upgraded. Proxy:", proxyAddr);
        console.log("New implementation at:", address(newImplContract));
        console.log("Owner:", Chat(proxyAddr).owner());
    }
}
