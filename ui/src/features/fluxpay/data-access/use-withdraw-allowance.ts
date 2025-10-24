import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { AnchorProvider } from '@coral-xyz/anchor'
import { BN } from 'bn.js'
import { getFluxpayProgram } from '@/lib/fluxpay-program'

export function useWithdrawAllowance() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['withdraw-allowance'],
    mutationFn: async ({ allowancePda, amountSol }: { allowancePda: PublicKey; amountSol: number }) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected')
      }

      const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
      const program = getFluxpayProgram(provider)

      const amount = new BN(Math.floor(amountSol * 1e9))

      const tx = await program.methods
        .withdraw(amount)
        .accounts({
          allowance: allowancePda,
          recipient: wallet.publicKey,
        })
        .rpc()

      return tx
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['get-allowance', { address: variables.allowancePda.toString() }] })
      queryClient.invalidateQueries({ queryKey: ['get-balance'] })
    },
  })
}

