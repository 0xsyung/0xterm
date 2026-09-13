/**
 * Dig solc web worker — loads allowlisted soljson via importScripts, compiles
 * Standard JSON. Never eval user Solidity as JS.
 */
/* eslint-disable no-undef */
let compileFn = null;
let loadedVersion = null;

function post(msg) {
  self.postMessage(msg);
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  try {
    if (msg.type === "load") {
      const { version, urls } = msg;
      if (!Array.isArray(urls) || urls.length === 0) {
        post({ type: "load_fail", version, error: "no urls" });
        return;
      }
      let lastErr = null;
      for (const url of urls) {
        try {
          // Only blob: (from cached text) or https allowlisted by main thread.
          importScripts(url);
          const mod = self.Module || self.module;
          if (!mod || typeof mod.cwrap !== "function") {
            throw new Error("solc Module.cwrap missing");
          }
          compileFn = mod.cwrap("solidity_compile", "string", [
            "string",
            "number"
          ]);
          loadedVersion = version;
          post({ type: "loaded", version });
          return;
        } catch (e) {
          lastErr = e;
          compileFn = null;
          loadedVersion = null;
        }
      }
      post({
        type: "load_fail",
        version,
        error: String(lastErr && lastErr.message ? lastErr.message : lastErr)
      });
      return;
    }

    if (msg.type === "load_text") {
      const { version, jsText } = msg;
      const blob = new Blob([jsText], {
        type: "application/javascript"
      });
      const blobUrl = URL.createObjectURL(blob);
      try {
        importScripts(blobUrl);
        const mod = self.Module || self.module;
        if (!mod || typeof mod.cwrap !== "function") {
          throw new Error("solc Module.cwrap missing");
        }
        compileFn = mod.cwrap("solidity_compile", "string", [
          "string",
          "number"
        ]);
        loadedVersion = version;
        post({ type: "loaded", version });
      } catch (e) {
        compileFn = null;
        loadedVersion = null;
        post({
          type: "load_fail",
          version,
          error: String(e && e.message ? e.message : e)
        });
      } finally {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (_) {
          /* ignore */
        }
      }
      return;
    }

    if (msg.type === "compile") {
      if (!compileFn) {
        post({
          type: "compile_fail",
          id: msg.id,
          error: "compiler not loaded"
        });
        return;
      }
      const out = compileFn(msg.input, 0);
      post({ type: "compile_result", id: msg.id, output: out });
      return;
    }
  } catch (e) {
    post({
      type: "error",
      error: String(e && e.message ? e.message : e)
    });
  }
};
