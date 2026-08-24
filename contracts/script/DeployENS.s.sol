// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/EnsRegistry.sol";

/**
 * @title DeployENS
 * @dev Deploys 0xterm's own ENS registry + resolver (testnets only): a UUPS
 *      implementation + an ERC1967Proxy that owns the storage (name records).
 *      The proxy is what callers talk to; its address differs per chain (plain
 *      CREATE), so wire the per-chain proxy address into the frontend ENS_CONTRACT.
 *
 *      Upgrades later swap only the implementation via upgradeToAndCall() — the
 *      proxy (and therefore every record) stays put.
 *
 *      Records are owner-only for now: after deploy, register test names with
 *      `cast send <proxy> "setRecord(bytes32,address,string)" ...`
 *      (see script/EnsDeploy.md for full examples).
 *
 * Usage (testnet only — see script/EnsDeploy.md):
 *   export SEPOLIA_RPC_URL=...
 *   forge script script/DeployENS.s.sol \
 *     --rpc-url $SEPOLIA_RPC_URL --account <account-name> --sender <YOUR_ADDRESS>
 *   # dry-run, then re-run with --broadcast on each chain
 */
contract DeployENS is Script {
    function run() external {
        vm.startBroadcast();

        EnsRegistry impl = new EnsRegistry();
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), abi.encodeCall(EnsRegistry.initialize, ()));

        vm.stopBroadcast();

        console.log("ENS proxy deployed at:", address(proxy));
        console.log("ENS implementation at:", address(impl));
        console.log("Owner:", EnsRegistry(address(proxy)).owner());
        console.log("Upgradeable: YES (UUPS - use UpgradeENS.s.sol to upgrade)");
    }
}
