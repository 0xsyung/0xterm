'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

type LogItem = {
  id: string
  type: 'input' | 'text' | 'component'
  content: React.ReactNode
}

export default function TerminalShell({ onToggleRain }: { onToggleRain: () => void }) {
  const [logs, setLogs] = useState([
    { id: '1', type: 'text', content: '0xTERM v1.0.0 [MATRIX CONSTRUCT LOADED]' },
    { id: '2', type: 'text', content: 'TYPE "help" TO SEE AVAILABLE COMMANDS.\n' }
  ])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [historyIdx, setHistoryIdx] = useState(-1)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const fetchPrice = async (symbol: string) => {
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${symbol}`)
      const data = await res.json()
      const pair = data.pairs?.[0]

      if (!pair) {
        return Error: Token "{symbol}" not found on DEX aggregators.
      }

      return (
        
          
            {pair.baseToken.name} ({pair.baseToken.symbol})
            {pair.dexId.toUpperCase()} • {pair.chainId.toUpperCase()}
          
          
            ${parseFloat(pair.priceUsd).toLocaleString()} 
            = 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ({pair.priceChange?.h24}% 24h)
            
          
          
            24h Vol: ${parseFloat(pair.volume?.h24 || 0).toLocaleString()}
            Liquidity: ${parseFloat(pair.liquidity?.usd || 0).toLocaleString()}
          
        
      )
    } catch {
      return Failed to fetch ticker data. Check network connection.
    }
  }

  const handleCommand = async (cmd: string) => {
    const trimmed = cmd.trim()
    if (!trimmed) return

    const userLog: LogItem = { id: Date.now().toString(), type: 'input', content: `$ ${trimmed}` }
    const args = trimmed.split(' ')
    const command = args[0].toLowerCase()

    let outputContent: React.ReactNode

    switch (command) {
      case 'clear':
        setLogs([])
        return

      case 'help':
        outputContent = (
          
            connect - Authenticate Web3 wallet
            disconnect - Disconnect current wallet session
            price <symbol> - Query DEX pair prices (e.g., price ETH, price PEPE)
            rain - Toggle background digital rain canvas
            clear - Flush terminal buffer
          
        )
        break

      case 'connect':
        if (isConnected) {
          outputContent = `WALLET CONNECTED: ${address}`
        } else {
          const injectedConn = connectors[0]
          if (injectedConn) {
            connect({ connector: injectedConn })
            outputContent = 'INITIATING WALLET HANDSHAKE...'
          } else {
            outputContent = 'NO INJECTED WALLET DETECTED (INSTALL METAMASK / RABBY).'
          }
        }
        break

      case 'disconnect':
        disconnect()
        outputContent = 'SESSION TERMINATED. WALLET DISCONNECTED.'
        break

      case 'price':
        if (!args[1]) {
          outputContent = 'Usage: price  (e.g. price ETH)'
        } else {
          setLogs((prev) => [...prev, userLog, { id: (Date.now() + 1).toString(), type: 'text', content: 'FETCHING ON-CHAIN METRICS...' }])
          const priceWidget = await fetchPrice(args[1])
          setLogs((prev) => [...prev.slice(0, -1), { id: Date.now().toString(), type: 'component', content: priceWidget }])
          setHistory((prev) => [...prev, trimmed])
          setHistoryIdx(-1)
          return
        }
        break

      case 'rain':
        onToggleRain()
        outputContent = 'BACKGROUND DIGITAL RAIN TOGGLED.'
        break

      default:
        outputContent = `Command not recognized: "${command}". Type "help" for instructions.`
    }

    setLogs((prev) => [...prev, userLog, { id: (Date.now() + 1).toString(), type: 'text', content: outputContent }])
    setHistory((prev) => [...prev, trimmed])
    setHistoryIdx(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand(input)
      setInput('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      const nextIdx = historyIdx + 1
      if (nextIdx < history.length) {
        setHistoryIdx(nextIdx)
        setInput(history[history.length - 1 - nextIdx])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx)
        setInput(history[history.length - 1 - nextIdx])
      } else if (historyIdx === 0) {
        setHistoryIdx(-1)
        setInput('')
      }
    }
  }

  return (
     inputRef.current?.focus()}
    >
      
        {logs.map((log) => (
          
            {log.content}
          
        ))}
        
      

      
        {isConnected ? `[${address?.slice(0,6)}...] >` : '>'}
         setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent outline-none text-[#00ff66] caret-[#00ff66] matrix-glow"
          autoFocus
          spellCheck={false}
        />
      
    
  )
}