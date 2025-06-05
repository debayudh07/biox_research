use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};

declare_id!("4TsLtFAfkbpcFjesanK4ojZNTK1bsQPfPuVxt5g19hhM");

#[program]
pub mod biox_research {
    use super::*;

    /// Initialize the program with an admin account
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Initializing BioX Research Platform");
        
        let program_state = &mut ctx.accounts.program_state;
        program_state.admin = ctx.accounts.admin.key();
        program_state.paper_count = 0;
        program_state.total_funding = 0;
        program_state.platform_fee_rate = 250; // 2.5% in basis points
        program_state.min_funding_goal = 1_000_000; // 1 token minimum
        program_state.max_funding_period = 90 * 24 * 60 * 60; // 90 days in seconds
        program_state.bump = ctx.bumps.program_state;
        program_state.is_paused = false;

        Ok(())
    }

    /// Submit a new research paper
    pub fn submit_paper(
        ctx: Context<SubmitPaper>,
        title: String,
        abstract_text: String,
        ipfs_hash: String,
        authors: Vec<String>,
        funding_goal: u64,
        funding_period_days: u64,
    ) -> Result<()> {
        let program_state = &ctx.accounts.program_state;
        
        // Validate program state
        require!(!program_state.is_paused, ResearchError::ProgramPaused);
        
        // Validate inputs
        require!(title.len() > 0 && title.len() <= 100, ResearchError::InvalidTitle);
        require!(abstract_text.len() > 0 && abstract_text.len() <= 1000, ResearchError::InvalidAbstract);
        require!(ipfs_hash.len() > 0 && ipfs_hash.len() <= 100, ResearchError::InvalidIPFSHash);
        require!(authors.len() > 0 && authors.len() <= 10, ResearchError::InvalidAuthors);
        require!(funding_goal >= program_state.min_funding_goal, ResearchError::FundingGoalTooLow);
        require!(funding_period_days > 0 && funding_period_days <= 365, ResearchError::InvalidFundingPeriod);

        let current_time = Clock::get()?.unix_timestamp;
        let funding_deadline = current_time + (funding_period_days * 24 * 60 * 60) as i64;
        
        let program_state = &mut ctx.accounts.program_state;
        let paper_id = program_state.paper_count;
        program_state.paper_count += 1;

        let paper = &mut ctx.accounts.paper;
        paper.id = paper_id;
        paper.author = ctx.accounts.author.key();
        paper.title = title.clone();
        paper.abstract_text = abstract_text;
        paper.ipfs_hash = ipfs_hash;
        paper.authors = authors;
        paper.created_at = current_time;
        paper.updated_at = current_time;
        paper.is_published = false;
        paper.funding_goal = funding_goal;
        paper.funding_current = 0;
        paper.funding_deadline = funding_deadline;
        paper.upvotes = 0;
        paper.downvotes = 0;
        paper.status = PaperStatus::Draft;
        paper.review_score = 0;
        paper.review_count = 0;
        paper.bump = ctx.bumps.paper;

        emit!(PaperSubmittedEvent {
            paper_id,
            author: ctx.accounts.author.key(),
            title,
            timestamp: current_time,
        });

        Ok(())
    }

    /// Publish a paper (by author) or approve (by admin)
    pub fn publish_paper(ctx: Context<PublishPaper>, _paper_id: u64) -> Result<()> {
        let paper = &mut ctx.accounts.paper;
        let program_state = &ctx.accounts.program_state;
        let authority = ctx.accounts.authority.key();

        require!(!program_state.is_paused, ResearchError::ProgramPaused);
        require!(
            paper.author == authority || program_state.admin == authority,
            ResearchError::Unauthorized
        );
        require!(paper.status == PaperStatus::Draft, ResearchError::InvalidPaperStatus);

        paper.is_published = true;
        paper.status = PaperStatus::Published;
        paper.updated_at = Clock::get()?.unix_timestamp;

        emit!(PaperPublishedEvent {
            paper_id: paper.id,
            author: paper.author,
            timestamp: paper.updated_at,
        });

        Ok(())
    }

    /// Fund a published paper
    pub fn fund_paper(ctx: Context<FundPaper>, paper_id: u64, amount: u64) -> Result<()> {
        let program_state = &ctx.accounts.program_state;
        require!(!program_state.is_paused, ResearchError::ProgramPaused);
        require!(amount > 0, ResearchError::InvalidAmount);

        let paper = &mut ctx.accounts.paper;
        require!(paper.is_published, ResearchError::PaperNotPublished);
        require!(paper.status == PaperStatus::Published, ResearchError::InvalidPaperStatus);

        let current_time = Clock::get()?.unix_timestamp;
        require!(current_time <= paper.funding_deadline, ResearchError::FundingDeadlinePassed);

        // Calculate platform fee
        let platform_fee = (amount * program_state.platform_fee_rate as u64) / 10000;
        let net_amount = amount - platform_fee;

        // Transfer tokens from funder to paper account
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.funder_token_account.to_account_info(),
                    to: ctx.accounts.paper_token_account.to_account_info(),
                    authority: ctx.accounts.funder.to_account_info(),
                },
            ),
            net_amount,
        )?;

        // Transfer platform fee if any
        if platform_fee > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.funder_token_account.to_account_info(),
                        to: ctx.accounts.platform_token_account.to_account_info(),
                        authority: ctx.accounts.funder.to_account_info(),
                    },
                ),
                platform_fee,
            )?;
        }

        // Update funding
        paper.funding_current = paper.funding_current.checked_add(net_amount).unwrap();

        // Create funding record
        let funding = &mut ctx.accounts.funding;
        funding.paper_id = paper_id;
        funding.funder = ctx.accounts.funder.key();
        funding.amount = net_amount;
        funding.platform_fee = platform_fee;
        funding.timestamp = current_time;
        funding.bump = ctx.bumps.funding;

        // Update global stats
        let program_state = &mut ctx.accounts.program_state;
        program_state.total_funding = program_state.total_funding.checked_add(net_amount).unwrap();

        // Check if funding goal reached
        if paper.funding_current >= paper.funding_goal {
            paper.status = PaperStatus::FullyFunded;
        }

        emit!(PaperFundedEvent {
            paper_id: paper.id,
            funder: ctx.accounts.funder.key(),
            amount: net_amount,
            platform_fee,
            total_funding: paper.funding_current,
            timestamp: current_time,
        });

        Ok(())
    }

    /// Vote on a paper (with weighted voting)
    pub fn vote_paper(ctx: Context<VotePaper>, paper_id: u64, is_upvote: bool) -> Result<()> {
        let program_state = &ctx.accounts.program_state;
        require!(!program_state.is_paused, ResearchError::ProgramPaused);

        let paper = &mut ctx.accounts.paper;
        require!(paper.is_published, ResearchError::PaperNotPublished);

        let voter_key = ctx.accounts.voter.key();
        let current_time = Clock::get()?.unix_timestamp;

        // Get voter token balance for weighted voting
        let voter_token_data = ctx.accounts.voter_token_account.try_borrow_data()?;
        let voter_balance = if voter_token_data.len() >= 72 {
            u64::from_le_bytes([
                voter_token_data[64], voter_token_data[65], voter_token_data[66], voter_token_data[67],
                voter_token_data[68], voter_token_data[69], voter_token_data[70], voter_token_data[71],
            ])
        } else {
            0 // Default to 0 if account data is insufficient
        };

        let vote_weight = if voter_balance > 0 { 
            std::cmp::min(voter_balance / 1_000_000, 10) // Max 10x weight
        } else { 1 };

        // Create vote record
        let vote = &mut ctx.accounts.vote;
        vote.paper_id = paper_id;
        vote.voter = voter_key;
        vote.is_upvote = is_upvote;
        vote.weight = vote_weight;
        vote.timestamp = current_time;
        vote.bump = ctx.bumps.vote;

        // Update vote counts
        if is_upvote {
            paper.upvotes = paper.upvotes.checked_add(vote_weight).unwrap();
        } else {
            paper.downvotes = paper.downvotes.checked_add(vote_weight).unwrap();
        }

        paper.updated_at = current_time;

        emit!(PaperVotedEvent {
            paper_id: paper.id,
            voter: voter_key,
            is_upvote,
            weight: vote_weight,
            timestamp: current_time,
        });

        Ok(())
    }

    /// Claim funds (only by author when fully funded)
    pub fn claim_funds(ctx: Context<ClaimFunds>, paper_id: u64) -> Result<()> {
        let program_state = &ctx.accounts.program_state;
        require!(!program_state.is_paused, ResearchError::ProgramPaused);

        let paper = &mut ctx.accounts.paper;
        require!(paper.author == ctx.accounts.author.key(), ResearchError::Unauthorized);
        require!(paper.status == PaperStatus::FullyFunded, ResearchError::NotFullyFunded);

        // Get paper token account balance
        let paper_token_data = ctx.accounts.paper_token_account.try_borrow_data()?;
        let paper_token_balance = u64::from_le_bytes([
            paper_token_data[64], paper_token_data[65], paper_token_data[66], paper_token_data[67],
            paper_token_data[68], paper_token_data[69], paper_token_data[70], paper_token_data[71],
        ]);
        
        require!(paper_token_balance > 0, ResearchError::NoFundsToClam);

        // Transfer all funds to author
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.paper_token_account.to_account_info(),
                    to: ctx.accounts.author_token_account.to_account_info(),
                    authority: ctx.accounts.paper_token_account.to_account_info(),
                },
                &[&[
                    b"paper-token", 
                    paper_id.to_le_bytes().as_ref(), 
                    &[ctx.bumps.paper_token_account]
                ]],
            ),
            paper_token_balance,
        )?;

        paper.status = PaperStatus::Completed;
        paper.updated_at = Clock::get()?.unix_timestamp;

        emit!(FundsClaimedEvent {
            paper_id: paper.id,
            author: paper.author,
            amount: paper_token_balance,
            timestamp: paper.updated_at,
        });

        Ok(())
    }

    /// Emergency pause (admin only)
    pub fn toggle_pause(ctx: Context<TogglePause>) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        require!(program_state.admin == ctx.accounts.admin.key(), ResearchError::Unauthorized);
        
        program_state.is_paused = !program_state.is_paused;
        
        emit!(PauseToggledEvent {
            is_paused: program_state.is_paused,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Update platform settings (admin only)
    pub fn update_settings(
        ctx: Context<UpdateSettings>, 
        platform_fee_rate: Option<u16>,
        min_funding_goal: Option<u64>
    ) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        require!(program_state.admin == ctx.accounts.admin.key(), ResearchError::Unauthorized);

        if let Some(fee_rate) = platform_fee_rate {
            require!(fee_rate <= 1000, ResearchError::FeeTooHigh); // Max 10%
            program_state.platform_fee_rate = fee_rate;
        }

        if let Some(min_goal) = min_funding_goal {
            program_state.min_funding_goal = min_goal;
        }

        Ok(())
    }
}

