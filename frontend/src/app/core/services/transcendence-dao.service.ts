import { Injectable, signal, computed, effect } from "@angular/core";
import { Buffer } from "buffer";
import {
  PublicKey
} from "@solana/web3.js";
import { SolanaService } from "./solana.service";

// Smart contract program ID (deployed on Solana devnet)
const PROGRAM_ID = new PublicKey(
  "AYJ4GLWEyz6nZgKc5bEWBmvPGAMgg11LRztYBsHem8pv"
);

export interface UserProfile {
  owner: PublicKey;
  unionMembership: boolean;
  tokensEarned: number;
  hoursWorked: number;
  activitiesCompleted: number;
  reputationScore: number;
  strikeParticipation: number;
  classSolidarityScore: number;
  lastActivity: Date;
}

export interface Activity {
  id: string;
  creator: PublicKey;
  category: ActivityCategory;
  description: string;
  location: Location;
  estimatedHours: number;
  status: ActivityStatus;
  verificationCount: number;
  verifiers: PublicKey[];
  rewardAmount: number;
  timestamp: Date;
}

export interface Strike {
  id: string;
  creator: PublicKey;
  company: string;
  unionVerification: boolean;
  participantCount: number;
  dailySupport: number;
  legitimacyScore: number;
  totalFund: number;
  strikeDuration: number;
  supporters: PublicKey[];
  timestamp: Date;
}

export interface WorkerCoop {
  id: string;
  founders: PublicKey[];
  businessPlan: string;
  fundingGoal: number;
  currentFunding: number;
  skillRequirements: SkillType[];
  democraticVotes: number;
  sustainabilityScore: number;
  members: PublicKey[];
  timestamp: Date;
}

export interface Proposal {
  id: string;
  creator: PublicKey;
  title: string;
  description: string;
  proposalType: ProposalType;
  votesFor: number;
  votesAgainst: number;
  status: ProposalStatus;
  createdAt: Date;
  votingDeadline: Date;
  voters: PublicKey[];
}

export enum ActivityCategory {
  Environmental = "Environmental",
  Disaster = "Disaster",
  Elderly = "Elderly",
  Education = "Education",
  WorkerSolidarity = "WorkerSolidarity",
}

export enum ActivityStatus {
  Pending = "Pending",
  Verified = "Verified",
  Rejected = "Rejected",
}

export enum SkillType {
  Technical = "Technical",
  Administrative = "Administrative",
  Legal = "Legal",
  Marketing = "Marketing",
  Production = "Production",
  Education = "Education",
  Healthcare = "Healthcare",
  Construction = "Construction",
}

export enum ProposalType {
  TokenomicsChange = "TokenomicsChange",
  PolicyUpdate = "PolicyUpdate",
  ResourceAllocation = "ResourceAllocation",
  TechnicalUpgrade = "TechnicalUpgrade",
  CommunityGuidelines = "CommunityGuidelines",
}

export enum ProposalStatus {
  Active = "Active",
  Passed = "Passed",
  Rejected = "Rejected",
  Executed = "Executed",
}

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

@Injectable({
  providedIn: "root",
})
export class TranscendenceDaoService {
  // Deployed smart contract Program ID on Solana devnet
  private readonly PROGRAM_ID = new PublicKey(
    "AYJ4GLWEyz6nZgKc5bEWBmvPGAMgg11LRztYBsHem8pv"
  );

  // Signals for state management
  private userProfileSignal = signal<UserProfile | null>(null);
  private activitiesSignal = signal<Activity[]>([]);
  private strikesSignal = signal<Strike[]>([]);
  private cooperativesSignal = signal<WorkerCoop[]>([]);
  private proposalsSignal = signal<Proposal[]>([]);

  // Public readonly signals
  public readonly userProfile = this.userProfileSignal.asReadonly();
  public readonly activities = this.activitiesSignal.asReadonly();
  public readonly strikes = this.strikesSignal.asReadonly();
  public readonly cooperatives = this.cooperativesSignal.asReadonly();
  public readonly proposals = this.proposalsSignal.asReadonly();

