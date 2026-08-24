/**
 * @file HelpManual.tsx
 * @description Help manual widget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
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
      <div className="grid grid-cols-1 gap-y-2 pt-1">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>networks</div>
          <div>List all available blockchain networks</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            network &lt;name|id&gt;
          </div>
          <div>Switch active network</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>dexes</div>
          <div>List available DEXes</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>dex &lt;id&gt;</div>
          <div>Set active DEX protocol</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            rpc [use|add|remove|alchemy|infura|quicknode]
          </div>
          <div>Manage &amp; switch RPC providers</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>theme &lt;name&gt;</div>
          <div>Switch terminal color theme / style</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            register &lt;address&gt; [symbol] [erc20|erc721]
          </div>
          <div>Verify and register a custom ERC20 or ERC721/NFT token</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            price &lt;tA&gt; [tB] [pool|api]
          </div>
          <div>Query token price from on-chain pool or API</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            tokens [erc20|erc721]
          </div>
          <div>List all registered tokens for the active network</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>export</div>
          <div>Export settings &amp; custom tokens to JSON</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>import &lt;json&gt;</div>
          <div>Import settings &amp; custom tokens from JSON</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            createpool &lt;tA&gt; &lt;tB&gt; [fee]
          </div>
          <div>Deploy pool contract</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            getpool &lt;tA&gt; &lt;tB&gt; [fee]
          </div>
          <div>Query pool address</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            initialize &lt;tA&gt; &lt;tB&gt; [fee]
          </div>
          <div>Initialize V3 pool price curve</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            addliq &lt;tA&gt; &lt;tB&gt; &lt;amtA&gt; &lt;amtB&gt; [fee]
          </div>
          <div>Add liquidity position</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            swap &lt;amt&gt; &lt;from&gt; &lt;to&gt;
          </div>
          <div>Execute token swap</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>pool &lt;address&gt;</div>
          <div>Check V2/V3 pool metrics</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            balance &lt;token&gt;
          </div>
          <div>Check token balance</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            portfolio [native|erc20]
          </div>
          <div>Wallet balances + USD value across all chains (P/L vs snapshot)</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>snapshot [label]</div>
          <div>Record current portfolio baseline for P/L tracking</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>pnl</div>
          <div>Show portfolio P/L vs last snapshot</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            is &lt;erc20|erc721&gt; &lt;address&gt;
          </div>
          <div>Check if address is a valid ERC20 or ERC721/NFT contract</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>info &lt;address&gt;</div>
          <div>Print metadata of an ERC20 or ERC721/NFT token contract</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>ens &lt;name.eth | address&gt;</div>
          <div>Resolve an ENS name to an address, or an address to its ENS name</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>
            chat &lt;address | ens.eth&gt; &lt;message&gt;
          </div>
          <div>Send an encrypted 1:1 message (testnets only, tiny fee; your key auto-registers on first send)</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>inbox [&lt;address&gt;]</div>
          <div>Read &amp; decrypt your chat threads (one per sender)</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-x-4">
          <div className={`font-bold ${theme.primary}`}>chatfee</div>
          <div>Show current message fee on the active network</div>
        </div>
      </div>
      <div
        className={`border-t ${theme.border} pt-2 mt-1 text-[10px] opacity-60`}
      >
        © 2026 0xTERM. All rights reserved. Proprietary and confidential.
        Unauthorized copying or distribution is strictly prohibited.
      </div>
    </div>
  );
}
