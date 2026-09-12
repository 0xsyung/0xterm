// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/PortfolioShare.sol";

/**
 * @title DeployPortfolioShare
 * @dev Deploys the upgradeable PortfolioShare: a UUPS implementation + an
 *      ERC1967Proxy that owns the storage (the public share index). The proxy
 *      is what callers talk to; its address differs per chain (plain CREATE),
 *      so wire the per-chain proxy address into the frontend SHARE_CONTRACT.
 *
 * Usage (testnet only — see script/PortfolioShareDeploy.md):
 *   export SEPOLIA_RPC_URL=...
 *   forge script script/DeployPortfolioShare.s.sol \
 *     --rpc-url $SEPOLIA_RPC_URL --account <account-name> --sender <YOUR_ADDRESS>
 *   # dry-run, then re-run with --broadcast on each chain
 */
contract DeployPortfolioShare is Script {
    // 0.0001 ETH in wei — same order of magnitude as chat/board
    uint256 constant INITIAL_FEE = 100000000000000;

    function run() external {
        vm.startBroadcast();

        PortfolioShare impl = new PortfolioShare();
        ERC1967Proxy proxy =
            new ERC1967Proxy(address(impl), abi.encodeCall(PortfolioShare.initialize, (INITIAL_FEE)));

        vm.stopBroadcast();

        console.log("PortfolioShare proxy deployed at:", address(proxy));
        console.log("PortfolioShare implementation at:", address(impl));
        console.log("Initial fee (wei):", PortfolioShare(address(proxy)).fee());
        console.log("Owner:", PortfolioShare(address(proxy)).owner());
        console.log("Upgradeable: YES (UUPS)");
    }
}
