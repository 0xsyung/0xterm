// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.6;

import {WETH9} from "../src/WETH9.sol";
import {UniswapV3Factory} from "@uniswap/v3-core/contracts/UniswapV3Factory.sol";
import {SwapRouter} from "@uniswap/v3-periphery/contracts/SwapRouter.sol";
import {NonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/NonfungiblePositionManager.sol";

// Minimal Vm interface — forge-std's Vm requires solc >=0.8.13, but the
// v3-periphery contracts pin solc =0.7.6, so we can't import forge-std here.
interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

// No-op position descriptor: implements the same `tokenURI` selector as
// INonfungibleTokenPositionDescriptor so the NPM stays functional, while
// avoiding the heavy NFTDescriptor/NFTSVG libraries that hit a solc 0.7.6
// "Stack too deep" compiler error. LP NFT metadata is empty — positions still
// work, they just have no pretty SVG image.
contract NoopTokenDescriptor {
    event UpdateTokenRatioPriority(address token, int256 priority);

    function tokenURI(address, uint256) external pure returns (string memory) {
        return "";
    }
}

/**
 * @title DeployUniswapV3Fork
 * @dev Deploys a self-contained Uniswap V3 fork on the target chain (intended
 *      for Polygon Amoy, chainId 80002, which has no official Uniswap V3).
 *
 * Deployment order (all from the signing account, which becomes the factory owner):
 *   1. WETH9 ................ wrapped native token (used as the fork's WETH9 slot)
 *   2. UniswapV3Factory ..... pool factory (owner = deployer; enables fees 500/3000/10000)
 *   3. NoopTokenDescriptor .... no-op LP NFT metadata (empty tokenURI; avoids
 *        the heavy NFTDescriptor/NFTSVG libs that fail solc 0.7.6 stack-too-deep)
 *   4. SwapRouter ........... (factory, WETH9)
 *   5. NonfungiblePositionManager ........... (factory, WETH9, descriptor)
 *
 * Usage (see script-univ3/README.md for the full keystore runbook):
 *   FOUNDRY_PROFILE=univ3 forge script \
 *     script-univ3/DeployUniswapV3Fork.s.sol:DeployUniswapV3Fork \
 *     --rpc-url $AMOY_RPC_URL --account <KEYSTORE_ACCOUNT> --broadcast \
 *     --sender <DEPLOYER_ADDRESS> --slow
 *
 * After a successful broadcast, copy the five logged addresses into the
 * frontend DEX_REGISTRY[80002] entry and the WETH9 address into
 * WRAPPED_NATIVE[80002] (both commented placeholders in constants.ts).
 */
contract DeployUniswapV3Fork {
    Vm private constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    event Deployed(
        address weth9,
        address factory,
        address descriptor,
        address router,
        address positionManager
    );

    function run() external {
        vm.startBroadcast();

        WETH9 weth9 = new WETH9();

        UniswapV3Factory factory = new UniswapV3Factory();

        NoopTokenDescriptor descriptor = new NoopTokenDescriptor();

        SwapRouter router = new SwapRouter(address(factory), address(weth9));

        NonfungiblePositionManager npm = new NonfungiblePositionManager(
            address(factory),
            address(weth9),
            address(descriptor)
        );

        vm.stopBroadcast();

        emit Deployed(
            address(weth9),
            address(factory),
            address(descriptor),
            address(router),
            address(npm)
        );
    }
}
