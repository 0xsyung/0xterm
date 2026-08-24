// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Chat} from "../src/Chat.sol";

/**
 * @dev Test-only "v2" of Chat, used to prove UUPS upgrades keep history.
 *      MUST preserve Chat's exact storage layout (fee first) and only ADD
 *      new state at the end. Do not use in production.
 */
contract ChatV2 is Chat {
    uint256 public extraFeeForTest;

    function setExtraFeeForTest(uint256 x) external {
        extraFeeForTest = x;
    }
}
