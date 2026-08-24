// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.6.6;

import {SimpleRouter} from "../src/SimpleRouter.sol";

// Minimal Vm interface — forge-std's Vm requires solc >=0.8.13, but
// v2-core pins solc =0.5.16, so we can't import forge-std here.
interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/**
 * @title DeployUniswapV2Router
 * @dev Deploys a SimpleRouter pointed at an existing factory + WETH.
 *      Run under the `univ2` profile (after DeployUniswapV2Factory):
 *
 *   FOUNDRY_PROFILE=univ2 forge script \
 *     script-univ2/DeployUniswapV2Router.s.sol:DeployUniswapV2Router \
 *     --rpc-url $RPC_URL --account <account-name> --sender <YOUR_ADDRESS> \
 *     --sig "run(address)" <FACTORY_ADDRESS> --broadcast
 *
 * <FACTORY_ADDRESS> comes from the factory deploy step. Note down the printed
 * router address; it is the router in the frontend DEX_REGISTRY.
 * See script-univ2/UniswapV2Deploy.md.
 *
 * NOTE: the full UniswapV2Router02 exceeds the EIP-170 contract size limit
 * (26887 > 24576 bytes), so this deploys the repo's compact SimpleRouter
 * instead — it provides swapExactTokensForTokens + addLiquidity, which is
 * what the frontend's V2 path uses. Native-to-token swaps (swapExactETHForTokens)
 * are NOT supported on this router.
 */
contract DeployUniswapV2Router {
    // WETH9 for the target chain — Sepolia's canonical WETH.
    address constant WETH9 = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;

    function run(address factoryAddr) external {
        Vm vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

        vm.startBroadcast();

        SimpleRouter router = new SimpleRouter(factoryAddr, WETH9);

        vm.stopBroadcast();

        emit RouterDeployed(address(router), router.factory(), router.WETH());
    }

    event RouterDeployed(address router, address factory, address weth);
}
