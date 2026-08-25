// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/Billboard.sol";

/**
 * @title DeployBillboard
 * @dev Deploys the upgradeable Billboard: a UUPS implementation + an
 *      ERC1967Proxy that owns the storage (the public post ledger). The proxy
 *      is what callers talk to; its address differs per chain (plain CREATE),
 *      so wire the per-chain proxy address into the frontend BILLBOARD_CONTRACT.
 *
 *      Upgrades later swap only the implementation via upgradeToAndCall() — the
 *      proxy (and therefore all posts) stays put. See UpgradeBillboard.s.sol
 *      and script/BillboardDeploy.md.
 *
 * Usage (testnet only — see script/BillboardDeploy.md):
 *   export SEPOLIA_RPC_URL=...
 *   forge script script/DeployBillboard.s.sol \
 *     --rpc-url $SEPOLIA_RPC_URL --account <account-name> --sender <YOUR_ADDRESS>
 *   # dry-run, then re-run with --broadcast on each chain
 */
contract DeployBillboard is Script {
    // 0.0001 ETH in wei
    uint256 constant INITIAL_FEE = 100000000000000;

    function run() external {
        vm.startBroadcast();

        Billboard impl = new Billboard();
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), abi.encodeCall(Billboard.initialize, (INITIAL_FEE)));

        vm.stopBroadcast();

        console.log("Billboard proxy deployed at:", address(proxy));
        console.log("Billboard implementation at:", address(impl));
        console.log("Initial fee (wei):", Billboard(address(proxy)).fee());
        console.log("Owner:", Billboard(address(proxy)).owner());
        console.log("Upgradeable: YES (UUPS - use UpgradeBillboard.s.sol to upgrade)");
    }
}
