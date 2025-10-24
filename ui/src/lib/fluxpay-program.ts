import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Connection, PublicKey } from '@solana/web3.js'
import idl from './idl/fluxpay.json'

export type FluxpayProgram = Program<typeof idl>

export const FLUXPAY_PROGRAM_ID = new PublicKey('12Gtmtu1JGNtnL1XSRi8qqXLdDWyD9d6oshGLANo6PAn')

export function getFluxpayProgram(provider: AnchorProvider): FluxpayProgram {
  return new Program(idl as any, provider)
}

export function getAllowancePda(giver: PublicKey, recipient: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('allowance'), giver.toBuffer(), recipient.toBuffer()],
    FLUXPAY_PROGRAM_ID
  )
}

export function lamportsToSol(lamports: number): number {
  return lamports / 1e9
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * 1e9)
}

export function formatSol(lamports: number): string {
  return `${lamportsToSol(lamports).toFixed(4)} SOL`
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString()
}

export function getTimeRemaining(expiresAt: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = expiresAt - now

  if (diff <= 0) return 'Expired'

  const hours = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days} day${days > 1 ? 's' : ''}`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m`
}