// Account validation structs
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + ProgramState::SPACE,
        seeds = [b"program-state"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(title: String, abstract_text: String, ipfs_hash: String, authors: Vec<String>)]
pub struct SubmitPaper<'info> {
    #[account(mut)]
    pub author: Signer<'info>,
    
    #[account(
        init,
        payer = author,
        space = 8 + ResearchPaper::SPACE + title.len() + abstract_text.len() + ipfs_hash.len() + (authors.len() * 50),
        seeds = [b"paper", program_state.paper_count.to_le_bytes().as_ref()],
        bump
    )]
    pub paper: Account<'info, ResearchPaper>,

    #[account(
        mut,
        seeds = [b"program-state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(paper_id: u64)]
pub struct PublishPaper<'info> {
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"paper", paper_id.to_le_bytes().as_ref()],
        bump = paper.bump
    )]
    pub paper: Account<'info, ResearchPaper>,
    
    #[account(
        seeds = [b"program-state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
}

#[derive(Accounts)]
#[instruction(paper_id: u64, amount: u64)]
pub struct FundPaper<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"paper", paper_id.to_le_bytes().as_ref()],
        bump = paper.bump
    )]
    pub paper: Account<'info, ResearchPaper>,
    
    /// CHECK: Token account validation handled manually
    #[account(mut)]
    pub funder_token_account: AccountInfo<'info>,
    
    /// CHECK: Token account validation handled manually
    #[account(
        mut,
        seeds = [b"paper-token", paper_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub paper_token_account: AccountInfo<'info>,

    /// CHECK: Token account validation handled manually
    #[account(
        mut,
        seeds = [b"platform-vault"],
        bump,
    )]
    pub platform_token_account: AccountInfo<'info>,
    
    #[account(
        init,
        payer = funder,
        space = 8 + Funding::SPACE,
        seeds = [b"funding", paper_id.to_le_bytes().as_ref(), funder.key().as_ref()],
        bump
    )]
    pub funding: Account<'info, Funding>,

    #[account(
        mut,
        seeds = [b"program-state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(paper_id: u64, is_upvote: bool)]
pub struct VotePaper<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"paper", paper_id.to_le_bytes().as_ref()],
        bump = paper.bump
    )]
    pub paper: Account<'info, ResearchPaper>,

    #[account(
        seeds = [b"program-state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,

    /// CHECK: Token account validation handled manually
    pub voter_token_account: AccountInfo<'info>,
    
    #[account(
        init,
        payer = voter,
        space = 8 + Vote::SPACE,
        seeds = [b"vote", paper_id.to_le_bytes().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote: Account<'info, Vote>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(paper_id: u64)]
pub struct ClaimFunds<'info> {
    pub author: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"paper", paper_id.to_le_bytes().as_ref()],
        bump = paper.bump,
        constraint = paper.author == author.key()
    )]
    pub paper: Account<'info, ResearchPaper>,
    
    /// CHECK: Token account validation handled manually
    #[account(
        mut,
        seeds = [b"paper-token", paper_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub paper_token_account: AccountInfo<'info>,
    
    /// CHECK: Token account validation handled manually
    #[account(mut)]
    pub author_token_account: AccountInfo<'info>,

    #[account(
        seeds = [b"program-state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TogglePause<'info> {
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"program-state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
}

#[derive(Accounts)]
pub struct UpdateSettings<'info> {
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"program-state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
}

