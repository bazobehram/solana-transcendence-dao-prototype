use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

const SOLIDARITY_TOKEN_DECIMALS: u8 = 9;
const MAX_VERIFICATION_COUNT: u8 = 3;
const MINIMUM_WAGE_RATIO: u64 = 50; // Minimum 50 tokens per hour
const MINIMUM_AUTONOMY: u64 = 10; // Minimum autonomy score
const UBI_DAILY_AMOUNT: u64 = 10_000_000_000; // 10 SOL tokens in lamports
const WEALTH_CAP_MULTIPLIER: u64 = 10;

#[program]
pub mod smart_contracts {
    use super::*;

    // Initialize the Transcendence DAO
    pub fn initialize_dao(ctx: Context<InitializeDao>, authority: Pubkey) -> Result<()> {
        let dao_state = &mut ctx.accounts.dao_state;
        dao_state.authority = authority;
        dao_state.total_supply = 1_000_000_000_000_000_000; // 1B tokens with 9 decimals
        dao_state.circulating_supply = 0;
        dao_state.median_balance = 0;
        dao_state.active_users = 0;
        dao_state.total_activities = 0;
        dao_state.bump = ctx.bumps.dao_state;
        Ok(())
    }

    // Create user profile
    pub fn create_user_profile(
        ctx: Context<CreateUserProfile>,
        union_membership: bool,
    ) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.owner = ctx.accounts.user.key();
        user_profile.union_membership = union_membership;
        user_profile.tokens_earned = 0;
        user_profile.hours_worked = 0;
        user_profile.activities_completed = 0;
        user_profile.reputation_score = 50; // Start with neutral reputation
        user_profile.strike_participation = 0;
        user_profile.class_solidarity_score = 0;
        user_profile.last_activity = Clock::get()?.unix_timestamp;
        user_profile.bump = ctx.bumps.user_profile;
        
        // Update DAO stats
        let dao_state = &mut ctx.accounts.dao_state;
        dao_state.active_users = dao_state.active_users.checked_add(1).unwrap();
        
