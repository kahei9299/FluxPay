use anchor_lang::prelude::*;

declare_id!("Cd6PpaBVFbKsBbrGKBXAXWV7YtES2j6GtcMHCoqKtRgr");

#[program]
pub mod fluxpay {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
