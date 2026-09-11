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
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,max-content)_1fr] gap-x-6 gap-y-2 pt-1">
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words tracking-wider`}>
            COMMAND
          </div>
          <div className={`font-bold ${theme.primary} tracking-wider`}>DESCRIPTION</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>networks</div>
          <div>List all available blockchain networks</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            network &lt;name|id&gt;
          </div>
          <div>Switch active network</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>dexes</div>
          <div>List available DEXes</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>dex &lt;id&gt;</div>
          <div>Set active DEX protocol</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            rpc [use|add|remove|alchemy|infura|quicknode]
          </div>
          <div>Manage &amp; switch RPC providers</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>theme &lt;name&gt;</div>
          <div>Switch terminal color theme / style</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            register &lt;address&gt; [symbol] [erc20|erc721]
          </div>
          <div>Verify and register a custom ERC20 or ERC721/NFT token</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            price &lt;tA&gt; [tB] [pool|api]
          </div>
          <div>Query token price from on-chain pool or API</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            tokens [erc20|erc721]
          </div>
          <div>List all registered tokens for the active network</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>export</div>
          <div>Export settings &amp; custom tokens to JSON</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>import &lt;json&gt;</div>
          <div>Import settings &amp; custom tokens from JSON</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            createpool &lt;tA&gt; &lt;tB&gt; [fee]
          </div>
          <div>Deploy pool contract</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            getpool &lt;tA&gt; &lt;tB&gt; [fee]
          </div>
          <div>Query pool address</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            initialize &lt;tA&gt; &lt;tB&gt; [fee]
          </div>
          <div>Initialize V3 pool price curve</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            addliq &lt;tA&gt; &lt;tB&gt; &lt;amtA&gt; &lt;amtB&gt; [fee]
          </div>
          <div>Add liquidity position</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            swap &lt;amt&gt; &lt;from&gt; &lt;to&gt;
          </div>
          <div>Execute token swap</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>pool &lt;address&gt;</div>
          <div>Check V2/V3 pool metrics</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            balance &lt;token&gt;
          </div>
          <div>Check token balance</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            portfolio [native|erc20]
          </div>
          <div>Wallet balances + USD value across all chains (P/L vs snapshot)</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>snapshot [label]</div>
          <div>Record current portfolio baseline for P/L tracking</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>pnl</div>
          <div>Show portfolio P/L vs last snapshot</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            is &lt;erc20|erc721&gt; &lt;address&gt;
          </div>
          <div>Check if address is a valid ERC20 or ERC721/NFT contract</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>info &lt;address&gt;</div>
          <div>Print metadata of an ERC20 or ERC721/NFT token contract</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            ens &lt;name.eth | address&gt; | set &lt;name.eth&gt; | clear
          </div>
          <div>Resolve a name/address, or register/clear your record (one name per address, on the active network)</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            channel | channel list | channels
          </div>
          <div>Show active chat channel, or list presets / saved / recent (active marked with ·)</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            channel use &lt;name|address&gt; | channel use &lt;chain&gt; &lt;address&gt;
          </div>
          <div>Switch the active channel (wrong-chain refuses send — type network first)</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            channel add &lt;chain&gt; &lt;address&gt; [name]
          </div>
          <div>Verify + save an existing Chat contract locally</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            channel remove &lt;name|address&gt;
          </div>
          <div>Drop a saved channel from the local list (presets stay)</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            channel deploy &lt;name&gt; [feeWei]
          </div>
          <div>EIP-1167 clone via ChatFactory on the active chain; sets active (default fee = Sepolia current)</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            chat &lt;address | ens.eth&gt; &lt;message&gt;
          </div>
          <div>Send an encrypted 1:1 message on the ACTIVE channel (testnets; key auto-registers on first send)</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>inbox [&lt;address&gt;]</div>
          <div>Read &amp; decrypt threads on the ACTIVE channel</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>chatfee</div>
          <div>Show message fee on the ACTIVE channel</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            board post &lt;content&gt;
          </div>
          <div>Post public content to the on-chain billboard (tiny fee)</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>
            board [list] [count]
          </div>
          <div>List the latest public posts (default 5, max 50)</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>boardfee</div>
          <div>Show current post fee on the active network</div>
          <div className={`font-bold ${theme.primary} md:whitespace-nowrap break-words`}>Social tab</div>
          <div>
            Header TERMINAL | SOCIAL switch — Inbox + Board live here (not pinnable).
            Unread badges poll ~60s. Commands <span className="font-bold">inbox</span> /{" "}
            <span className="font-bold">chat</span> / <span className="font-bold">board</span> /{" "}
            <span className="font-bold">channel*</span> still work from the prompt on either tab.
          </div>
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
