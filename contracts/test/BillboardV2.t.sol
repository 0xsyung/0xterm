// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Billboard} from "../src/Billboard.sol";

/**
 * @dev Test-only "v2" of Billboard, used to prove UUPS upgrades keep posts.
 *      MUST preserve Billboard's exact storage layout (fee, then posts,
 *      postCount) and only ADD new state at the end. Do not use in production.
 */
contract BillboardV2 is Billboard {
    uint256 public versionTag;

    function setVersionTag(uint256 x) external {
        versionTag = x;
    }
}
