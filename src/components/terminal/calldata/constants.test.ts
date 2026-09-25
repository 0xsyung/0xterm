/**
 * @file constants.test.ts
 * @description calldata constants unit tests (#110)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it } from "vitest";
import { CALDATA_ERROR, KNOWN_ABIS } from "./constants";

describe("KNOWN_ABIS", () => {
  it("offers the standard ABI set plus arb-executor", () => {
    const ids = KNOWN_ABIS.map((a) => a.id);
    expect(ids).toContain("erc20");
    expect(ids).toContain("univ2-router");
    expect(ids).toContain("univ3-router");
    expect(ids).toContain("univ2-factory");
    expect(ids).toContain("univ3-factory");
    expect(ids).toContain("univ3-pool");
    expect(ids).toContain("npm");
    expect(ids).toContain("arb-executor");
  });

  it("every ABI is non-empty and has an item", () => {
    for (const a of KNOWN_ABIS) {
      expect(a.abi.length).toBeGreaterThan(0);
    }
  });
});

describe("CALDATA_ERROR", () => {
  it("returns strings for literal codes", () => {
    expect(CALDATA_ERROR.bad_to).toContain("calldata.bad_to");
    expect(CALDATA_ERROR.no_chain).toContain("calldata.no_chain");
    expect(CALDATA_ERROR.sim_rpc).toContain("calldata.sim_rpc");
  });

  it("builds messages from params via function entries", () => {
    expect(CALDATA_ERROR.bad_sig("boom")).toContain("boom");
    expect(CALDATA_ERROR.bad_fn("transfer")).toContain("transfer");
    expect(CALDATA_ERROR.arity(2, 1, "transfer")).toContain("transfer");
    expect(CALDATA_ERROR.arg(0, "address")).toContain("address");
    expect(CALDATA_ERROR.sim_revert("NO_PROFIT")).toContain("NO_PROFIT");
  });
});
