//! LOCALNET-ONLY deposit/refund exercise.
//! No deployment to mainnet, no production-value assets, no issuance on Holochain.
//! Deposits are explicitly refundable: this is NOT a safe backing mechanism for minted claims.
//! The full program must be built, tested, reviewed, and independently audited before promotion.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

// Development placeholder only. Run `anchor keys sync` after creating a local keypair.
declare_id!("Fg6PaFpoGXkYsidMpWxTWqYhcuud1Qpw7wC6G7n5dFS");

#[program]
pub mod deposit_prototype {
    use super::*;

    /// One allowed classic SPL mint for this isolated localnet instance.
    pub fn initialize(ctx: Context<Initialize>, holochain_scope: [u8; 32]) -> Result<()> {
        require!(holochain_scope != [0u8; 32], BridgeError::InvalidScope);
        require!(ctx.accounts.mint.freeze_authority.is_none(), BridgeError::MintFreezable);
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.mint = ctx.accounts.mint.key();
        config.scope = holochain_scope;
        config.paused = false;
        config.total_active = 0;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Unique depositor+nonce receipt; same nonce cannot be deposited twice.
    /// A 32-byte recipient *core* plus 32-byte scope is recorded, not a base58 Solana key.
    pub fn deposit(
        ctx: Context<Deposit>,
        nonce: u64,
        recipient_core: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, BridgeError::Paused);
        require!(amount > 0, BridgeError::ZeroAmount);
        require!(recipient_core != [0u8; 32], BridgeError::InvalidRecipient);

        let before = ctx.accounts.vault.amount;
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.source.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts),
            amount,
            ctx.accounts.mint.decimals,
        )?;
        ctx.accounts.vault.reload()?;
        let delta = ctx.accounts.vault.amount.checked_sub(before)
            .ok_or(BridgeError::VaultBalanceMismatch)?;
        require_eq!(delta, amount, BridgeError::VaultBalanceMismatch);

        let config = &mut ctx.accounts.config;
        config.total_active = config.total_active.checked_add(amount)
            .ok_or(BridgeError::Overflow)?;
        require!(ctx.accounts.vault.amount >= config.total_active, BridgeError::VaultBalanceMismatch);

        let receipt = &mut ctx.accounts.receipt;
        receipt.depositor = ctx.accounts.depositor.key();
        receipt.mint = ctx.accounts.mint.key();
        receipt.vault = ctx.accounts.vault.key();
        receipt.config = config.key();
        receipt.recipient_core = recipient_core;
        receipt.scope = config.scope;
        receipt.nonce = nonce;
        receipt.amount = amount;
        receipt.refunded = false;
        receipt.bump = ctx.bumps.receipt;

        emit!(DepositRecorded {
            receipt: receipt.key(),
            depositor: receipt.depositor,
            nonce,
            amount,
            recipient_core,
            scope: config.scope,
        });
        Ok(())
    }

    /// Local prototype escape hatch. Because this exists, NO Holochain credits are safe.
    /// Only the original depositor can refund, and only once.
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        require!(!ctx.accounts.receipt.refunded, BridgeError::AlreadyRefunded);
        let amount = ctx.accounts.receipt.amount;
        let before = ctx.accounts.vault.amount;
        let bump = [ctx.accounts.config.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[b"config", &bump]];
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.vault.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts)
                .with_signer(signer_seeds),
            amount,
            ctx.accounts.mint.decimals,
        )?;
        ctx.accounts.vault.reload()?;
        require_eq!(before.checked_sub(ctx.accounts.vault.amount)
            .ok_or(BridgeError::VaultBalanceMismatch)?, amount, BridgeError::VaultBalanceMismatch);

        ctx.accounts.receipt.refunded = true;
        ctx.accounts.config.total_active = ctx.accounts.config.total_active
            .checked_sub(amount).ok_or(BridgeError::Overflow)?;
        require!(ctx.accounts.vault.amount >= ctx.accounts.config.total_active, BridgeError::VaultBalanceMismatch);
        emit!(RefundRecorded { receipt: ctx.accounts.receipt.key(), amount });
        Ok(())
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + BridgeConfig::SIZE, seeds = [b"config"], bump)]
    pub config: Account<'info, BridgeConfig>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = admin,
        token::mint = mint,
        token::authority = config,
        seeds = [b"vault", mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = mint)]
    pub config: Account<'info, BridgeConfig>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = depositor)]
    pub source: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"vault", mint.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = config
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = depositor,
        space = 8 + DepositReceipt::SIZE,
        seeds = [b"deposit", depositor.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub receipt: Account<'info, DepositReceipt>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = mint)]
    pub config: Account<'info, BridgeConfig>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"vault", mint.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = config
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"deposit", depositor.key().as_ref(), &receipt.nonce.to_le_bytes()],
        bump = receipt.bump,
        constraint = receipt.depositor == depositor.key() @ BridgeError::WrongDepositor,
        constraint = receipt.config == config.key() @ BridgeError::WrongConfig,
        constraint = receipt.mint == mint.key() @ BridgeError::WrongMint,
        constraint = receipt.vault == vault.key() @ BridgeError::WrongVault
    )]
    pub receipt: Account<'info, DepositReceipt>,
    #[account(mut, token::mint = mint, token::authority = depositor)]
    pub destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Account<'info, BridgeConfig>,
}

#[account]
pub struct BridgeConfig {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub scope: [u8; 32],
    pub paused: bool,
    pub total_active: u64,
    pub bump: u8,
}
impl BridgeConfig { pub const SIZE: usize = 32 + 32 + 32 + 1 + 8 + 1; }

#[account]
pub struct DepositReceipt {
    pub depositor: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub config: Pubkey,
    pub recipient_core: [u8; 32],
    pub scope: [u8; 32],
    pub nonce: u64,
    pub amount: u64,
    pub refunded: bool,
    pub bump: u8,
}
impl DepositReceipt { pub const SIZE: usize = (32 * 6) + 8 + 8 + 1 + 1; }

#[event]
pub struct DepositRecorded {
    pub receipt: Pubkey,
    pub depositor: Pubkey,
    pub nonce: u64,
    pub amount: u64,
    pub recipient_core: [u8; 32],
    pub scope: [u8; 32],
}

#[event]
pub struct RefundRecorded { pub receipt: Pubkey, pub amount: u64 }

#[error_code]
pub enum BridgeError {
    #[msg("Deposits are paused")]
    Paused,
    #[msg("Zero amount")]
    ZeroAmount,
    #[msg("Invalid Holochain recipient core")]
    InvalidRecipient,
    #[msg("Invalid Holochain network/application scope")]
    InvalidScope,
    #[msg("Test mint must have no freeze authority")]
    MintFreezable,
    #[msg("The vault balance moved by an unexpected amount")]
    VaultBalanceMismatch,
    #[msg("Arithmetic overflow/underflow")]
    Overflow,
    #[msg("The deposit receipt was already refunded")]
    AlreadyRefunded,
    #[msg("Only the original depositor can refund")]
    WrongDepositor,
    #[msg("The receipt is attached to a different config")]
    WrongConfig,
    #[msg("The receipt is attached to a different mint")]
    WrongMint,
    #[msg("The receipt is attached to a different vault")]
    WrongVault,
}
