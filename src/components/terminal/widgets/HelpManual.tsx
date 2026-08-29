/**
 * @file HelpManual.tsx
 * @description Help manual widget
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
import type { ThemeConfig } from "../types";

export default function HelpManual({
  theme
}: {
  theme: ThemeConfig;
}) {
  return (
    <div
      className={`relative group text-xs space-y-2 my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.text} w-full`}
    >
      <div
        className={`border-b ${theme.border} pb-1 font-bold ${theme.primary} tracking-wider`}
      >
        SYSTEM COMMAND MANUAL
      </div>
      <div className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 pt-1">
          <div className={`font-bold ${theme.primary} whitespace-nowrap tracking-wider`}>
            COMMAND
          </div>
          <div className={`font-bold ${theme.primary} tracking-wider`}>DESCRIPTION</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>networks</div>
          <div>List all available blockchain networks</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            network &lt;name|id&gt;
          </div>
          <div>Switch active network</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>dexes</div>
          <div>List available DEXes</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>dex &lt;id&gt;</div>
          <div>Set active DEX protocol</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            rpc [use|add|remove|alchemy|infura|quicknode]
          </div>
          <div>Manage &amp; switch RPC providers</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>theme &lt;name&gt;</div>
          <div>Switch terminal color theme / style</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            register &lt;address&gt; [symbol] [erc20|erc721]
          </div>
          <div>Verify and register a custom ERC20 or ERC721/NFT token</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            price &lt;tA&gt; [tB] [pool|api]
          </div>
          <div>Query token price from on-chain pool or API</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            tokens [erc20|erc721]
          </div>
          <div>List all registered tokens for the active network</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>export</div>
          <div>Export settings &amp; custom tokens to JSON</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>import &lt;json&gt;</div>
          <div>Import settings &amp; custom tokens from JSON</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            createpool &lt;tA&gt; &lt;tB&gt; [fee]
          </div>
          <div>Deploy pool contract</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            getpool &lt;tA&gt; &lt;tB&gt; [fee]
          </div>
          <div>Query pool address</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            initialize &lt;tA&gt; &lt;tB&gt; [fee]
          </div>
          <div>Initialize V3 pool price curve</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            addliq &lt;tA&gt; &lt;tB&gt; &lt;amtA&gt; &lt;amtB&gt; [fee]
          </div>
          <div>Add liquidity position</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            swap &lt;amt&gt; &lt;from&gt; &lt;to&gt;
          </div>
          <div>Execute token swap</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>pool &lt;address&gt;</div>
          <div>Check V2/V3 pool metrics</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            balance &lt;token&gt;
          </div>
          <div>Check token balance</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            portfolio [native|erc20]
          </div>
          <div>Wallet balances + USD value across all chains (P/L vs snapshot)</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>snapshot [label]</div>
          <div>Record current portfolio baseline for P/L tracking</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>pnl</div>
          <div>Show portfolio P/L vs last snapshot</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            is &lt;erc20|erc721&gt; &lt;address&gt;
          </div>
          <div>Check if address is a valid ERC20 or ERC721/NFT contract</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>info &lt;address&gt;</div>
          <div>Print metadata of an ERC20 or ERC721/NFT token contract</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            ens &lt;name.eth | address&gt; | set &lt;name.eth&gt; | clear
          </div>
          <div>Resolve a name/address, or register/clear your record (one name per address, on the active network)</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            chat &lt;address | ens.eth&gt; &lt;message&gt;
          </div>
          <div>Send an encrypted 1:1 message (testnets only, tiny fee; your key auto-registers on first send)</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>inbox [&lt;address&gt;]</div>
          <div>Read &amp; decrypt your chat threads (one per sender)</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>chatfee</div>
          <div>Show current message fee on the active network</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            board post &lt;content&gt;
          </div>
          <div>Post public content to the on-chain billboard (tiny fee)</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>
            board [list] [count]
          </div>
          <div>List the latest public posts (default 5, max 50)</div>
          <div className={`font-bold ${theme.primary} whitespace-nowrap`}>boardfee</div>
          <div>Show current post fee on the active network</div>
      </div>
      <div
        className={`border-t ${theme.border} pt-2 mt-1 text-[10px] opacity-60`}
      >
        © 2026 0xTERM. All rights reserved. Proprietary and confidential.
        Unauthorized copying or distribution is strictly prohibited.
        Contact: 0xsam@0xterm.xyz
      </div>
    </div>
  );
}
