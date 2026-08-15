// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title ERC20Base
 * @dev Base logic contract for EIP-1167 Minimal Proxies deployed via 0xTERM.
 */
contract ERC20Base is Initializable, ERC20Upgradeable {
    uint8 private _customDecimals;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Locks the logic contract so it cannot be maliciously initialized by outside actors
        _disableInitializers();
    }

    function initialize(
        string memory name_, 
        string memory symbol_, 
        uint8 decimals_
    ) public initializer {
        __ERC20_init(name_, symbol_);
        _customDecimals = decimals_;
    }

    // Override the default OZ 18 decimals to use the terminal user's input
    function decimals() public view virtual override returns (uint8) {
        return _customDecimals;
    }
}