/**
 * @file pragma.test.ts
 * @description Unit tests for dig pragma / import helpers (#39)
 */
import { describe, expect, it } from "vitest";
import {
  findImports,
  hasSpdx,
  parsePragma,
  parseSemver,
  pragmaMatchesVersion
} from "./pragma";

describe("parseSemver / pragma", () => {
  it("parses semver", () => {
    expect(parseSemver("0.8.37")).toEqual([0, 8, 37]);
    expect(parseSemver("v0.8.28")).toEqual([0, 8, 28]);
    expect(parseSemver("nope")).toBeNull();
  });

  it("requires SPDX + pragma for match helpers", () => {
    const src = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.37;\ncontract C {}`;
    expect(hasSpdx(src)).toBe(true);
    expect(parsePragma(src)?.raw).toContain("^0.8.37");
    expect(pragmaMatchesVersion(src, "0.8.37")).toBe(true);
    expect(pragmaMatchesVersion(src, "0.8.20")).toBe(false);
  });

  it("handles range pragmas", () => {
    const src = `// SPDX-License-Identifier: MIT\npragma solidity >=0.8.0 <0.9.0;\n`;
    expect(pragmaMatchesVersion(src, "0.8.37")).toBe(true);
    expect(pragmaMatchesVersion(src, "0.7.6")).toBe(false);
  });

  it("rejects missing pragma", () => {
    expect(pragmaMatchesVersion("contract C {}", "0.8.37")).toBe(false);
  });

  it("finds imports", () => {
    expect(findImports('import "./Foo.sol";')).toEqual(["./Foo.sol"]);
    expect(findImports("contract C {}")).toEqual([]);
  });
});

  it("handles OR pragma groups", () => {
    const src = `// SPDX-License-Identifier: MIT\npragma solidity ^0.7.0 || ^0.8.0;\n`;
    expect(pragmaMatchesVersion(src, "0.8.37")).toBe(true);
  });

  it("handles ~ and exact ops", () => {
    const tilde = `// SPDX-License-Identifier: MIT\npragma solidity ~0.8.37;\n`;
    expect(pragmaMatchesVersion(tilde, "0.8.37")).toBe(true);
    expect(pragmaMatchesVersion(tilde, "0.8.40")).toBe(true);
    expect(pragmaMatchesVersion(tilde, "0.9.0")).toBe(false);
    const exact = `// SPDX-License-Identifier: MIT\npragma solidity 0.8.37;\n`;
    expect(pragmaMatchesVersion(exact, "0.8.37")).toBe(true);
    expect(pragmaMatchesVersion(exact, "0.8.36")).toBe(false);
  });
