import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useCloseAllowance } from '../data-access/use-close-allowance'
import { useGetAllowance } from '../data-access/use-get-allowance'
import { ExternalLink, Loader2, XCircle } from 'lucide-react'
import { lamportsToSol, formatSol, formatDate } from '@/lib/fluxpay-program'
// useConnection already imported above
import { useQuery } from '@tanstack/react-query'

export function FluxpayUiClose() {
  const wallet = useWallet()
  const { connection } = useConnection()
  const closeMutation = useCloseAllowance()

  const [allowanceAddress, setAllowanceAddress] = useState('')
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  let allowancePda: PublicKey | undefined
  try {
    allowancePda = allowanceAddress ? new PublicKey(allowanceAddress) : undefined
  } catch {
    // Invalid address
  }

  const { data: allowance, isLoading: isLoadingAllowance } = useGetAllowance({
    address: allowancePda!,
  })

  // Fetch PDA balance
  const { data: pdaBalanceLamports } = useQuery({
    queryKey: ['pda-balance', allowancePda?.toBase58(), connection.rpcEndpoint],
    queryFn: async () => {
      if (!allowancePda) return 0
      return await connection.getBalance(allowancePda)
    },
    enabled: !!allowancePda,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setTxSignature(null)

    if (!wallet.publicKey) {
      setError('Please connect your wallet')
      return
    }

    if (!allowance) {
      setError('Allowance not found')
      return
    }

    if (allowance.giver.toBase58() !== wallet.publicKey.toBase58()) {
      setError('Only the giver can close this allowance')
      return
    }

    try {
      const allowancePubkey = new PublicKey(allowanceAddress)

      const tx = await closeMutation.mutateAsync({
        allowancePda: allowancePubkey,
      })

      setTxSignature(tx)
    } catch (err: any) {
      if (err.message.includes('ConstraintHasOne')) {
        setError('Only the giver can close this allowance')
      } else {
        setError(err.message || 'Failed to close allowance')
      }
    }
  }

  const explorerUrl = (sig: string) => {
    const cluster = connection.rpcEndpoint.includes('devnet') ? 'devnet' : 'localnet'
    return cluster === 'localnet'
      ? `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=http://localhost:8899`
      : `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`
  }

  const remainingLamports = allowance ? Number(allowance.total - allowance.withdrawn) : 0
  const remaining = lamportsToSol(remainingLamports)
  const pdaBalance = lamportsToSol(pdaBalanceLamports || 0)
  const reclaimableLamports = Math.min(remainingLamports, pdaBalanceLamports || 0)
  const reclaimable = lamportsToSol(reclaimableLamports)

  const isGiver = wallet.publicKey && allowance && allowance.giver.toBase58() === wallet.publicKey.toBase58()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <XCircle className="w-5 h-5" />
          Close Allowance
        </CardTitle>
        <CardDescription>Reclaim remaining funds and close the allowance (givers only)</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="allowanceAddress">Allowance Address (PDA)</Label>
            <Input
              id="allowanceAddress"
              type="text"
              placeholder="Enter allowance PDA address"
              value={allowanceAddress}
              onChange={(e) => {
                setAllowanceAddress(e.target.value)
                setTxSignature(null)
                setError(null)
              }}
              disabled={closeMutation.isPending || !!txSignature}
            />
          </div>

          {allowancePda && allowance && (
            <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Giver:</span>
                <span className="font-mono text-xs">{allowance.giver.toBase58().slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipient:</span>
                <span className="font-mono text-xs">{allowance.recipient.toBase58().slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Cap:</span>
                <span className="font-medium">{formatSol(Number(allowance.total))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Withdrawn:</span>
                <span className="font-medium">{formatSol(Number(allowance.withdrawn))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To Reclaim:</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{reclaimable.toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PDA Balance:</span>
                <span className="font-medium">{pdaBalance.toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expired:</span>
                <span className="font-medium">{formatDate(Number(allowance.expiresAt))}</span>
              </div>

              {!isGiver && wallet.connected && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    ⚠️ You are not the giver of this allowance
                  </p>
                </div>
              )}
            </div>
          )}

          {allowancePda && isLoadingAllowance && (
            <div className="p-3 bg-muted rounded-md text-center">
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Loading allowance...</p>
            </div>
          )}

          {allowancePda && !isLoadingAllowance && !allowance && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-sm text-yellow-900 dark:text-yellow-100">Allowance not found at this address</p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {txSignature && (
            <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                ✅ Allowance Closed! Reclaimed {remaining.toFixed(4)} SOL
              </p>
              <a
                href={explorerUrl(txSignature)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-700 dark:text-green-300 hover:underline flex items-center gap-1"
              >
                View Transaction <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {!txSignature ? (
            <Button type="submit" disabled={closeMutation.isPending || !wallet.connected || !allowance || !isGiver} className="w-full" variant="destructive">
              {closeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Closing...
                </>
              ) : (
                `Close & Reclaim ${remaining > 0 ? remaining.toFixed(4) + ' SOL' : ''}`
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                setAllowanceAddress('')
                setTxSignature(null)
                setError(null)
              }}
              variant="outline"
              className="w-full"
            >
              Close Another
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

