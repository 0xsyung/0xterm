// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/Chat.sol";

/**
 * @title DeployChat
 * @dev Deploys the upgradeable Chat: a UUPS implementation + an ERC1967Proxy
 *      that owns the storage (chat history). The proxy is what callers talk to;
 *      its address differs per chain (plain CREATE), so wire the per-chain proxy
 *      address into the frontend CHAT_CONTRACT.
 *
 *      Upgrades later swap only the implementation via upgradeToAndCall() — the
 *      proxy (and therefore all chat history) stays put. See UpgradeChat.s.sol
 *      and script/ChatDeploy.md.
 *
 * Usage (testnet only — see script/ChatDeploy.md):
 *   export SEPOLIA_RPC_URL=...
 *   forge script script/DeployChat.s.sol \
 *     --rpc-url $SEPOLIA_RPC_URL --account <account-name> --sender <YOUR_ADDRESS>
 *   # dry-run, then re-run with --broadcast on each chain
 */
contract DeployChat is Script {
    // 0.0001 ETH in wei
    uint256 constant INITIAL_FEE = 100000000000000;

    function run() external {
        vm.startBroadcast();

        Chat impl = new Chat();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(Chat.initialize, (INITIAL_FEE))
        );

        vm.stopBroadcast();

        console.log("Chat proxy deployed at:", address(proxy));
        console.log("Chat implementation at:", address(impl));
        console.log("Initial fee (wei):", Chat(address(proxy)).fee());
        console.log("Owner:", Chat(address(proxy)).owner());
        console.log("Upgradeable: YES (UUPS - use UpgradeChat.s.sol to upgrade)");
    }
}