        Ok(())
    }

    // Create activity
    pub fn create_activity(
        ctx: Context<CreateActivity>,
        category: ActivityCategory,
        description: String,
        location: Location,
        estimated_hours: u32,
    ) -> Result<()> {
        require!(description.len() <= 200, ErrorCode::DescriptionTooLong);
        
        let activity = &mut ctx.accounts.activity;
        activity.creator = ctx.accounts.user.key();
        activity.category = category.clone();
        activity.description = description;
        activity.location = location;
        activity.estimated_hours = estimated_hours;
        activity.status = ActivityStatus::Pending;
        activity.verification_count = 0;
        activity.verifiers = vec![];
        activity.reward_amount = calculate_base_reward(&category, estimated_hours);
        activity.timestamp = Clock::get()?.unix_timestamp;
        activity.bump = ctx.bumps.activity;
        
        // Update DAO stats
        let dao_state = &mut ctx.accounts.dao_state;
        dao_state.total_activities = dao_state.total_activities.checked_add(1).unwrap();
        
        Ok(())
    }

    // Verify activity (peer-to-peer verification)
    pub fn verify_activity(
        ctx: Context<VerifyActivity>,
        verified: bool,
    ) -> Result<()> {
        let activity = &mut ctx.accounts.activity;
        let verifier = ctx.accounts.verifier.key();
        
        // Check if user already verified this activity
        require!(!activity.verifiers.contains(&verifier), ErrorCode::AlreadyVerified);
        
        // Check if activity is still pending
        require!(activity.status == ActivityStatus::Pending, ErrorCode::ActivityNotPending);
        
        // Add verifier
        activity.verifiers.push(verifier);
        
        if verified {
            activity.verification_count = activity.verification_count.checked_add(1).unwrap();
        }
        
        // Check if we have enough verifications
        if activity.verification_count >= MAX_VERIFICATION_COUNT {
            activity.status = ActivityStatus::Verified;
            
            // Distribute rewards
            distribute_activity_reward(&ctx.accounts.activity, &mut ctx.accounts.user_profile)?;
        } else if activity.verifiers.len() >= MAX_VERIFICATION_COUNT as usize && activity.verification_count == 0 {
            activity.status = ActivityStatus::Rejected;
        }
        
        Ok(())
    }

    // Create strike support
    pub fn create_strike(
        ctx: Context<CreateStrike>,
        company: String,
        union_verification: bool,
        participant_count: u32,
    ) -> Result<()> {
        let strike = &mut ctx.accounts.strike;
        strike.creator = ctx.accounts.user.key();
        strike.company = company;
        strike.union_verification = union_verification;
        strike.participant_count = participant_count;
        strike.daily_support = 80_000_000_000; // 80 SOL per day
        strike.legitimacy_score = if union_verification { 100 } else { 50 };
        strike.total_fund = 0;
        strike.strike_duration = 0;
        strike.supporters = vec![];
        strike.timestamp = Clock::get()?.unix_timestamp;
        strike.bump = ctx.bumps.strike;
        
        Ok(())
    }

    // Support strike
    pub fn support_strike(
        ctx: Context<SupportStrike>,
        amount: u64,
    ) -> Result<()> {
        let strike = &mut ctx.accounts.strike;
        let supporter = ctx.accounts.supporter.key();
        
        // Add to supporters if not already supporting
        if !strike.supporters.contains(&supporter) {
            strike.supporters.push(supporter);
        }
        
        strike.total_fund = strike.total_fund.checked_add(amount).unwrap();
        
        // Update user's class solidarity score
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.class_solidarity_score = user_profile.class_solidarity_score.checked_add(30).unwrap();
        
        Ok(())
    }

    // Create worker cooperative
    pub fn create_worker_coop(
        ctx: Context<CreateWorkerCoop>,
        business_plan: String,
        funding_goal: u64,
        skill_requirements: Vec<SkillType>,
    ) -> Result<()> {
        let worker_coop = &mut ctx.accounts.worker_coop;
        worker_coop.founders = vec![ctx.accounts.user.key()];
        worker_coop.business_plan = business_plan;
        worker_coop.funding_goal = funding_goal;
        worker_coop.current_funding = 0;
        worker_coop.skill_requirements = skill_requirements;
        worker_coop.democratic_votes = 0;
        worker_coop.sustainability_score = 50;
        worker_coop.members = vec![ctx.accounts.user.key()];
        worker_coop.timestamp = Clock::get()?.unix_timestamp;
        worker_coop.bump = ctx.bumps.worker_coop;
        
        Ok(())
    }

    // Fund worker cooperative
    pub fn fund_worker_coop(
        ctx: Context<FundWorkerCoop>,
        amount: u64,
    ) -> Result<()> {
        let worker_coop = &mut ctx.accounts.worker_coop;
        worker_coop.current_funding = worker_coop.current_funding.checked_add(amount).unwrap();
        
        // Update user's class solidarity score
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.class_solidarity_score = user_profile.class_solidarity_score.checked_add(40).unwrap();
        
        Ok(())
    }

    // Create DAO proposal
    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        title: String,
        description: String,
        proposal_type: ProposalType,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        proposal.creator = ctx.accounts.user.key();
        proposal.title = title;
        proposal.description = description;
        proposal.proposal_type = proposal_type;
        proposal.votes_for = 0;
        proposal.votes_against = 0;
        proposal.status = ProposalStatus::Active;
        proposal.created_at = Clock::get()?.unix_timestamp;
        proposal.voting_deadline = Clock::get()?.unix_timestamp + (72 * 60 * 60); // 72 hours
        proposal.voters = vec![];
        proposal.bump = ctx.bumps.proposal;
        
        Ok(())
    }

    // Vote on proposal (quadratic voting)
    pub fn vote_on_proposal(
        ctx: Context<VoteOnProposal>,
        vote: bool, // true for yes, false for no
        token_amount: u64,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let voter = ctx.accounts.voter.key();
        
        require!(proposal.status == ProposalStatus::Active, ErrorCode::ProposalNotActive);
        require!(Clock::get()?.unix_timestamp < proposal.voting_deadline, ErrorCode::VotingDeadlinePassed);
        require!(!proposal.voters.contains(&voter), ErrorCode::AlreadyVoted);
        
        // Quadratic voting: vote weight = sqrt(token_amount)
        let vote_weight = (token_amount as f64).sqrt() as u64;
        
        if vote {
            proposal.votes_for = proposal.votes_for.checked_add(vote_weight).unwrap();
        } else {
            proposal.votes_against = proposal.votes_against.checked_add(vote_weight).unwrap();
        }
        
        proposal.voters.push(voter);
        
        Ok(())
    }

    // Distribute UBI to all active users
    pub fn distribute_ubi(ctx: Context<DistributeUbi>) -> Result<()> {
        let _dao_state = &ctx.accounts.dao_state;
        let user_profile = &mut ctx.accounts.user_profile;
        
        // Check if user is eligible (active in last week)
        let current_time = Clock::get()?.unix_timestamp;
        let week_ago = current_time - (7 * 24 * 60 * 60);
        
        require!(user_profile.last_activity > week_ago, ErrorCode::UserNotActive);
        
        // Distribute UBI
        user_profile.tokens_earned = user_profile.tokens_earned.checked_add(UBI_DAILY_AMOUNT).unwrap();
        
        Ok(())
    }

    // Apply progressive decay to prevent wealth accumulation
    pub fn apply_token_decay(ctx: Context<ApplyTokenDecay>) -> Result<()> {
        let dao_state = &ctx.accounts.dao_state;
        let user_profile = &mut ctx.accounts.user_profile;
        
        if dao_state.median_balance > 0 && user_profile.tokens_earned > dao_state.median_balance {
            let decay_rate = (user_profile.tokens_earned / dao_state.median_balance) * 5; // 0.05% base rate
            let decay_amount = user_profile.tokens_earned * decay_rate / 10000;
            
            user_profile.tokens_earned = user_profile.tokens_earned.checked_sub(decay_amount).unwrap();
            
            // Decayed tokens go to collective treasury
            // This would be implemented with actual token transfers in production
        }
        
        Ok(())
    }
}

