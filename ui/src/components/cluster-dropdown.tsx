'use client'

import * as React from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { Button } from '@/components/ui/button'

export function ClusterDropdown() {
  const { connection } = useConnection()
  
  // Extract cluster name from endpoint
  const getClusterName = () => {
    const endpoint = connection.rpcEndpoint
    if (endpoint.includes('devnet')) return 'Devnet'
    if (endpoint.includes('testnet')) return 'Testnet'
    if (endpoint.includes('mainnet')) return 'Mainnet'
    return 'Localnet'
  }

  return (
    <Button variant="outline" disabled>
      {getClusterName()}
    </Button>
  )
}
