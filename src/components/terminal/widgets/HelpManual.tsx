import type { ThemeConfig } from "../types";

export default function HelpManual({ theme }: { theme: ThemeConfig }) {
  return (
    <div
      className={`text-xs space-y-2 my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.text} max-w-2xl`}
    >
      <div
        className={`border-b ${theme.border} pb-1 font-bold ${theme.primary} tracking-wider`}
      >
        SYSTEM COMMAND MANUAL
      </div>
      <div className="grid grid-cols-[200px_1fr] gap-x-4 gap-y-2 pt-1">
        <div className={`font-bold ${theme.primary}`}>networks</div>
        <div>List all available blockchain networks</div>
        <div className={`font-bold ${theme.primary}`}>
          network &lt;name|id&gt;
        </div>
        <div>Switch active network</div>
        <div className={`font-bold ${theme.primary}`}>dexes</div>
        <div>List available DEXes</div>
        <div className={`font-bold ${theme.primary}`}>dex &lt;id&gt;</div>
        <div>Set active DEX protocol</div>
        <div className={`font-bold ${theme.primary}`}>
          rpc [use|add|remove|alchemy|infura|quicknode]
        </div>
        <div>Manage & switch between multiple RPC providers</div>
        <div className={`font-bold ${theme.primary}`}>theme &lt;name&gt;</div>
        <div>Switch terminal color theme / style</div>
        <div className={`font-bold ${theme.primary}`}>
          register &lt;address&gt; [symbol]
        </div>
        <div>Verify and register a custom ERC20 token</div>
        <div className={`font-bold ${theme.primary}`}>
          price &lt;tA&gt; [tB] [pool|api]
        </div>
        <div>Query token price from on-chain pool or API</div>
        <div className={`font-bold ${theme.primary}`}>export</div>
        <div>Export settings & custom tokens to JSON</div>
        <div className={`font-bold ${theme.primary}`}>import &lt;json&gt;</div>
        <div>Import settings & custom tokens from JSON</div>
        <div className={`font-bold ${theme.primary}`}>
          createpool &lt;tA&gt; &lt;tB&gt; [fee]
        </div>
        <div>Deploy pool contract</div>
        <div className={`font-bold ${theme.primary}`}>
          getpool &lt;tA&gt; &lt;tB&gt; [fee]
        </div>
        <div>Query pool address</div>
        <div className={`font-bold ${theme.primary}`}>
          initialize &lt;tA&gt; &lt;tB&gt; [fee]
        </div>
        <div>Initialize V3 pool price curve</div>
        <div className={`font-bold ${theme.primary}`}>
          addliq &lt;tA&gt; &lt;tB&gt; &lt;amtA&gt; &lt;amtB&gt; [fee]
        </div>
        <div>Add liquidity position</div>
        <div className={`font-bold ${theme.primary}`}>
          swap &lt;amt&gt; &lt;from&gt; &lt;to&gt;
        </div>
        <div>Execute token swap</div>
        <div className={`font-bold ${theme.primary}`}>pool &lt;address&gt;</div>
        <div>Check V2/V3 pool metrics</div>
        <div className={`font-bold ${theme.primary}`}>
          balance &lt;token&gt;
        </div>
        <div>Check token balance</div>
      </div>
    </div>
  );
}
