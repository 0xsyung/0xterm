/**
 * @file idb.ts
 * @description IndexedDB wrappers for dig workspace (#39)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import { DIG_DEFAULT_SOLC_VERSION, DIG_IDB_NAME, DIG_IDB_STORE } from "./constants";
import type { DigContractArtifact } from "./artifact";

export type DigSourceRecord = {
  filename: string;
  content: string;
  updatedAt: number;
};

export type DigWorkspace = {
  source: DigSourceRecord | null;
  solcVersion: string;
  artifacts: DigContractArtifact[];
  lastSummary: string | null;
};

const KEYS = {
  source: "source",
  solcVersion: "solcVersion",
  artifacts: "artifacts",
  lastSummary: "lastSummary",
  wasmPrefix: "wasm:"
} as const;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DIG_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DIG_IDB_STORE)) {
        db.createObjectStore(DIG_IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb open failed"));
  });
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(DIG_IDB_STORE, "readonly");
        const store = tx.objectStore(DIG_IDB_STORE);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      })
  );
}

function idbSet(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(DIG_IDB_STORE, "readwrite");
        const store = tx.objectStore(DIG_IDB_STORE);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

export async function loadDigSource(): Promise<DigSourceRecord | null> {
  try {
    return (await idbGet<DigSourceRecord>(KEYS.source)) ?? null;
  } catch {
    return null;
  }
}

export async function saveDigSource(
  filename: string,
  content: string
): Promise<void> {
  const rec: DigSourceRecord = {
    filename,
    content,
    updatedAt: Date.now()
  };
  try {
    await idbSet(KEYS.source, rec);
  } catch {
    // privacy / quota — non-fatal
  }
}

export async function loadDigSolcVersion(): Promise<string> {
  try {
    const v = await idbGet<string>(KEYS.solcVersion);
    return v || DIG_DEFAULT_SOLC_VERSION;
  } catch {
    return DIG_DEFAULT_SOLC_VERSION;
  }
}

export async function saveDigSolcVersion(version: string): Promise<void> {
  try {
    await idbSet(KEYS.solcVersion, version);
  } catch {
    /* non-fatal */
  }
}

export async function loadDigArtifacts(): Promise<DigContractArtifact[]> {
  try {
    return (await idbGet<DigContractArtifact[]>(KEYS.artifacts)) ?? [];
  } catch {
    return [];
  }
}

export async function saveDigArtifacts(
  artifacts: DigContractArtifact[]
): Promise<void> {
  try {
    await idbSet(KEYS.artifacts, artifacts);
  } catch {
    /* non-fatal */
  }
}

export async function loadDigLastSummary(): Promise<string | null> {
  try {
    return (await idbGet<string>(KEYS.lastSummary)) ?? null;
  } catch {
    return null;
  }
}

export async function saveDigLastSummary(text: string): Promise<void> {
  try {
    await idbSet(KEYS.lastSummary, text);
  } catch {
    /* non-fatal */
  }
}

export async function loadCachedWasm(version: string): Promise<string | null> {
  try {
    return (await idbGet<string>(KEYS.wasmPrefix + version)) ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedWasm(
  version: string,
  jsText: string
): Promise<void> {
  try {
    await idbSet(KEYS.wasmPrefix + version, jsText);
  } catch {
    /* non-fatal — large blob may exceed quota */
  }
}
