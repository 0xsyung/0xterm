// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EnsRegistry} from "../src/EnsRegistry.sol";

/**
 * @dev Test-only "v2" of EnsRegistry, used to prove UUPS upgrades keep records.
 *      MUST preserve EnsRegistry's exact storage layout (addrOf then nameOf)
 *      and only ADD new state at the end. Do not use in production.
 */
contract EnsRegistryV2 is EnsRegistry {
    uint256 public versionTag;

    function setVersionTag(uint256 x) external {
        versionTag = x;
    }
}
