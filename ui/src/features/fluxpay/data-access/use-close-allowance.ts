import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { AnchorProvider } from '@coral-xyz/anchor'
import { getFluxpayProgram } from '@/lib/fluxpay-program'

export function useCloseAllowance() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['close-allowance'],
    mutationFn: async ({ allowancePda }: { allowancePda: PublicKey }) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected')
      }

      const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
      const program = getFluxpayProgram(provider)

      const tx = await program.methods
        .close()
        .accounts({
          allowance: allowancePda,
          giver: wallet.publicKey,
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