  // Computed signals for convenience
  public readonly hasProfile = computed(() => this.userProfile() !== null);
  public readonly totalTokensEarned = computed(() => this.userProfile()?.tokensEarned || 0);
  public readonly totalActivities = computed(() => this.activities().length);
  public readonly pendingActivities = computed(() => 
    this.activities().filter(a => a.status === ActivityStatus.Pending).length
  );

  constructor(private solanaService: SolanaService) {
    // Use effect to reactively load data when wallet state changes
    effect(() => {
      const walletState = this.solanaService.walletState();
      if (walletState.connected && walletState.publicKey) {
        this.loadUserProfile(walletState.publicKey);
        this.loadActivities();
        this.loadStrikes();
        this.loadCooperatives();
        this.loadProposals();
      } else {
        this.clearUserData();
      }
    });
  }

  // Initialize DAO (one-time setup)
  async initializeDao(): Promise<boolean> {
    try {
      const walletState = this.solanaService.getCurrentWalletState();
      if (!walletState.connected || !walletState.publicKey) {
        throw new Error("Wallet not connected");
      }

      console.log("Initializing Transcendence DAO smart contract...");

      // For now, we'll mock the DAO initialization
      // In a real implementation, this would call the smart contract
      return true;
    } catch (error) {
      console.error("Failed to initialize DAO:", error);
      return false;
    }
  }

  // User Profile Management
  async createUserProfile(unionMembership: boolean): Promise<boolean> {
    try {
      const walletState = this.solanaService.getCurrentWalletState();
      if (!walletState.connected || !walletState.publicKey) {
        throw new Error("Wallet not connected");
      }

      console.log("Creating user profile on smart contract:", {
        programId: this.PROGRAM_ID.toString(),
        user: walletState.publicKey.toString(),
        unionMembership,
      });

      // Derive the user profile PDA (Program Derived Address)
      const [userProfilePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_profile"), walletState.publicKey.toBuffer()],
        this.PROGRAM_ID
      );

      // Check if profile already exists
      const connection = this.solanaService.getConnection();
      const existingProfile = await connection.getAccountInfo(userProfilePda);

      if (existingProfile) {
        console.log("User profile already exists, loading data...");
        await this.loadUserProfileFromBlockchain(walletState.publicKey);
        return true;
      }

      // For now, create a local profile (smart contract call would go here)
      // In production, this would create an actual transaction
      console.log("Creating new user profile on blockchain...");

      const profile: UserProfile = {
        owner: walletState.publicKey,
        unionMembership,
        tokensEarned: 0,
        hoursWorked: 0,
        activitiesCompleted: 0,
        reputationScore: 50,
        strikeParticipation: 0,
        classSolidarityScore: 0,
        lastActivity: new Date(),
      };

      this.userProfileSignal.set(profile);
      console.log("User profile created successfully!");
      return true;
    } catch (error) {
      console.error("Failed to create user profile:", error);
      return false;
    }
  }

  private async loadUserProfile(publicKey: PublicKey): Promise<void> {
    try {
      await this.loadUserProfileFromBlockchain(publicKey);
    } catch (error) {
      console.error("Failed to load user profile:", error);
    }
  }

