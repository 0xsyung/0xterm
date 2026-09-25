/**
 * @file sim.test.ts
 * @description arb eth_call dry-run unit tests (#27)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi } from "vitest";
import { sepolia } from "viem/chains";
import type { RunParamsArgs } from "./calldata";
import { arbSim } from "./sim";

const EXECUTOR = "0xD18023E5B8Db53ab21D3D7ee93680bb3DAC3f4fb";

function params(): RunParamsArgs {
  return {
    tokenStart: "0x1111111111111111111111111111111111111111",
    tokenOther: "0x2222222222222222222222222222222222222222",
    poolA: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    poolB: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    poolC: "0xcccccccccccccccccccccccccccccccccccccccc",
    feeA: 3000,
    feeB: 3000,
    feeC: 3000,
    aIsV3: true,
    bIsV3: true,
    cIsV3: true,
    amountIn: 1000000n,
    minProfit: 1n,
  };
}

describe("arbSim", () => {
  it("returns ok when eth_call succeeds", async () => {
    const client = { call: vi.fn(async () => ({})) };
    const res = await arbSim(sepolia, EXECUTOR, params(), {
      client: client as never,
    });
    expect(res).toEqual({ ok: true });
  });

  it("maps NO_PROFIT / NO_POOL reverts to arb.gone", async () => {
    const client = {
      call: vi.fn(async () => {
        throw new Error("execution reverted: NO_PROFIT");
      }),
    };
    const res = await arbSim(sepolia, EXECUTOR, params(), {
      client: client as never,
    });
    expect(res).toEqual({ ok: false, code: "arb.gone", reason: "execution reverted: NO_PROFIT" });
  });

  it("maps network/http errors to arb.bad_rpc", async () => {
    const client = {
      call: vi.fn(async () => {
        throw new Error("ECONNREFUSED timeout");
      }),
    };
    const res = await arbSim(sepolia, EXECUTOR, params(), {
      client: client as never,
    });
    expect(res).toEqual({ ok: false, code: "arb.bad_rpc", reason: "ECONNREFUSED timeout" });
  });

  it("falls back to arb.gone for other errors", async () => {
    const client = {
      call: vi.fn(async () => {
        throw new Error("some other revert");
      }),
    };
    const res = await arbSim(sepolia, EXECUTOR, params(), {
      client: client as never,
    });
    expect(res).toEqual({ ok: false, code: "arb.gone", reason: "some other revert" });
  });
});
