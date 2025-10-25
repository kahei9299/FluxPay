import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { useConnection } from '@solana/wallet-adapter-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useInitializeAllowance } from '../data-access/use-initialize-allowance'
import { ExternalLink, Loader2, PlusCircle } from 'lucide-react'
import { getAllowancePda, solToLamports } from '@/lib/fluxpay-program'
import { useQueryClient } from '@tanstack/react-query'

export function FluxpayUiInitialize({ variant = 'card' }: { variant?: 'card' | 'modal' }) {
  const wallet = useWallet()
  const { connection } = useConnection()
  const queryClient = useQueryClient()
  const initializeMutation = useInitializeAllowance()

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [hours, setHours] = useState('')
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [fundTxSignature, setFundTxSignature] = useState<string | null>(null)
  const [allowancePda, setAllowancePda] = useState<PublicKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFunding, setIsFunding] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setTxSignature(null)
    setFundTxSignature(null)
    setAllowancePda(null)

    if (!wallet.publicKey) {
      setError('Please connect your wallet')
      return
    }

    try {
      const recipientPubkey = new PublicKey(recipient)
      const totalSol = parseFloat(amount)
      const hoursUntilExpiry = parseFloat(hours)

      if (isNaN(totalSol) || totalSol <= 0) {
        setError('Amount must be positive')
        return
      }

      if (isNaN(hoursUntilExpiry) || hoursUntilExpiry <= 0) {
        setError('Hours must be positive')
        return
      }

      const result = await initializeMutation.mutateAsync({
        recipient: recipientPubkey,
        totalSol,
        hoursUntilExpiry,
      })

      setTxSignature(result.tx)
      setAllowancePda(result.allowancePda)
    } catch (err: any) {
      setError(err.message || 'Failed to initialize allowance')
    }
  }

  const handleFund = async () => {
    if (!wallet.publicKey || !wallet.sendTransaction || !allowancePda) {
      setError('Missing wallet or allowance PDA')
      return
    }

    setIsFunding(true)
    setError(null)

    try {
      const totalSol = parseFloat(amount)
      const lamports = solToLamports(totalSol)

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: allowancePda,
          lamports,
        })
      )

      const signature = await wallet.sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, 'confirmed')

      setFundTxSignature(signature)
      queryClient.invalidateQueries({ queryKey: ['get-balance'] })
      queryClient.invalidateQueries({ queryKey: ['get-allowance'] })
    } catch (err: any) {
      setError(`Failed to fund PDA: ${err.message}`)
    } finally {
      setIsFunding(false)
    }
  }

  const explorerUrl = (sig: string) => {
    const cluster = connection.rpcEndpoint.includes('devnet') ? 'devnet' : 'localnet'
    return cluster === 'localnet'
      ? `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=http://localhost:8899`
      : `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Giver (Connected Wallet)</Label>
            <Input
              value={wallet.publicKey ? wallet.publicKey.toBase58() : ''}
              placeholder="Connect wallet to continue"
              readOnly
              disabled
            />
          </div>
          <div>
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              type="text"
              placeholder="Enter recipient's public key"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={initializeMutation.isPending || !!txSignature}
            />
          </div>

          <div>
            <Label htmlFor="amount">Total Amount (SOL)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="e.g., 1.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={initializeMutation.isPending || !!txSignature}
            />
          </div>

          <div>
            <Label htmlFor="hours">Expires In (hours)</Label>
            <Input
              id="hours"
              type="number"
              step="0.1"
              placeholder="e.g., 24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              disabled={initializeMutation.isPending || !!txSignature}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {!txSignature ? (
            <Button type="submit" disabled={initializeMutation.isPending || !wallet.connected} className="w-full">
              {initializeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Allowance'
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">✅ Allowance Created!</p>
                <a
                  href={explorerUrl(txSignature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-700 dark:text-green-300 hover:underline flex items-center gap-1"
                >
                  View Transaction <ExternalLink className="w-3 h-3" />
                </a>
                {allowancePda && (
                  <p className="text-xs text-green-700 dark:text-green-300 mt-2 break-all">
                    PDA: {allowancePda.toBase58()}
                  </p>
                )}
              </div>

              {!fundTxSignature ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">⚠️ Don't forget to fund the allowance:</p>
                  <Button onClick={handleFund} disabled={isFunding} className="w-full" variant="secondary">
                    {isFunding ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Funding...
                      </>
                    ) : (
                      `Fund ${amount} SOL`
                    )}
                  </Button>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">💰 Funded!</p>
                  <a
                    href={explorerUrl(fundTxSignature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-700 dark:text-blue-300 hover:underline flex items-center gap-1"
                  >
                    View Transaction <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <Button
                type="button"
                onClick={() => {
                  setRecipient('')
                  setAmount('')
                  setHours('')
                  setTxSignature(null)
                  setFundTxSignature(null)
                  setAllowancePda(null)
                  setError(null)
                }}
                variant="outline"
                className="w-full"
              >
                Create Another
              </Button>
            </div>
          )}
    </form>
  )

  if (variant === 'modal') {
    return form
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlusCircle className="w-5 h-5" />
          Create Allowance
        </CardTitle>
        <CardDescription>Set up a new programmable allowance for a recipient</CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  )
}

