// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title ERC721Base
 * @dev Base logic contract for EIP-1167 Minimal Proxies deployed via 0xTERM.
 */
contract ERC721Base is Initializable, ERC721Upgradeable {
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_, 
        string memory symbol_
    ) public initializer {
        __ERC721_init(name_, symbol_);
    }
}