<p align="center">
  <img src="ui/public/fluxpay-logo-wordmark.svg" alt="FluxPay" height="72" />
</p>

<p align="center"><strong>Programmable allowances on Solana</strong></p>

---

## What is FluxPay?
FluxPay lets a giver set a time-bound SOL allowance for a recipient with an on-chain cap and expiry. It’s a simple way to move funds with constraints that are enforced by a Solana program.

### Core features
- Create an allowance with total cap and expiration (hours)
- Fund the allowance PDA (vault) from the UI
- Recipient can withdraw within limits before expiry
- Giver can close and reclaim remaining funds at any time

## Problems it solves
- **Trust boundaries**: Funds sit in a program-owned account (PDA), not a recipient wallet, until withdrawn.
- **Spending control**: Enforce a total cap and expiry on-chain—no off-chain agreements.
- **Simplicity**: One-click flows in the UI for create, withdraw, and close.

## How it works (at a glance)
- A PDA (Program Derived Address) acts as the vault for the allowance.
- The program stores `giver`, `recipient`, `total`, `withdrawn`, and `expiresAt`.
- Withdraws are limited to remaining `total - withdrawn` and only allowed for the `recipient` prior to `expiresAt`.
- The `giver` can close the account and reclaim remaining funds.

## Technology
- **Smart contract**: Rust + Anchor (`programs/fluxpay`)
- **Client/UI**: Next.js 14, React, Tailwind, shadcn/ui
- **Solana tooling**: `@solana/web3.js`, Wallet Adapter, Anchor client
- **Data**: React Query for mutations/queries

## Preview
<p align="center">
  <img src="ui/public/og-fluxpay.png" alt="FluxPay UI" width="720" />
</p>

## Development
```bash
# in one terminal (Anchor/Solana as needed)
anchor build # or your existing build flow

# in another terminal
cd ui && npm install && npm run dev
```

## License

MIT