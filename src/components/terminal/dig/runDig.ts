/**
 * @file runDig.ts
 * @description Dig command router — compile (#39) + run (#40) + debug (#41)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { Address } from "viem";
import { isAddress } from "viem";
import {
  DIG_ERROR,
  DIG_RESERVED_DEPLOY,
  DIG_SUBCOMMANDS,
  type DigEnvKind
} from "./constants";
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
import { extractCallArgs, extractDeployArgs } from "./args";
import {
  checksumAddr,
  decodeDigLogs,
  decodeDigReturn,
  encodeDigCall,
  encodeDigDeploy,
  formatReturnValues,
  isViewLike,
  truncateAddress,
  truncateHex
} from "./encode";
import { formatGas, formatGasEstimateLine } from "./gas";
import {
  addDigDeployment,
  getActiveDigDeployment,
  getDigDebugSession,
  getDigEnv,
  getLastDigDebugTarget,
  getLastDigPanel,
  getLastDigReceipt,
  listDigDeployments,
  setDigDebugSession,
  setDigEnv,
  setLastDigDebugTarget,
  setLastDigPanel,
  setLastDigReceipt,
  envLabel,
  type DigDeployment,
  type DigRunPanelState
} from "./session";
import { digVmHardforkLabel, digVmTestAccount, vmCall, vmDeploy } from "./vm";
import {
  addBreakpoint,
  buildLineByPc,
  buildTraceFromSteps,
  clearBreakpoints,
  currentStep,
  formatMemSlice,
  panelFromSession,
  stepBack,
  stepInto,
  stepOut,
  stepOver,
  stepsFromStructLogs,
  storageUpTo,
  stackTop8,
  type DigDebugPanelState,
  type DigDebugSession,
  type DigTraceStep
} from "./debug";

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

export type DigRunResult = {
  kind: "run";
  panel: DigRunPanelState;
};

export type DigConfirmResult = {
  kind: "confirm";
  to: Address;
  data: `0x${string}`;
  dataSummary: string;
  value: bigint;
  gasEstimate: bigint;
  /** After user confirms — apply on chain. */
  intent: "deploy" | "send";
  contractName: string;
  fn?: string;
  abi: DigContractArtifact["abi"];
  artifact?: DigContractArtifact;
};

export type DigLsResult = {
  kind: "ls";
  rows: Array<{
    name: string;
    address: Address;
    envLabel: string;
  }>;
  emptyMuted?: string;
};

export type DigFnResult = {
  kind: "fn";
  name: string;
  view: string[];
  write: string[];
};

export type DigDebugResult = {
  kind: "debug";
  panel: DigDebugPanelState;
  /** When true, shell should remove the dig-debug card. */
  stop?: boolean;
};

export type DigResult =
  | DigTextResult
  | DigEditorResult
  | DigArtifactResult
  | DigAbiResult
  | DigOpcodesResult
  | DigDeployResult
  | DigMultiText
  | DigRunResult
  | DigConfirmResult
  | DigLsResult
  | DigFnResult
  | DigDebugResult
  | DigResult[];

export type DigRunContext = {
  isConnected: boolean;
  address?: Address;
  chainId?: number;
  chainName?: string;
  /** eth_call / estimateGas / simulate on live chain */
  chainCall?: (args: {
    to?: Address;
    data: `0x${string}`;
    value?: bigint;
    account?: Address;
  }) => Promise<{ returnData: `0x${string}`; gasUsed?: bigint }>;
  chainEstimateGas?: (args: {
    to?: Address;
    data: `0x${string}`;
    value?: bigint;
    account?: Address;
  }) => Promise<bigint>;
  /** Pre-flight sim; throw/return revert reason */
  chainSimulate?: (args: {
    to?: Address;
    data: `0x${string}`;
    value?: bigint;
    account?: Address;
  }) => Promise<{ ok: true } | { ok: false; reason: string }>;
  /** debug_traceTransaction — fail closed when RPC refuses (#41). */
  debugTraceTransaction?: (
    txHash: `0x${string}`
  ) => Promise<
    | { ok: true; structLogs: unknown[]; mapMismatch?: boolean }
    | { ok: false; code: "debug_no_trace" | "map_mismatch"; reason?: string }
  >;
};

function usage(): DigTextResult {
  return {
    kind: "text",
    text: "Usage: dig [new|open|edit|compile|ver|bytecode|abi|opcodes|artifact|deploy|env|at|ls|fn|call|send|logs|gas|receipt|debug|step|over|out|back|br|op|stack|mem|stor|vars] …"
  };
}

