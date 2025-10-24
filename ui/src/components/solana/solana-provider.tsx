'use client'

import { ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css'

export function SolanaProvider({ children }: { children: ReactNode }) {
  // Using localnet for testing
  //const endpoint = useMemo(() => 'http://localhost:8899', [])
  const endpoint = useMemo(() => {
    const envRpc = process.env.NEXT_PUBLIC_SOLANA_RPC
    return envRpc && envRpc.trim().length > 0 ? envRpc : clusterApiUrl('devnet')
  }, [])

  const wsEndpoint = useMemo(() => {
    try {
      if (!endpoint) return undefined
      if (endpoint.startsWith('https://')) return endpoint.replace('https://', 'wss://')
      if (endpoint.startsWith('http://')) return endpoint.replace('http://', 'ws://')
      return undefined
    } catch {
      return undefined
    }
  }, [endpoint])

  // Debug: confirm which endpoints are used at runtime
  if (typeof window !== 'undefined') {
    console.log('[SolanaProvider] RPC:', endpoint, 'WS:', wsEndpoint)
  }

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: 'processed', wsEndpoint }}>
      <WalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
