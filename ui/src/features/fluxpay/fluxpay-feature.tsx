'use client'

import { AppHero } from '@/components/app-hero'
import { FluxpayUiInitialize } from './ui/fluxpay-ui-initialize'
import { FluxpayUiWithdraw } from './ui/fluxpay-ui-withdraw'
import { FluxpayUiClose } from './ui/fluxpay-ui-close'

export default function FluxpayFeature() {
  return (
    <div>
      <AppHero
        title="FluxPay"
        subtitle="Programmable allowances on Solana - Set time limits and spending caps for secure fund transfers"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <FluxpayUiInitialize />
          <FluxpayUiWithdraw />
          <FluxpayUiClose />
        </div>

        <div className="mt-8 p-6 bg-muted/50 rounded-lg border">
          <h3 className="text-lg font-semibold mb-3">How FluxPay Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="font-medium text-primary mb-2">1. Create Allowance</div>
              <p className="text-muted-foreground">
                The giver sets up an allowance with a spending cap and expiration time, then funds the PDA vault.
              </p>
            </div>
            <div>
              <div className="font-medium text-primary mb-2">2. Recipient Withdraws</div>
              <p className="text-muted-foreground">
                The recipient can withdraw funds up to the cap before expiration. All rules enforced on-chain.
              </p>
            </div>
            <div>
              <div className="font-medium text-primary mb-2">3. Giver Reclaims</div>
              <p className="text-muted-foreground">
                At any time, the giver can close the allowance and reclaim any remaining funds.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> After creating an allowance, you must fund it manually by transferring SOL to the
              PDA address. The "Fund" button will appear after initialization.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

