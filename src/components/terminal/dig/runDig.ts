/**
 * @file runDig.ts
 * @description Dig command router — pure-ish results for TerminalShell (#39)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { DIG_ERROR, DIG_SUBCOMMANDS } from "./constants";
import {
  digArtifactPinTitle,
  formatCompileSummary,
  pickArtifact,
  summarizeCompile,
  type DigContractArtifact
} from "./artifact";
import {
  loadDigArtifacts,
  loadDigLastSummary,
  loadDigSolcVersion,
  loadDigSource,
  saveDigArtifacts,
  saveDigLastSummary,
  saveDigSolcVersion,
  saveDigSource
} from "./idb";
import { rowsFromArtifact, formatOpcodeLines } from "./opcodes";
import { compileDigSource } from "./solc";
import { counterTemplate } from "./templates";
import {
  defaultSolcVersion,
  formatVersionList,
  pickSolcVersion
} from "./version";

export type DigTextResult = {
  kind: "text";
  text: string;
  warn?: boolean;
  muted?: boolean;
};

export type DigEditorResult = {
  kind: "editor";
  filename: string;
  content: string;
  mode: "edit" | "open";
};

export type DigArtifactResult = {
  kind: "artifact";
  artifact: DigContractArtifact;
  title: string;
};

export type DigAbiResult = {
  kind: "abi";
  name: string;
  abi: DigContractArtifact["abi"];
};

export type DigOpcodesResult = {
  kind: "opcodes";
  name: string;
  rows: ReturnType<typeof rowsFromArtifact>;
  truncated: boolean;
};

export type DigDeployResult = {
  kind: "deploy";
  type: "erc20" | "erc721";
  name: string;
  symbol: string;
  decimals: number;
};

export type DigMultiText = {
  kind: "multi-text";
  lines: Array<{ text: string; warn?: boolean; muted?: boolean }>;
};

export type DigResult =
  | DigTextResult
  | DigEditorResult
  | DigArtifactResult
  | DigAbiResult
  | DigOpcodesResult
  | DigDeployResult
  | DigMultiText
  | DigResult[];

function usage(): DigTextResult {
  return {
    kind: "text",
    text: "Usage: dig [new|open|edit|compile|ver|bytecode|abi|opcodes|artifact|deploy] …"
  };
}

export async function runDig(args: string[]): Promise<DigResult> {
  // args[0] is "dig" | "compile" | "solc" (aliases normalized by caller)
  const argv = [...args];
  let head = (argv[0] || "dig").toLowerCase();
  if (head === "compile") {
    argv.splice(0, 1, "dig", "compile");
    head = "dig";
  } else if (head === "solc") {
    argv.splice(0, 1, "dig", "ver");
    head = "dig";
  }

  const sub = (argv[1] || "").toLowerCase();

  if (!sub) {
    const summary = await loadDigLastSummary();
    const ver = await loadDigSolcVersion();
    if (!summary) {
      return {
        kind: "text",
        text: `[dig] solc ${ver}\nno compile yet — dig new · dig compile`
      };
    }
    return { kind: "text", text: summary };
  }

  if (sub === "new") {
    const name = argv[2] || "Counter";
    const ver = await loadDigSolcVersion();
    const tpl = counterTemplate(name, ver);
    await saveDigSource(tpl.filename, tpl.content);
    return {
      kind: "editor",
      filename: tpl.filename,
      content: tpl.content,
      mode: "edit"
    };
  }

  if (sub === "open") {
    const existing = await loadDigSource();
    return {
      kind: "editor",
      filename: existing?.filename || "Contract.sol",
      content: existing?.content || "",
      mode: "open"
    };
  }

  if (sub === "edit") {
    const existing = await loadDigSource();
    if (!existing || !existing.content.trim()) {
      return { kind: "text", text: DIG_ERROR.no_source, warn: true };
    }
    return {
      kind: "editor",
      filename: existing.filename,
      content: existing.content,
      mode: "edit"
    };
  }

  if (sub === "ver") {
    const cur = await loadDigSolcVersion();
    const raw = argv[2];
    if (!raw) {
      return { kind: "text", text: formatVersionList(cur) };
    }
    const picked = pickSolcVersion(raw);
    if (!picked.ok) {
      return { kind: "text", text: picked.reason, warn: true };
    }
    await saveDigSolcVersion(picked.version);
    return {
      kind: "text",
      text: `[✓] solc → ${picked.version}`
    };
  }

  if (sub === "compile") {
    const source = await loadDigSource();
    if (!source || !source.content.trim()) {
      return { kind: "text", text: DIG_ERROR.no_source, warn: true };
    }
    const ver = await loadDigSolcVersion();
    const result = await compileDigSource({
      filename: source.filename,
      content: source.content,
      solcVersion: ver
    });
    if (!result.ok) {
      if (result.code === "compile_fail") {
        const lines: DigMultiText["lines"] = [
          { text: DIG_ERROR.compile_fail, warn: true }
        ];
        for (const e of result.errors || []) {
          lines.push({ text: e, warn: true });
        }
        for (const w of result.warnings || []) {
          lines.push({ text: w, muted: true });
        }
        const summary = formatCompileSummary(
          summarizeCompile(ver, [], result.errors?.length || 0, result.warnings?.length || 0)
        );
        await saveDigLastSummary(summary);
        await saveDigArtifacts([]);
        return { kind: "multi-text", lines };
      }
      return { kind: "text", text: result.message, warn: true };
    }
    await saveDigArtifacts(result.artifacts);
    const summary = formatCompileSummary(
      summarizeCompile(
        result.solcVersion,
        result.artifacts,
        0,
        result.warnings.length
      )
    );
    await saveDigLastSummary(summary);
    const out: DigResult[] = [{ kind: "text", text: summary }];
    for (const w of result.warnings) {
      out.push({ kind: "text", text: w, muted: true });
    }
    const contractArg = argv[2];
    const art = pickArtifact(result.artifacts, contractArg);
    if (art) {
      out.push({
        kind: "artifact",
        artifact: art,
        title: digArtifactPinTitle(art)
      });
    }
    return out;
  }

  if (sub === "bytecode" || sub === "abi" || sub === "opcodes" || sub === "artifact") {
    const artifacts = await loadDigArtifacts();
    const wantAll = argv.includes("--all");
    const nameArg = argv.find(
      (a, i) => i >= 2 && a !== "--all" && !a.startsWith("-")
    );
    const art = pickArtifact(artifacts, nameArg);
    if (!art) {
      return { kind: "text", text: DIG_ERROR.no_artifact, warn: true };
    }
    if (sub === "bytecode") {
      return {
        kind: "text",
        text: `[${art.name}]\ncreation:\n${art.creationBytecode}\n\nruntime:\n${art.runtimeBytecode}`
      };
    }
    if (sub === "abi") {
      return { kind: "abi", name: art.name, abi: art.abi };
    }
    if (sub === "opcodes") {
      const rows = rowsFromArtifact(art.opcodes, art.runtimeBytecode);
      const fmt = formatOpcodeLines(rows, { all: wantAll });
      return {
        kind: "opcodes",
        name: art.name,
        rows: wantAll ? rows : rows.slice(0, fmt.lines.length),
        truncated: fmt.truncated
      };
    }
    return {
      kind: "artifact",
      artifact: art,
      title: digArtifactPinTitle(art)
    };
  }

  if (sub === "deploy") {
    const type = (argv[2] || "").toLowerCase();
    if (type !== "erc20" && type !== "erc721") {
      return {
        kind: "text",
        text: "Usage: dig deploy <erc20|erc721> <name> <symbol> [decimals]",
        warn: true
      };
    }
    const name = argv[3];
    const symbol = argv[4];
    const decimals =
      type === "erc20" ? (argv[5] ? parseInt(argv[5], 10) : 18) : 0;
    if (!name || !symbol) {
      return {
        kind: "text",
        text: `Usage: dig deploy ${type} <name> <symbol>${type === "erc20" ? " [decimals]" : ""}`,
        warn: true
      };
    }
    return { kind: "deploy", type, name, symbol, decimals };
  }

  if (!(DIG_SUBCOMMANDS as readonly string[]).includes(sub)) {
    return usage();
  }
  return usage();
}

export { defaultSolcVersion };
