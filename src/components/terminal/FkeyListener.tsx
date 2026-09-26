/**
 * @file FkeyListener.tsx
 * @description Single global capture-phase F1–F12 listener. Reads the live
 * bindings map (via ref) and fires the bound command string, or routes
 * dangerous / not-yet-shipped bindings to pendingConfirm / a warn log (#28)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import { useEffect, useRef } from "react";
import type { BindingsState, FKey } from "./keybindings";
import {
  COMMAND_ISSUE,
  FUTURE_COMMANDS,
  isDangerousBinding,
  isEditableTarget,
  resolveBinding
} from "./keybindings";

type Props = {
  bindings: BindingsState;
  availableCommands: string[];
  onCommand: (cmd: string) => void;
  setPendingConfirm: (c: { onYes: () => void; onNo: () => void } | null) => void;
  onLogText: (text: string, warn?: boolean) => void;
  /** When false, F-keys are ignored (CONSOLE-only; match header F-row) (#117/#118). */
  enabled?: boolean;
};

export default function FkeyListener({
  bindings,
  availableCommands,
  onCommand,
  setPendingConfirm,
  onLogText,
  enabled = true
}: Props) {
  const bindingsRef = useRef(bindings);
  const commandsRef = useRef(availableCommands);
  const onCommandRef = useRef(onCommand);
  const setPendingConfirmRef = useRef(setPendingConfirm);
  const onLogTextRef = useRef(onLogText);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);
  useEffect(() => {
    commandsRef.current = availableCommands;
  }, [availableCommands]);
  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);
  useEffect(() => {
    setPendingConfirmRef.current = setPendingConfirm;
  }, [setPendingConfirm]);
  useEffect(() => {
    onLogTextRef.current = onLogText;
  }, [onLogText]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;
      const isFKey = (e.key as string).match(/^F([1-9]|1[0-2])$/);
      if (!isFKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isEditableTarget(e.target)) return;
      const key = e.key as FKey;
      const binding = resolveBinding(bindingsRef.current, key);
      if (!binding.cmd) return;
      if (isDangerousBinding(binding.cmd)) {
        onLogTextRef.current(
          `[!] ${key} is bound to "${binding.cmd}" (destructive). Type YES (or just press Enter) to fire it.`
        );
        setPendingConfirmRef.current({
          onYes: () => onCommandRef.current(binding.cmd),
          onNo: () => {}
        });
        return;
      }
      const first = binding.cmd.split(/\s+/)[0].toLowerCase();
      if (!commandsRef.current.includes(first) && FUTURE_COMMANDS.includes(first)) {
        const issue = COMMAND_ISSUE[first];
        onLogTextRef.current(
          `[!] ${key} is bound to "${binding.cmd}", which isn't shipped yet${issue ? ` (issue #${issue})` : ""}.`,
          true
        );
        return;
      }
      onCommandRef.current(binding.cmd);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return null;
}
