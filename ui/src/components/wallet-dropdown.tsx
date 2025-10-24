'use client'

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

function WalletDropdown() {
  return (
    <div className="wallet-adapter-button-trigger">
      <WalletMultiButton />
    </div>
  )
}

export { WalletDropdown }