// Helper functions
fn calculate_base_reward(category: &ActivityCategory, hours: u32) -> u64 {
    let base_rate = match category {
        ActivityCategory::Environmental => 40,
        ActivityCategory::Disaster => 80,
        ActivityCategory::Elderly => 50,
        ActivityCategory::Education => 60,
        ActivityCategory::WorkerSolidarity => 70,
    };
    
    (base_rate as u64) * (hours as u64) * 1_000_000_000 // Convert to lamports
}

fn distribute_activity_reward(activity: &Activity, user_profile: &mut UserProfile) -> Result<()> {
    user_profile.tokens_earned = user_profile.tokens_earned.checked_add(activity.reward_amount).unwrap();
    user_profile.hours_worked = user_profile.hours_worked.checked_add(activity.estimated_hours as u64).unwrap();
    user_profile.activities_completed = user_profile.activities_completed.checked_add(1).unwrap();
    user_profile.reputation_score = user_profile.reputation_score.checked_add(10).unwrap();
    
    Ok(())
}

// Account structures
#[derive(Accounts)]
pub struct InitializeDao<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + DaoState::INIT_SPACE,
        seeds = [b"dao_state"],
        bump
    )]
    pub dao_state: Account<'info, DaoState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateUserProfile<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + UserProfile::INIT_SPACE,
        seeds = [b"user_profile", user.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub dao_state: Account<'info, DaoState>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateActivity<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Activity::INIT_SPACE,
        seeds = [b"activity", user.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub activity: Account<'info, Activity>,
    #[account(mut)]
    pub dao_state: Account<'info, DaoState>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct VerifyActivity<'info> {
    #[account(mut)]
    pub activity: Account<'info, Activity>,
    #[account(mut)]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub verifier: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateStrike<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Strike::INIT_SPACE,
        seeds = [b"strike", user.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub strike: Account<'info, Strike>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct SupportStrike<'info> {
    #[account(mut)]
    pub strike: Account<'info, Strike>,
    #[account(mut)]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub supporter: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateWorkerCoop<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + WorkerCoop::INIT_SPACE,
        seeds = [b"worker_coop", user.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub worker_coop: Account<'info, WorkerCoop>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct FundWorkerCoop<'info> {
    #[account(mut)]
    pub worker_coop: Account<'info, WorkerCoop>,
    #[account(mut)]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub funder: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", user.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct VoteOnProposal<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub voter: Signer<'info>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct DistributeUbi<'info> {
    #[account(mut)]
    pub dao_state: Account<'info, DaoState>,
    #[account(mut)]
    pub user_profile: Account<'info, UserProfile>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct ApplyTokenDecay<'info> {
    #[account(mut)]
    pub dao_state: Account<'info, DaoState>,
    #[account(mut)]
    pub user_profile: Account<'info, UserProfile>,
}

// Data structures
#[account]
pub struct DaoState {
    pub authority: Pubkey,
    pub total_supply: u64,
    pub circulating_supply: u64,
    pub median_balance: u64,
    pub active_users: u64,
    pub total_activities: u64,
    pub bump: u8,
}

impl DaoState {
    pub const INIT_SPACE: usize = 32 + 8 + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct UserProfile {
    pub owner: Pubkey,
    pub union_membership: bool,
    pub tokens_earned: u64,
    pub hours_worked: u64,
    pub activities_completed: u64,
    pub reputation_score: u64,
    pub strike_participation: u64,
    pub class_solidarity_score: u64,
    pub last_activity: i64,
    pub bump: u8,
}

impl UserProfile {
    pub const INIT_SPACE: usize = 32 + 1 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct Activity {
    pub creator: Pubkey,
    pub category: ActivityCategory,
    pub description: String,
    pub location: Location,
    pub estimated_hours: u32,
    pub status: ActivityStatus,
    pub verification_count: u8,
    pub verifiers: Vec<Pubkey>,
    pub reward_amount: u64,
    pub timestamp: i64,
    pub bump: u8,
}

impl Activity {
    pub const INIT_SPACE: usize = 32 + 1 + 200 + 64 + 4 + 1 + 1 + (32 * 10) + 8 + 8 + 1;
}

#[account]
pub struct Strike {
    pub creator: Pubkey,
    pub company: String,
    pub union_verification: bool,
    pub participant_count: u32,
    pub daily_support: u64,
    pub legitimacy_score: u8,
    pub total_fund: u64,
    pub strike_duration: u32,
    pub supporters: Vec<Pubkey>,
    pub timestamp: i64,
    pub bump: u8,
}

impl Strike {
    pub const INIT_SPACE: usize = 32 + 100 + 1 + 4 + 8 + 1 + 8 + 4 + (32 * 100) + 8 + 1;
}

#[account]
pub struct WorkerCoop {
    pub founders: Vec<Pubkey>,
    pub business_plan: String,
    pub funding_goal: u64,
    pub current_funding: u64,
    pub skill_requirements: Vec<SkillType>,
    pub democratic_votes: u32,
    pub sustainability_score: u8,
    pub members: Vec<Pubkey>,
    pub timestamp: i64,
    pub bump: u8,
}

impl WorkerCoop {
    pub const INIT_SPACE: usize = (32 * 10) + 500 + 8 + 8 + (1 * 20) + 4 + 1 + (32 * 100) + 8 + 1;
}

#[account]
pub struct Proposal {
    pub creator: Pubkey,
    pub title: String,
    pub description: String,
    pub proposal_type: ProposalType,
    pub votes_for: u64,
    pub votes_against: u64,
    pub status: ProposalStatus,
    pub created_at: i64,
    pub voting_deadline: i64,
    pub voters: Vec<Pubkey>,
    pub bump: u8,
}

impl Proposal {
    pub const INIT_SPACE: usize = 32 + 100 + 500 + 1 + 8 + 8 + 1 + 8 + 8 + (32 * 1000) + 1;
}

// Enums
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ActivityCategory {
    Environmental,
    Disaster,
    Elderly,
    Education,
    WorkerSolidarity,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ActivityStatus {
    Pending,
    Verified,
    Rejected,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum SkillType {
    Technical,
    Administrative,
    Legal,
    Marketing,
    Production,
    Education,
    Healthcare,
    Construction,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProposalType {
    TokenomicsChange,
    PolicyUpdate,
    ResourceAllocation,
    TechnicalUpgrade,
    CommunityGuidelines,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProposalStatus {
    Active,
    Passed,
    Rejected,
    Executed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Location {
    pub latitude: f64,
    pub longitude: f64,
    pub address: String,
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Description is too long. Maximum 200 characters allowed.")]
    DescriptionTooLong,
    
    #[msg("User has already verified this activity.")]
    AlreadyVerified,
    
    #[msg("Activity is not in pending status.")]
    ActivityNotPending,
    
    #[msg("Proposal is not active.")]
    ProposalNotActive,
    
    #[msg("Voting deadline has passed.")]
    VotingDeadlinePassed,
    
    #[msg("User has already voted on this proposal.")]
    AlreadyVoted,
    
    #[msg("User is not active enough to receive UBI.")]
    UserNotActive,
    
    #[msg("Exploitation detected - working hours exceed limit.")]
    ExploitationDetected,
    
    #[msg("Insufficient funds for operation.")]
    InsufficientFunds,
    
    #[msg("Unauthorized operation.")]
    Unauthorized,
}
