use anchor_lang::prelude::*;

declare_id!("12Gtmtu1JGNtnL1XSRi8qqXLdDWyD9d6oshGLANo6PAn"); 

#[program]
pub mod fluxpay {
    use super::*;

    // (1) Create the allowance PDA
    pub fn initialize(ctx: Context<Initialize>, total: u64, expires_at: i64) -> Result<()> {
        let allowance = &mut ctx.accounts.allowance;
        allowance.giver = ctx.accounts.giver.key();
        allowance.recipient = ctx.accounts.recipient.key();
        allowance.total = total;
        allowance.withdrawn = 0;
        allowance.expires_at = expires_at;
        allowance.bump = ctx.bumps.allowance;
        Ok(())
    }

    // (2) Recipient withdraws within rules
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let allowance = &mut ctx.accounts.allowance;
        let clock = Clock::get()?;

        require!(clock.unix_timestamp <= allowance.expires_at, ErrorCode::AllowanceExpired);
        require!(allowance.withdrawn + amount <= allowance.total, ErrorCode::InsufficientAllowance);

        allowance.withdrawn += amount;

        let allowance_info = ctx.accounts.allowance.to_account_info();
        let recipient_info = ctx.accounts.recipient.to_account_info();

        **allowance_info.try_borrow_mut_lamports()? -= amount;
        **recipient_info.try_borrow_mut_lamports()? += amount;

        Ok(())
    }

    // (3) Giver reclaims leftovers
    pub fn close(ctx: Context<Close>) -> Result<()> {
        let allowance = &ctx.accounts.allowance;
        let remaining = allowance.total.saturating_sub(allowance.withdrawn);

        let allowance_info = ctx.accounts.allowance.to_account_info();
        let giver_info = ctx.accounts.giver.to_account_info();

        **allowance_info.try_borrow_mut_lamports()? -= remaining;
        **giver_info.try_borrow_mut_lamports()? += remaining;

        Ok(())
    }
}

// ------------- Contexts -------------

#[derive(Accounts)]
#[instruction(total: u64, expires_at: i64)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub giver: Signer<'info>,

    /// CHECK: only key needed
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init,
        payer = giver,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1,
        seeds = [b"allowance", giver.key().as_ref(), recipient.key().as_ref()],
        bump
    )]
    pub allowance: Account<'info, Allowance>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, has_one = recipient)]
    pub allowance: Account<'info, Allowance>,
    #[account(mut)]
    pub recipient: Signer<'info>,
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(mut, has_one = giver)]
    pub allowance: Account<'info, Allowance>,
    #[account(mut)]
    pub giver: Signer<'info>,
}

// ------------- State -------------

#[account]
pub struct Allowance {
    pub giver: Pubkey,
    pub recipient: Pubkey,
    pub total: u64,
    pub withdrawn: u64,
    pub expires_at: i64,
    pub bump: u8,
}

// ------------- Errors -------------

#[error_code]
pub enum ErrorCode {
    #[msg("Allowance expired")]
    AllowanceExpired,
    #[msg("Withdrawal exceeds limit")]
    InsufficientAllowance,
}