function warn(text: string): DigTextResult {
  return { kind: "text", text, warn: true };
}

function text(t: string, opts?: { muted?: boolean }): DigTextResult {
  return { kind: "text", text: t, muted: opts?.muted };
}

function panelFrom(
  d: DigDeployment,
  patch: Partial<DigRunPanelState>
): DigRunPanelState {
  const prev = getLastDigPanel();
  const base: DigRunPanelState = {
    name: d.name,
    address: d.address,
    env: d.env,
    chainName: d.chainName,
    events: [],
    gasLabel: "GAS USED",
    gas: prev?.gas || "0",
    ...patch
  };
  setLastDigPanel(base);
  return base;
}

function rememberVmTrace(opts: {
  kind: "send" | "deploy";
  steps?: DigTraceStep[];
  truncated?: boolean;
  ok: boolean;
  artifact?: DigDeployment["artifact"];
  source?: string;
}): void {
  if (!opts.steps || opts.steps.length === 0) return;
  const built = buildTraceFromSteps(opts.steps, {
    status: opts.ok ? "OK" : "REVERT"
  });
  setLastDigDebugTarget({
    kind: opts.kind,
    steps: built.steps,
    truncated: built.truncated || !!opts.truncated,
    status: built.status,
    artifact: opts.artifact,
    source: opts.source,
    runtimeBytecode: opts.artifact?.runtimeBytecode
  });
}

function openDebugSession(opts: {
  steps: DigTraceStep[];
  truncated: boolean;
  status: "OK" | "REVERT";
  artifact?: DigDeployment["artifact"];
  source?: string;
  mapMismatch?: boolean;
}): DigDebugResult {
  const art = opts.artifact;
  const { lineByPc, hasSourceMap } = buildLineByPc({
    sourceMap: art?.deployedSourceMap || art?.sourceMap,
    runtimeBytecode: art?.runtimeBytecode,
    source: opts.source
  });
  const sourceLines = opts.source ? opts.source.split("\n") : undefined;
  // Land on last step if REVERT so widget shows REVERT opcode
  let index = 0;
  if (opts.status === "REVERT" && opts.steps.length > 0) {
    index = opts.steps.length - 1;
  }
  const session: DigDebugSession = {
    steps: opts.steps,
    truncated: opts.truncated,
    status: opts.status,
    index,
    breakpoints: [],
    mapMismatch: opts.mapMismatch,
    hasSourceMap,
    sourceLines,
    lineByPc
  };
  setDigDebugSession(session);
  return { kind: "debug", panel: panelFromSession(session) };
}

function requireDebug(): DigTextResult | DigDebugSession {
  const s = getDigDebugSession();
  if (!s || s.steps.length === 0) {
    return warn(DIG_ERROR.no_tx);
  }
  return s;
}

function debugPanelResult(session: DigDebugSession): DigDebugResult {
  setDigDebugSession(session);
  return { kind: "debug", panel: panelFromSession(session) };
}