  private async loadUserProfileFromBlockchain(
    publicKey: PublicKey
  ): Promise<void> {
    try {
      // Derive the user profile PDA
      const [userProfilePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_profile"), publicKey.toBuffer()],
        this.PROGRAM_ID
      );

      const connection = this.solanaService.getConnection();
      const accountInfo = await connection.getAccountInfo(userProfilePda);

      if (accountInfo) {
        console.log(
          "Found user profile on blockchain:",
          userProfilePda.toString()
        );

        // In a real implementation, we would deserialize the account data
        // For now, we'll create a profile indicating it exists on-chain
        const profile: UserProfile = {
          owner: publicKey,
          unionMembership: false,
          tokensEarned: 0, // This would be read from blockchain
          hoursWorked: 0,
          activitiesCompleted: 0,
          reputationScore: 50,
          strikeParticipation: 0,
          classSolidarityScore: 0,
          lastActivity: new Date(),
        };

        this.userProfileSignal.set(profile);
      } else {
        console.log("No user profile found on blockchain, showing mock data");

        // Show mock data to demonstrate the UI
        const profile: UserProfile = {
          owner: publicKey,
          unionMembership: false,
          tokensEarned: 150.5,
          hoursWorked: 24,
          activitiesCompleted: 8,
          reputationScore: 75,
          strikeParticipation: 2,
          classSolidarityScore: 85,
          lastActivity: new Date(),
        };

        this.userProfileSignal.set(profile);
      }
    } catch (error) {
      console.error("Failed to load user profile from blockchain:", error);
    }
  }

  // Activity Management
  async createActivity(
    category: ActivityCategory,
    description: string,
    location: Location,
    estimatedHours: number
  ): Promise<boolean> {
    try {
      const walletState = this.solanaService.getCurrentWalletState();
      if (!walletState.connected || !walletState.publicKey) {
        throw new Error("Wallet not connected");
      }

      // TODO: Implement actual smart contract call
      const activity: Activity = {
        id: Date.now().toString(),
        creator: walletState.publicKey,
        category,
        description,
        location,
        estimatedHours,
        status: ActivityStatus.Pending,
        verificationCount: 0,
        verifiers: [],
        rewardAmount: this.calculateReward(category, estimatedHours),
        timestamp: new Date(),
      };

      const currentActivities = this.activities();
      this.activitiesSignal.set([activity, ...currentActivities]);

      return true;
    } catch (error) {
      console.error("Failed to create activity:", error);
      return false;
    }
  }

  async verifyActivity(
    activityId: string,
    verified: boolean
  ): Promise<boolean> {
    try {
      // TODO: Implement actual smart contract call
      const activities = this.activities().map((activity) => {
        if (activity.id === activityId) {
          const verifierKey =
            this.solanaService.getCurrentWalletState().publicKey;
          if (verifierKey && !activity.verifiers.includes(verifierKey)) {
            activity.verifiers.push(verifierKey);
            if (verified) {
              activity.verificationCount++;
            }
            if (activity.verificationCount >= 3) {
              activity.status = ActivityStatus.Verified;
            }
          }
        }
        return activity;
      });

      this.activitiesSignal.set(activities);
      return true;
    } catch (error) {
      console.error("Failed to verify activity:", error);
      return false;
    }
  }

  private async loadActivities(): Promise<void> {
    try {
      // TODO: Implement actual smart contract data fetching
      // For now, create mock activities
      const mockActivities: Activity[] = [
        {
          id: "1",
          creator: new PublicKey("11111111111111111111111111111112"),
          category: ActivityCategory.Environmental,
          description: "Beach cleanup in Antalya",
          location: {
            latitude: 36.8841,
            longitude: 30.7056,
            address: "Antalya, Turkey",
          },
          estimatedHours: 4,
          status: ActivityStatus.Verified,
          verificationCount: 3,
          verifiers: [],
          rewardAmount: 160,
          timestamp: new Date(Date.now() - 86400000),
        },
        {
          id: "2",
          creator: new PublicKey("11111111111111111111111111111113"),
          category: ActivityCategory.WorkerSolidarity,
          description: "Supporting factory workers strike",
          location: {
            latitude: 41.0082,
            longitude: 28.9784,
            address: "Istanbul, Turkey",
          },
          estimatedHours: 8,
          status: ActivityStatus.Pending,
          verificationCount: 1,
          verifiers: [],
          rewardAmount: 560,
          timestamp: new Date(Date.now() - 3600000),
        },
      ];

      this.activitiesSignal.set(mockActivities);
    } catch (error) {
      console.error("Failed to load activities:", error);
    }
  }

