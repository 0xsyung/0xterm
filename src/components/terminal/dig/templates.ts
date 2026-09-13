/**
 * @file templates.ts
 * @description Default Counter.sol template for dig new (#39)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { DIG_DEFAULT_SOLC_VERSION } from "./constants";

export function counterTemplate(
  name = "Counter",
  solcVersion: string = DIG_DEFAULT_SOLC_VERSION
): { filename: string; content: string } {
  const safe = /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : "Counter";
  const content = `// SPDX-License-Identifier: MIT
pragma solidity ^${solcVersion};

contract ${safe} {
    uint256 public value;

    function increment() external {
        value += 1;
    }

    function set(uint256 v) external {
        value = v;
    }
}
`;
  return { filename: `${safe}.sol`, content };
}