export async function runDig(
  args: string[],
  ctx: DigRunContext = { isConnected: false }
): Promise<DigResult> {
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
      return warn(DIG_ERROR.no_source);
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
      return warn(picked.reason);
    }
    await saveDigSolcVersion(picked.version);
    return { kind: "text", text: `[✓] solc → ${picked.version}` };
  }

  if (sub === "compile") {
    const source = await loadDigSource();
    if (!source || !source.content.trim()) {
      return warn(DIG_ERROR.no_source);
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
      return warn(result.message);
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
      return warn(DIG_ERROR.no_artifact);
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

  // —— #40 run surface ——
  if (sub === "env") {
    const which = (argv[2] || "").toLowerCase() as DigEnvKind | "";
    if (!which) {
      const env = getDigEnv();
      if (env === "vm") {
        return {
          kind: "multi-text",
          lines: [
            { text: `[✓] dig env → vm (hardfork ${digVmHardforkLabel()})` },
            { text: "VM · not a live chain", muted: true },
            { text: `test account ${digVmTestAccount()}`, muted: true }
          ]
        };
      }
      const label = env === "injected" ? "INJECTED" : "LOCAL";
      const chain = ctx.chainName ? ` · ${ctx.chainName}` : "";
      return text(`[✓] dig env → ${env}${chain || ` (${label})`}`);
    }
    if (which !== "vm" && which !== "injected" && which !== "local") {
      return warn("Usage: dig env [vm|injected|local]");
    }
    if (which === "injected" || which === "local") {
      if (!ctx.isConnected || !ctx.address) {
        return warn(DIG_ERROR.need_wallet);
      }
    }
    setDigEnv(which);
    if (which === "vm") {
      return {
        kind: "multi-text",
        lines: [
          { text: `[✓] dig env → vm (hardfork ${digVmHardforkLabel()})` },
          { text: "VM · not a live chain", muted: true }
        ]
      };
    }
    return text(
      `[✓] dig env → ${which}${ctx.chainName ? ` · ${ctx.chainName}` : ""}`
    );
  }

  if (sub === "deploy") {
    const type = (argv[2] || "").toLowerCase();
    if (type === "erc20" || type === "erc721") {
      const name = argv[3];
      const symbol = argv[4];
      const decimals =
        type === "erc20" ? (argv[5] ? parseInt(argv[5], 10) : 18) : 0;
      if (!name || !symbol) {
        return warn(
          `Usage: dig deploy ${type} <name> <symbol>${type === "erc20" ? " [decimals]" : ""}`
        );
      }
      return { kind: "deploy", type, name, symbol, decimals };
    }

    // Artifact deploy path
    const artifacts = await loadDigArtifacts();
    if (!artifacts.length) return warn(DIG_ERROR.no_artifact);

    const parsed = extractDeployArgs(argv);
    if (parsed.error === "arg") return warn(DIG_ERROR.arg);

    const contractArg = parsed.contractArg;
    // If first token looks like reserved name used as contract
    if (
      contractArg &&
      (DIG_RESERVED_DEPLOY as readonly string[]).includes(
        contractArg.toLowerCase()
      )
    ) {
      // Could be bare `dig deploy erc20` without name — already handled above when type matches
      // Collision: compiled contract named erc20
      const named = pickArtifact(artifacts, contractArg);
      if (named) {
        return warn(DIG_ERROR.reserved(contractArg.toLowerCase()));
      }
    }

    const art = pickArtifact(artifacts, contractArg);
    if (!art) {
      if (!contractArg) return warn(DIG_ERROR.no_artifact);
      return warn(
        `Usage: dig deploy [Contract] [--args …]  or  dig deploy <erc20|erc721> …`
      );
    }
    // Reserved name collision when deploying by FQN still OK; by bare reserved refused
    if (
      (DIG_RESERVED_DEPLOY as readonly string[]).includes(
        art.name.toLowerCase()
      ) &&
      (!contractArg || !contractArg.includes(":"))
    ) {
      return warn(DIG_ERROR.reserved(art.name.toLowerCase()));
    }

    const bytecode = (
      art.creationBytecode.startsWith("0x")
        ? art.creationBytecode
        : `0x${art.creationBytecode}`
    ) as `0x${string}`;
    const encoded = encodeDigDeploy({
      abi: art.abi,
      bytecode,
      argTokens: parsed.ctorArgs
    });
    if (!encoded.ok) return warn(DIG_ERROR.arg);

    const env = getDigEnv();
    const value = parsed.valueWei ?? 0n;

    if (env === "vm") {
      const src = await loadDigSource();
      const res = await vmDeploy(encoded.data, value, { captureTrace: true });
      rememberVmTrace({
        kind: "deploy",
        steps: res.trace,
        truncated: res.truncated,
        ok: res.ok,
        artifact: art,
        source: src?.content
      });
      if (!res.ok) {
        const lines: DigMultiText["lines"] = [
          { text: DIG_ERROR.vm_fail(res.reason), warn: true }
        ];
        if (res.truncated) {
          lines.push({ text: DIG_ERROR.debug_too_long, warn: true });
        }
        return { kind: "multi-text", lines };
      }
      const addr = checksumAddr(res.createdAddress!);
      const events = decodeDigLogs(art.abi, res.logs);
      const dep: DigDeployment = {
        name: art.name,
        address: addr,
        env: "vm",
        abi: art.abi,
        artifact: art
      };
      addDigDeployment(dep);
      setLastDigReceipt({
        status: "success",
        gasUsed: res.gasUsed,
        contractAddress: addr,
        logs: events,
        fn: "constructor",
        argsSummary: parsed.ctorArgs.join(" ")
      });
      const panel = panelFrom(dep, {
        lastFn: "constructor",
        argsSummary: parsed.ctorArgs.join(" ") || undefined,
        events,
        gasLabel: "GAS USED",
        gas: formatGas(res.gasUsed)
      });
      return { kind: "run", panel };
    }

    // Chain path — need wallet
    if (!ctx.isConnected || !ctx.address) {
      return warn(DIG_ERROR.need_wallet);
    }
    let gasEstimate = 500_000n;
    try {
      if (ctx.chainEstimateGas) {
        gasEstimate = await ctx.chainEstimateGas({
          data: encoded.data,
          value,
          account: ctx.address
        });
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message.split("\n")[0]! : "estimate failed";
      return warn(DIG_ERROR.reverted(reason.slice(0, 120)));
    }
    if (ctx.chainSimulate) {
      const sim = await ctx.chainSimulate({
        data: encoded.data,
        value,
        account: ctx.address
      });
      if (!sim.ok) return warn(DIG_ERROR.reverted(sim.reason));
    }
    return {
      kind: "confirm",
      to: "0x0000000000000000000000000000000000000000" as Address,
      data: encoded.data,
      dataSummary: `${art.name} constructor${parsed.ctorArgs.length ? `(${parsed.ctorArgs.join(", ")})` : ""}`,
      value,
      gasEstimate,
      intent: "deploy",
      contractName: art.name,
      abi: art.abi,
      artifact: art
    };
  }

  if (sub === "at") {
    const addrRaw = argv[2];
    if (!addrRaw || !isAddress(addrRaw)) {
      return warn("Usage: dig at <address> [Contract]");
    }
    const artifacts = await loadDigArtifacts();
    const art = pickArtifact(artifacts, argv[3]);
    if (!art) return warn(DIG_ERROR.no_artifact);
    const env = getDigEnv();
    if ((env === "injected" || env === "local") && (!ctx.isConnected || !ctx.address)) {
      return warn(DIG_ERROR.need_wallet);
    }
    const dep: DigDeployment = {
      name: art.name,
      address: checksumAddr(addrRaw),
      env,
      chainId: ctx.chainId,
      chainName: ctx.chainName,
      abi: art.abi,
      artifact: art
    };
    addDigDeployment(dep);
    const panel = panelFrom(dep, {
      lastFn: undefined,
      argsSummary: undefined,
      returnValues: undefined,
      events: [],
      gasLabel: "ESTIMATE",
      gas: "—"
    });
    return { kind: "run", panel };
  }

  if (sub === "ls") {
    const list = listDigDeployments();
    if (list.length === 0) {
      return {
        kind: "ls",
        rows: [],
        emptyMuted: "No deploys this session."
      };
    }
    return {
      kind: "ls",
      rows: list.map((d) => ({
        name: d.name,
        address: d.address,
        envLabel: d.env === "vm" ? "VM" : d.chainName || d.env.toUpperCase()
      }))
    };
  }

  if (sub === "fn") {
    const artifacts = await loadDigArtifacts();
    const active = getActiveDigDeployment();
    const art =
      pickArtifact(artifacts, argv[2]) ||
      active?.artifact ||
      (active ? { name: active.name, abi: active.abi } as DigContractArtifact : null);
    if (!art) {
      const a = active;
      if (!a) return warn(DIG_ERROR.no_address);
      const view: string[] = [];
      const write: string[] = [];
      for (const item of a.abi) {
        if (item?.type !== "function" || !item.name) continue;
        const fn = item as { name: string; stateMutability?: string };
        if (fn.stateMutability === "view" || fn.stateMutability === "pure") {
          view.push(fn.name);
        } else write.push(fn.name);
      }
      return { kind: "fn", name: a.name, view, write };
    }
    const view: string[] = [];
    const write: string[] = [];
    for (const item of art.abi) {
      if (item?.type !== "function" || !item.name) continue;
      const sm = item.stateMutability;
      if (sm === "view" || sm === "pure") view.push(item.name);
      else write.push(item.name);
    }
    return { kind: "fn", name: art.name, view, write };
  }

  if (sub === "call" || sub === "send" || sub === "gas") {
    const active = getActiveDigDeployment();
    if (!active) return warn(DIG_ERROR.no_address);
    const parsed = extractCallArgs(argv, 2);
    if (parsed.error === "arg") return warn(DIG_ERROR.arg);
    if (!parsed.fn) {
      return warn(`Usage: dig ${sub} <fn> [args…]`);
    }
    const encoded = encodeDigCall({
      abi: active.abi,
      functionName: parsed.fn,
      argTokens: parsed.args
    });
    if (!encoded.ok) {
      return warn(
        encoded.code === "bad_fn"
          ? DIG_ERROR.bad_fn(parsed.fn)
          : DIG_ERROR.arg
      );
    }
    const value = parsed.valueWei ?? 0n;
    const env = getDigEnv();
    const argsSummary = parsed.args.join(" ");

    if (sub === "gas") {
      if (env === "vm") {
        const res = await vmCall({
          to: active.address,
          data: encoded.data,
          value
        });
        if (!res.ok) return warn(DIG_ERROR.vm_fail(res.reason));
        return text(formatGasEstimateLine(parsed.fn, res.gasUsed));
      }
      if (!ctx.isConnected || !ctx.address) return warn(DIG_ERROR.need_wallet);
      try {
        const gas = ctx.chainEstimateGas
          ? await ctx.chainEstimateGas({
              to: active.address,
              data: encoded.data,
              value,
              account: ctx.address
            })
          : 0n;
        return text(formatGasEstimateLine(parsed.fn, gas));
      } catch (e) {
        const reason = e instanceof Error ? e.message.split("\n")[0]! : "estimate failed";
        return warn(DIG_ERROR.reverted(reason.slice(0, 120)));
      }
    }

    if (env === "vm") {
      const captureTrace = sub === "send";
      const src = captureTrace ? await loadDigSource() : undefined;
      const res = await vmCall({
        to: active.address,
        data: encoded.data,
        value,
        captureTrace
      });
      if (captureTrace) {
        rememberVmTrace({
          kind: "send",
          steps: res.trace,
          truncated: res.truncated,
          ok: res.ok,
          artifact: active.artifact,
          source: src?.content
        });
      }
      if (!res.ok) {
        const r = res.reason.toLowerCase();
        const msg = r.includes("revert")
          ? DIG_ERROR.reverted(res.reason)
          : DIG_ERROR.vm_fail(res.reason);
        if (captureTrace && res.truncated) {
          return {
            kind: "multi-text",
            lines: [
              { text: msg, warn: true },
              { text: DIG_ERROR.debug_too_long, warn: true }
            ]
          };
        }
        return warn(msg);
      }
      const events = decodeDigLogs(active.abi, res.logs);
      let returnValues: string | undefined;
      let rawReturn: string | undefined;
      if (sub === "call" || isViewLike(encoded.fn)) {
        const dec = decodeDigReturn({
          abi: active.abi,
          functionName: parsed.fn,
          data: res.returnData
        });
        if (dec.ok) returnValues = formatReturnValues(dec.values);
        else rawReturn = truncateHex(dec.raw);
      }
      setLastDigReceipt({
        status: "success",
        gasUsed: res.gasUsed,
        logs: events,
        fn: parsed.fn,
        argsSummary,
        returnSummary: returnValues
      });
      const panel = panelFrom(active, {
        lastFn: parsed.fn,
        argsSummary: argsSummary || undefined,
        returnValues,
        rawReturn,
        events,
        gasLabel: "GAS USED",
        gas: formatGas(res.gasUsed)
      });
      if (sub === "send" && isViewLike(encoded.fn)) {
        // still OK to apply on VM
      }
      return { kind: "run", panel };
    }

    // Chain
    if (!ctx.isConnected || !ctx.address) return warn(DIG_ERROR.need_wallet);

    if (sub === "call") {
      try {
        if (!ctx.chainCall) return warn(DIG_ERROR.need_wallet);
        const res = await ctx.chainCall({
          to: active.address,
          data: encoded.data,
          value,
          account: ctx.address
        });
        const dec = decodeDigReturn({
          abi: active.abi,
          functionName: parsed.fn,
          data: res.returnData
        });
        const panel = panelFrom(active, {
          lastFn: parsed.fn,
          argsSummary: argsSummary || undefined,
          returnValues: dec.ok ? formatReturnValues(dec.values) : undefined,
          rawReturn: dec.ok ? undefined : truncateHex(dec.raw),
          events: [],
          gasLabel: "ESTIMATE",
          gas: res.gasUsed != null ? formatGas(res.gasUsed) : "—"
        });
        return { kind: "run", panel };
      } catch (e) {
        const reason = e instanceof Error ? e.message.split("\n")[0]! : "call failed";
        return warn(DIG_ERROR.reverted(reason.slice(0, 120)));
      }
    }

    // send — simulate then confirm
    if (ctx.chainSimulate) {
      const sim = await ctx.chainSimulate({
        to: active.address,
        data: encoded.data,
        value,
        account: ctx.address
      });
      if (!sim.ok) return warn(DIG_ERROR.reverted(sim.reason));
    }
    let gasEstimate = 100_000n;
    try {
      if (ctx.chainEstimateGas) {
        gasEstimate = await ctx.chainEstimateGas({
          to: active.address,
          data: encoded.data,
          value,
          account: ctx.address
        });
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message.split("\n")[0]! : "estimate failed";
      return warn(DIG_ERROR.reverted(reason.slice(0, 120)));
    }
    return {
      kind: "confirm",
      to: active.address,
      data: encoded.data,
      dataSummary: `${parsed.fn}${argsSummary ? `(${argsSummary})` : "()"}`,
      value,
      gasEstimate,
      intent: "send",
      contractName: active.name,
      fn: parsed.fn,
      abi: active.abi,
      artifact: active.artifact
    };
  }

  if (sub === "logs") {
    const receipt = getLastDigReceipt();
    if (!receipt || receipt.logs.length === 0) {
      return text("No events on last receipt.", { muted: true });
    }
    const lines = receipt.logs.map(
      (e) => `${e.eventName}  ${e.argsSummary}`
    );
    return {
      kind: "multi-text",
      lines: [
        { text: "EVENT | ARGS", muted: true },
        ...lines.map((t) => ({ text: t }))
      ]
    };
  }

  if (sub === "receipt") {
    const receipt = getLastDigReceipt();
    const active = getActiveDigDeployment();
    if (!receipt || !active) return warn(DIG_ERROR.no_address);
    const panel = panelFrom(active, {
      lastFn: receipt.fn,
      argsSummary: receipt.argsSummary,
      returnValues: receipt.returnSummary,
      events: receipt.logs,
      gasLabel: "GAS USED",
      gas: formatGas(receipt.gasUsed),
      warnLine:
        receipt.status === "reverted" ? DIG_ERROR.reverted("tx") : undefined
    });
    return { kind: "run", panel };
  }


  // —— #41 debug surface ——
  if (sub === "debug") {
    const stop = (argv[2] || "").toLowerCase() === "stop";
    if (stop) {
      setDigDebugSession(undefined);
      return { kind: "debug", panel: panelFromSession({
        steps: [],
        truncated: false,
        status: "OK",
        index: 0,
        breakpoints: [],
        hasSourceMap: false,
        lineByPc: {}
      }), stop: true };
    }

    const hashArg = argv[2];
    if (hashArg && /^0x[0-9a-fA-F]{64}$/.test(hashArg)) {
      if (!ctx.debugTraceTransaction) {
        return warn(DIG_ERROR.debug_no_trace);
      }
      try {
        const traced = await ctx.debugTraceTransaction(
          hashArg as `0x${string}`
        );
        if (!traced.ok) {
          if (traced.code === "map_mismatch") {
            return warn(DIG_ERROR.map_mismatch);
          }
          return warn(DIG_ERROR.debug_no_trace);
        }
        const rawSteps = stepsFromStructLogs(traced.structLogs);
        const built = buildTraceFromSteps(rawSteps);
        const active = getActiveDigDeployment();
        const src = await loadDigSource();
        const out: DigResult[] = [
          openDebugSession({
            steps: built.steps,
            truncated: built.truncated,
            status: built.status,
            artifact: active?.artifact,
            source: src?.content,
            mapMismatch: traced.mapMismatch
          })
        ];
        if (built.truncated) {
          out.unshift({ kind: "text", text: DIG_ERROR.debug_too_long, warn: true });
        }
        if (traced.mapMismatch) {
          out.unshift({
            kind: "text",
            text: DIG_ERROR.map_mismatch,
            warn: true
          });
        }
        return out.length === 1 ? out[0]! : out;
      } catch {
        return warn(DIG_ERROR.debug_no_trace);
      }
    }

    if (hashArg && hashArg.toLowerCase() !== "stop") {
      return warn("Usage: dig debug [txhash] | dig debug stop");
    }

    const target = getLastDigDebugTarget();
    if (!target || target.steps.length === 0) {
      return warn(DIG_ERROR.no_tx);
    }
    const out: DigResult[] = [
      openDebugSession({
        steps: target.steps,
        truncated: target.truncated,
        status: target.status,
        artifact: target.artifact,
        source: target.source
      })
    ];
    if (target.truncated) {
      out.unshift({ kind: "text", text: DIG_ERROR.debug_too_long, warn: true });
    }
    return out.length === 1 ? out[0]! : out;
  }

  if (
    sub === "step" ||
    sub === "over" ||
    sub === "out" ||
    sub === "back"
  ) {
    const s = requireDebug();
    if ("kind" in s) return s;
    let next = s;
    if (sub === "step") next = stepInto(s);
    else if (sub === "over") next = stepOver(s);
    else if (sub === "out") next = stepOut(s);
    else next = stepBack(s);
    return debugPanelResult(next);
  }

  if (sub === "br") {
    const s = requireDebug();
    if ("kind" in s) return s;
    const arg = (argv[2] || "").toLowerCase();
    if (!arg) {
      if (s.breakpoints.length === 0) {
        return text("No breakpoints.", { muted: true });
      }
      return text(
        s.breakpoints.map((pc) => `br pc=${pc}`).join("\n")
      );
    }
    if (arg === "clear") {
      return debugPanelResult(clearBreakpoints(s));
    }
    const pc = Number(arg);
    if (!Number.isFinite(pc) || pc < 0) {
      return warn("Usage: dig br <pc|line> | dig br clear");
    }
    return debugPanelResult(addBreakpoint(s, pc));
  }

  if (sub === "op") {
    const s = requireDebug();
    if ("kind" in s) return s;
    const st = currentStep(s);
    if (!st) return warn(DIG_ERROR.no_tx);
    return text(`PC ${st.pc}  ${st.op}  gas ${st.gas}`);
  }

  if (sub === "stack") {
    const s = requireDebug();
    if ("kind" in s) return s;
    const st = currentStep(s);
    if (!st) return warn(DIG_ERROR.no_tx);
    const top = stackTop8(st.stack);
    if (top.length === 0) return text("STACK —", { muted: true });
    return {
      kind: "multi-text",
      lines: [
        { text: "STACK", muted: true },
        ...top.map((w, i) => ({ text: `[${i}] ${w}` }))
      ]
    };
  }

  if (sub === "mem") {
    const s = requireDebug();
    if ("kind" in s) return s;
    const st = currentStep(s);
    if (!st) return warn(DIG_ERROR.no_tx);
    const offset = argv[2] ? parseInt(argv[2], 10) : 0;
    const len = argv[3] ? parseInt(argv[3], 10) : 64;
    if (!Number.isFinite(offset) || !Number.isFinite(len)) {
      return warn("Usage: dig mem [offset [len]]");
    }
    const hex = formatMemSlice(st.memory, offset, len);
    return text(
      `MEM @${offset} +${len}\n${hex}`
    );
  }

  if (sub === "stor") {
    const s = requireDebug();
    if ("kind" in s) return s;
    const map = storageUpTo(s.steps, s.index);
    const slotArg = argv[2];
    if (!slotArg) {
      const keys = Object.keys(map);
      if (keys.length === 0) {
        return text("STOR — no SSTORE yet.", { muted: true });
      }
      return {
        kind: "multi-text",
        lines: [
          { text: "STOR", muted: true },
          ...keys.slice(0, 16).map((k) => ({ text: `${k} → ${map[k]}` }))
        ]
      };
    }
    const key = slotArg.startsWith("0x") ? slotArg.toLowerCase() : `0x${slotArg}`.toLowerCase();
    const val = map[key];
    if (val == null) {
      return text(`STOR ${key} → —`, { muted: true });
    }
    return text(`STOR ${key} → ${val}`);
  }

  if (sub === "vars") {
    const s = requireDebug();
    if ("kind" in s) return s;
    if (!s.hasSourceMap) {
      return text("no source map", { muted: true });
    }
    const st = currentStep(s);
    const line = st ? s.lineByPc[st.pc] : undefined;
    if (line == null || !s.sourceLines) {
      return text("no source map", { muted: true });
    }
    const srcLine = s.sourceLines[line] || "";
    return text(`line ${line + 1}: ${srcLine.trim() || "—"}`);
  }


  if (!(DIG_SUBCOMMANDS as readonly string[]).includes(sub)) {
    return usage();
  }
  return usage();
}

export { defaultSolcVersion, truncateAddress, envLabel };
