import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
// useConnection already imported above
import { PublicKey } from '@solana/web3.js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useWithdrawAllowance } from '../data-access/use-withdraw-allowance'
import { useGetAllowance } from '../data-access/use-get-allowance'
import { ExternalLink, Loader2, ArrowDownCircle } from 'lucide-react'
import { lamportsToSol, formatSol, formatDate, getTimeRemaining } from '@/lib/fluxpay-program'
import { useQuery } from '@tanstack/react-query'
import { useConnection } from '@solana/wallet-adapter-react'

export function FluxpayUiWithdraw({ variant = 'card' }: { variant?: 'card' | 'modal' }) {
  const wallet = useWallet()
  const { connection } = useConnection()
  const withdrawMutation = useWithdrawAllowance()

  const [allowanceAddress, setAllowanceAddress] = useState('')
  const [amount, setAmount] = useState('')
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

  // Fetch current PDA balance to cap withdraws to available funds
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

    try {
      const allowancePubkey = new PublicKey(allowanceAddress)
      const amountSol = parseFloat(amount)

      if (isNaN(amountSol) || amountSol <= 0) {
        setError('Amount must be positive')
        return
      }

      const tx = await withdrawMutation.mutateAsync({
        allowancePda: allowancePubkey,
        amountSol,
      })

      setTxSignature(tx)
      setAmount('')
    } catch (err: any) {
      if (err.message.includes('AllowanceExpired')) {
        setError('Allowance has expired')
      } else if (err.message.includes('InsufficientAllowance')) {
        setError('Amount exceeds remaining allowance')
      } else if (err.message.includes('ConstraintHasOne')) {
        setError('Only the recipient can withdraw from this allowance')
      } else {
        setError(err.message || 'Failed to withdraw')
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
  const maxWithdrawLamports = Math.min(remainingLamports, pdaBalanceLamports || 0)
  const maxWithdrawSol = lamportsToSol(maxWithdrawLamports)

  const isExpired = allowance
    ? Math.floor(Date.now() / 1000) > Number(allowance.expiresAt)
    : false

  const form = (
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
              disabled={withdrawMutation.isPending}
            />
          </div>

          {allowancePda && allowance && (
            <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Cap:</span>
                <span className="font-medium">{formatSol(Number(allowance.total))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Withdrawn:</span>
                <span className="font-medium">{formatSol(Number(allowance.withdrawn))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining:</span>
                <span className="font-medium text-green-600 dark:text-green-400">{formatSol(Number(allowance.total - allowance.withdrawn))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expires:</span>
                <span className={`font-medium ${isExpired ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {getTimeRemaining(Number(allowance.expiresAt))}
                </span>
              </div>
              <div className="pt-2 border-t text-xs text-muted-foreground">
                Full expiry: {formatDate(Number(allowance.expiresAt))}
              </div>
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

          <div>
            <Label htmlFor="amount">Amount to Withdraw (SOL)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder={`Max: ${maxWithdrawSol.toFixed(4)}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={withdrawMutation.isPending || !allowance}
            />
            {allowance && (
              <p className="text-xs text-muted-foreground mt-1">
                Remaining cap: {remaining.toFixed(4)} SOL · PDA balance: {pdaBalance.toFixed(4)} SOL · Max withdraw: {maxWithdrawSol.toFixed(4)} SOL
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {txSignature && (
            <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">✅ Withdrawal Successful!</p>
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

          <Button
            type="submit"
            disabled={withdrawMutation.isPending || !wallet.connected || !allowance || isExpired}
            className="w-full"
          >
            {withdrawMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Withdrawing...
              </>
            ) : (
              'Withdraw'
            )}
          </Button>
    </form>
  )

  if (variant === 'modal') {
    return form
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownCircle className="w-5 h-5" />
          Withdraw Funds
        </CardTitle>
        <CardDescription>Withdraw from an allowance (recipients only)</CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  )
}

