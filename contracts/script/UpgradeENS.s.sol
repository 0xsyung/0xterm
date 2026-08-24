// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/EnsRegistry.sol";

/**
 * @title UpgradeENS
 * @dev UUPS upgrade: deploy a new EnsRegistry implementation and point the
 *      existing proxy at it via upgradeToAndCall(newImpl, ""). The proxy owns
 *      the storage, so ALL name records are preserved.
 *
 *      Only the proxy owner (the --sender that deployed) may run this.
 *
 * Usage:
 *   forge script script/UpgradeENS.s.sol:UpgradeENS \
 *     --rpc-url $RPC_URL --account <account-name> --sender <OWNER_ADDRESS> \
 *     --sig "run(address)" <PROXY_ADDRESS> --broadcast --slow
 *
 *   (Keep the storage layout identical — new fields must be APPENDED at the
 *   end, never reordered or renamed. See script/EnsDeploy.md.)
 */
contract UpgradeENS is Script {
    function run(address proxyAddr) external returns (address newImpl) {
        vm.startBroadcast();

        EnsRegistry newImplContract = new EnsRegistry();
        EnsRegistry(proxyAddr).upgradeToAndCall(address(newImplContract), "");

        vm.stopBroadcast();

        console.log("ENS upgraded. Proxy:", proxyAddr);
        console.log("New implementation at:", address(newImplContract));
        console.log("Owner:", EnsRegistry(proxyAddr).owner());
    }
}
