'use client'

import { useState } from 'react'
import { useWriteContract } from 'wagmi'
import { uniV2FactoryAbi, uniV3FactoryAbi } from '../constants'

export default function CreatePoolWidget({ targetChain, activeDex, tokenA, tokenB, addrA, addrB, fee, theme }: any) {
  const { writeContractAsync } = useWriteContract()
  const [status, setStatus] = useState<'ready' | 'signing' | 'success' | 'error'>('ready')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleCreate = async () => {
    setStatus('signing')
    setErrorMsg(null)
    try {
      const hash = await writeContractAsync({
        address: activeDex.factory,
        abi: activeDex.type === 'V2' ? uniV2FactoryAbi : uniV3FactoryAbi,
        functionName: activeDex.type === 'V2' ? 'createPair' : 'createPool',
        args: activeDex.type === 'V2' ? [addrA, addrB] : [addrA, addrB, fee],
      })
      setTxHash(hash)
      setStatus('success')
    } catch (err: any) {
      setStatus('error')
      setErrorMsg(err.shortMessage || err.message || 'Transaction failed or rejected.')
    }
  }

  const blockExplorer = targetChain.blockExplorers?.default.url

  return (
    <div className={`my-3 p-4 border ${theme.border} ${theme.cardBg} ${theme.rounded} ${theme.glow} ${theme.font} text-xs space-y-3`}>
      <div className={`flex justify-between items-center border-b ${theme.border} pb-2`}>
        <span className={`font-bold ${theme.primary}`}>DEPLOY POOL CONTRACT [FACTORY]</span>
        <span className={`${theme.text}/70`}>{activeDex.name} ({activeDex.type})</span>
      </div>

      <div className={`grid grid-cols-2 gap-2 ${theme.text}`}>
        <div>
          <div className={`text-[10px] ${theme.text}/50`}>TOKEN A</div>
          <div className={`text-base font-bold ${theme.primary}`}>{tokenA.symbol}</div>
        </div>
        <div>
          <div className={`text-[10px] ${theme.text}/50`}>TOKEN B</div>
          <div className={`text-base font-bold ${theme.primary}`}>{tokenB.symbol}</div>
        </div>
      </div>
      
      {activeDex.type === 'V3' && (
        <div className={`text-[10px] ${theme.text}/70 pt-1`}>
          FEE TIER: <span className="font-bold">{fee / 10000}% ({fee})</span>
        </div>
      )}

      {status === 'error' && (
        <div className="p-2 border border-red-500/50 bg-red-950/40 text-red-400 rounded">
          ERROR: {errorMsg}
        </div>
      )}

      {status === 'success' && txHash && (
        <div className="p-2 border border-emerald-500/50 bg-emerald-950/40 text-emerald-400 rounded space-y-1">
          <div className="font-bold">[✓] FACTORY TRANSACTION SUBMITTED!</div>
          <div className="text-[10px] truncate">TX HASH: {txHash}</div>
          {blockExplorer && (
            <a href={`${blockExplorer}/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-[10px] underline hover:opacity-80 block pt-0.5">
              View on Explorer ↗
            </a>
          )}
        </div>
      )}

      <div className="pt-2 flex gap-2">
        {(status === 'ready' || status === 'error') && (
          <button onClick={handleCreate} className={`px-4 py-1.5 border ${theme.border} bg-current/10 hover:bg-current/20 ${theme.primary} font-bold ${theme.rounded} cursor-pointer transition-all`}>
            [ CALL CREATE POOL ]
          </button>
        )}
        {status === 'signing' && (
          <div className="text-yellow-400 font-bold animate-pulse">SIGN FACTORY DEPLOYMENT IN WALLET...</div>
        )}
      </div>
    </div>
  )
}
