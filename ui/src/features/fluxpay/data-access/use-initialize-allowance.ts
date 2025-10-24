import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider } from '@coral-xyz/anchor'
import { BN } from 'bn.js'
import { getFluxpayProgram, getAllowancePda } from '@/lib/fluxpay-program'

export function useInitializeAllowance() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['initialize-allowance'],
    mutationFn: async ({
      recipient,
      totalSol,
      hoursUntilExpiry,
    }: {
      recipient: PublicKey
      totalSol: number
      hoursUntilExpiry: number
    }) => {
      if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Connect Phantom on Localhost first')
      }

      const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
      const program = getFluxpayProgram(provider)

      const total = new BN(Math.floor(totalSol * 1e9))
      const expiresAt = new BN(Math.floor(Date.now() / 1000 + hoursUntilExpiry * 3600))

      const [allowancePda] = getAllowancePda(wallet.publicKey, recipient)

      const tx = await program.methods
        .initialize(total, expiresAt)
        .accounts({
          giver: wallet.publicKey,
          recipient,
          allowance: allowancePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      return { tx, allowancePda }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['get-allowance', { address: data.allowancePda.toString() }] })
      queryClient.invalidateQueries({ queryKey: ['get-balance'] })
    },
  })
}