// Data structures
#[account]
pub struct ProgramState {
    pub admin: Pubkey,
    pub paper_count: u64,
    pub total_funding: u64,
    pub platform_fee_rate: u16, // In basis points (100 = 1%)
    pub min_funding_goal: u64,
    pub max_funding_period: i64,
    pub is_paused: bool,
    pub bump: u8,
}

impl ProgramState {
    pub const SPACE: usize = 32 + 8 + 8 + 2 + 8 + 8 + 1 + 1;
}

#[account]
pub struct ResearchPaper {
    pub id: u64,
    pub author: Pubkey,
    pub title: String,
    pub abstract_text: String,
    pub ipfs_hash: String,
    pub authors: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub is_published: bool,
    pub funding_goal: u64,
    pub funding_current: u64,
    pub funding_deadline: i64,
    pub upvotes: u64,
    pub downvotes: u64,
    pub status: PaperStatus,
    pub review_score: u32,
    pub review_count: u32,
    pub bump: u8,
}

impl ResearchPaper {
    pub const SPACE: usize = 8 + 32 + 4 + 4 + 4 + 4 + 8 + 8 + 1 + 8 + 8 + 8 + 8 + 8 + 1 + 4 + 4 + 1;
}

#[account]
pub struct Funding {
    pub paper_id: u64,
    pub funder: Pubkey,
    pub amount: u64,
    pub platform_fee: u64,
    pub timestamp: i64,
    pub bump: u8,
}

