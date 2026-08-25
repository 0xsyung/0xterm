// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Billboard.sol";

/**
 * @title UpgradeBillboard
 * @dev UUPS upgrade: deploy a new Billboard implementation and point the
 *      existing proxy at it via upgradeToAndCall(newImpl, ""). The proxy owns
 *      the storage, so ALL posts are preserved.
 *
 *      Only the proxy owner (the --sender that deployed) may run this.
 *
 * Usage:
 *   forge script script/UpgradeBillboard.s.sol:UpgradeBillboard \
 *     --rpc-url $RPC_URL --account <account-name> --sender <OWNER_ADDRESS> \
 *     --sig "run(address)" <PROXY_ADDRESS> --broadcast --slow
 *
 *   (Keep the storage layout identical — new fields must be APPENDED at the
 *   end, never reordered or renamed. See script/BillboardDeploy.md.)
 */
contract UpgradeBillboard is Script {
    function run(address proxyAddr) external returns (address newImpl) {
        vm.startBroadcast();

        Billboard newImplContract = new Billboard();
        Billboard(proxyAddr).upgradeToAndCall(address(newImplContract), "");

        vm.stopBroadcast();

        console.log("Billboard upgraded. Proxy:", proxyAddr);
        console.log("New implementation at:", address(newImplContract));
        console.log("Owner:", Billboard(proxyAddr).owner());
    }
}
