// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.5.16;

import {UniswapV2Factory} from "@uniswap/v2-core/contracts/UniswapV2Factory.sol";

// Minimal Vm interface — forge-std's Vm requires solc >=0.8.13, but v2-core
// pins solc =0.5.16, so we can't import forge-std here.
interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/**
 * @title DeployUniswapV2Factory
 * @dev Deploys a fresh Uniswap V2 factory for a chain with no canonical
 *      Uniswap (e.g. Sepolia's custom V2). Run under the `univ2` profile:
 *
 *   FOUNDRY_PROFILE=univ2 forge script \
 *     script-univ2/DeployUniswapV2Factory.s.sol:DeployUniswapV2Factory \
 *     --rpc-url $RPC_URL --account <account-name> --sender <YOUR_ADDRESS>
 *   # dry-run first, then re-run with --broadcast
 *
 * The --sender account becomes the feeToSetter. Note down the printed address;
 * it is the `factory` arg for DeployUniswapV2Router.s.sol and the factory in
 * the frontend DEX_REGISTRY. See script-univ2/UniswapV2Deploy.md.
 */
contract DeployUniswapV2Factory {
    function run() external {
        Vm vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

        address feeToSetter = msg.sender;

        vm.startBroadcast();

        UniswapV2Factory factory = new UniswapV2Factory(feeToSetter);

        vm.stopBroadcast();

        // solc 0.5.16 can't use console.log — emit instead
        emit FactoryDeployed(address(factory), factory.feeToSetter());
    }

    event FactoryDeployed(address factory, address feeToSetter);
}