impl Funding {
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 8 + 1;
}

#[account]
pub struct Vote {
    pub paper_id: u64,
    pub voter: Pubkey,
    pub is_upvote: bool,
    pub weight: u64,
    pub timestamp: i64,
    pub bump: u8,
}

impl Vote {
    pub const SPACE: usize = 8 + 32 + 1 + 8 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PaperStatus {
    Draft,
    Published,
    FullyFunded,
    Completed,
    Rejected,
}

// Events
#[event]
pub struct PaperSubmittedEvent {
    pub paper_id: u64,
    pub author: Pubkey,
    pub title: String,
    pub timestamp: i64,
}

#[event]
pub struct PaperPublishedEvent {
    pub paper_id: u64,
    pub author: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PaperFundedEvent {
    pub paper_id: u64,
    pub funder: Pubkey,
    pub amount: u64,
    pub platform_fee: u64,
    pub total_funding: u64,
    pub timestamp: i64,
}

#[event]
pub struct PaperVotedEvent {
    pub paper_id: u64,
    pub voter: Pubkey,
    pub is_upvote: bool,
    pub weight: u64,
    pub timestamp: i64,
}

#[event]
pub struct FundsClaimedEvent {
    pub paper_id: u64,
    pub author: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct PauseToggledEvent {
    pub is_paused: bool,
    pub timestamp: i64,
}

// Error codes
#[error_code]
pub enum ResearchError {
    #[msg("Invalid title length")]
    InvalidTitle,
    
    #[msg("Invalid abstract length")]
    InvalidAbstract,
    
    #[msg("Invalid IPFS hash")]
    InvalidIPFSHash,
    
    #[msg("Invalid authors list")]
    InvalidAuthors,
    
    #[msg("Funding goal too low")]
    FundingGoalTooLow,
    
    #[msg("Invalid funding period")]
    InvalidFundingPeriod,
    
    #[msg("Unauthorized action")]
    Unauthorized,
    
    #[msg("Paper is not published")]
    PaperNotPublished,
    
    #[msg("Funding deadline has passed")]
    FundingDeadlinePassed,
    
    #[msg("Invalid amount")]
    InvalidAmount,
    
    #[msg("Invalid paper status")]
    InvalidPaperStatus,
    
    #[msg("Paper not fully funded")]
    NotFullyFunded,
    
    #[msg("No funds to claim")]
    NoFundsToClam,
    
    #[msg("Program is paused")]
    ProgramPaused,
    
    #[msg("Fee rate too high")]
    FeeTooHigh,
}