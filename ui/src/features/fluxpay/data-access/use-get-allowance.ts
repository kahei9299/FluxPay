import { useQuery } from '@tanstack/react-query'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { AnchorProvider } from '@coral-xyz/anchor'
import { getFluxpayProgram } from '@/lib/fluxpay-program'

export interface AllowanceData {
  giver: PublicKey
  recipient: PublicKey
  total: bigint
  withdrawn: bigint
  expiresAt: bigint
  bump: number
}

export function useGetAllowance({ address }: { address?: PublicKey }) {
  const { connection } = useConnection()

  return useQuery({
    queryKey: ['get-allowance', { endpoint: connection.rpcEndpoint, address: address?.toString() }],
    queryFn: async () => {
      if (!address) return null

      // Create a dummy wallet for read-only operations
      const provider = new AnchorProvider(connection, {} as any, { commitment: 'confirmed' })
      const program = getFluxpayProgram(provider)

      try {
        const allowance = await program.account.allowance.fetch(address)
        return {
          giver: allowance.giver as PublicKey,
          recipient: allowance.recipient as PublicKey,
          total: BigInt(allowance.total.toString()),
          withdrawn: BigInt(allowance.withdrawn.toString()),
          expiresAt: BigInt(allowance.expiresAt.toString()),
          bump: allowance.bump as number,
        } as AllowanceData
      } catch (error) {
        // Account doesn't exist
        return null
      }
    },
    enabled: !!address, // Only run query if address exists
  })
}

