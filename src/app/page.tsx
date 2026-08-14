'use client'

import { useState } from 'react'
import { Providers } from './providers'
import MatrixRain from '@/components/terminal/MatrixRain'
import TerminalShell from '@/components/terminal/TerminalShell'

export default function Home() {
  const [rainActive, setRainActive] = useState(true)

  return (
    
      
        
         setRainActive((prev) => !prev)} />
      
    
  )
}