  // Strike Management
  async createStrike(
    company: string,
    unionVerification: boolean,
    participantCount: number
  ): Promise<boolean> {
    try {
      const walletState = this.solanaService.getCurrentWalletState();
      if (!walletState.connected || !walletState.publicKey) {
        throw new Error("Wallet not connected");
      }

      // TODO: Implement actual smart contract call
      const strike: Strike = {
        id: Date.now().toString(),
        creator: walletState.publicKey,
        company,
        unionVerification,
        participantCount,
        dailySupport: 80,
        legitimacyScore: unionVerification ? 100 : 50,
        totalFund: 0,
        strikeDuration: 0,
        supporters: [],
        timestamp: new Date(),
      };

      const currentStrikes = this.strikes();
      this.strikesSignal.set([strike, ...currentStrikes]);

      return true;
    } catch (error) {
      console.error("Failed to create strike:", error);
      return false;
    }
  }

  private async loadStrikes(): Promise<void> {
    // TODO: Implement actual smart contract data fetching
    this.strikesSignal.set([]);
  }

  // Cooperative Management
  async createWorkerCoop(
    businessPlan: string,
    fundingGoal: number,
    skillRequirements: SkillType[]
  ): Promise<boolean> {
    try {
      const walletState = this.solanaService.getCurrentWalletState();
      if (!walletState.connected || !walletState.publicKey) {
        throw new Error("Wallet not connected");
      }

      // TODO: Implement actual smart contract call
      const coop: WorkerCoop = {
        id: Date.now().toString(),
        founders: [walletState.publicKey],
        businessPlan,
        fundingGoal,
        currentFunding: 0,
        skillRequirements,
        democraticVotes: 0,
        sustainabilityScore: 50,
        members: [walletState.publicKey],
        timestamp: new Date(),
      };

      const currentCoops = this.cooperatives();
      this.cooperativesSignal.set([coop, ...currentCoops]);

      return true;
    } catch (error) {
      console.error("Failed to create worker cooperative:", error);
      return false;
    }
  }

  private async loadCooperatives(): Promise<void> {
    // TODO: Implement actual smart contract data fetching
    this.cooperativesSignal.set([]);
  }

  // Proposal Management
  async createProposal(
    title: string,
    description: string,
    proposalType: ProposalType
  ): Promise<boolean> {
    try {
      const walletState = this.solanaService.getCurrentWalletState();
      if (!walletState.connected || !walletState.publicKey) {
        throw new Error("Wallet not connected");
      }

      // TODO: Implement actual smart contract call
      const proposal: Proposal = {
        id: Date.now().toString(),
        creator: walletState.publicKey,
        title,
        description,
        proposalType,
        votesFor: 0,
        votesAgainst: 0,
        status: ProposalStatus.Active,
        createdAt: new Date(),
        votingDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
        voters: [],
      };

      const currentProposals = this.proposals();
      this.proposalsSignal.set([proposal, ...currentProposals]);

      return true;
    } catch (error) {
      console.error("Failed to create proposal:", error);
      return false;
    }
  }

  private async loadProposals(): Promise<void> {
    // TODO: Implement actual smart contract data fetching
    this.proposalsSignal.set([]);
  }

  private calculateReward(category: ActivityCategory, hours: number): number {
    const baseRates = {
      [ActivityCategory.Environmental]: 40,
      [ActivityCategory.Disaster]: 80,
      [ActivityCategory.Elderly]: 50,
      [ActivityCategory.Education]: 60,
      [ActivityCategory.WorkerSolidarity]: 70,
    };

    return baseRates[category] * hours;
  }

  private clearUserData(): void {
    this.userProfileSignal.set(null);
    this.activitiesSignal.set([]);
    this.strikesSignal.set([]);
    this.cooperativesSignal.set([]);
    this.proposalsSignal.set([]);
  }
}
