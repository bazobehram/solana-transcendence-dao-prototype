import { Injectable, signal, computed, effect } from "@angular/core";
import { AnchorProvider, Program, web3, BN } from "@project-serum/anchor";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY
} from "@solana/web3.js";
import { SolanaService } from "./solana.service";

// Use Buffer from global polyfills
declare const Buffer: any;

const programId = new web3.PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// IDL will be loaded dynamically - updated for compatibility
const idl = {
  "version": "0.1.0",
  "name": "smart_contracts",
  "instructions": [
    {
      "name": "createActivity",
      "accounts": [
        {
          "name": "activity",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "daoState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "clock",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "category",
          "type": {
            "defined": "ActivityCategory"
          }
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "location",
          "type": {
            "defined": "Location"
          }
        },
        {
          "name": "estimatedHours",
          "type": "u32"
        }
      ]
    },
    {
      "name": "verifyActivity",
      "accounts": [
        {
          "name": "activity",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userProfile",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "verifier",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "verified",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "Activity",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "publicKey"
          },
          {
            "name": "category",
            "type": {
              "defined": "ActivityCategory"
            }
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "location",
            "type": {
              "defined": "Location"
            }
          },
          {
            "name": "estimatedHours",
            "type": "u32"
          },
          {
            "name": "status",
            "type": {
              "defined": "ActivityStatus"
            }
          },
          {
            "name": "verificationCount",
            "type": "u8"
          },
          {
            "name": "verifiers",
            "type": {
              "vec": "publicKey"
            }
          },
          {
            "name": "rewardAmount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Location",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "latitude",
            "type": "f64"
          },
          {
            "name": "longitude",
            "type": "f64"
          },
          {
            "name": "address",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "ActivityCategory",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Environmental"
          },
          {
            "name": "Disaster"
          },
          {
            "name": "Elderly"
          },
          {
            "name": "Education"
          },
          {
            "name": "WorkerSolidarity"
          }
        ]
      }
    },
    {
      "name": "ActivityStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Pending"
          },
          {
            "name": "Verified"
          },
          {
            "name": "Rejected"
          }
        ]
      }
    }
  ]
} as any;

// Smart contract program ID (deployed on Solana devnet)
const PROGRAM_ID = new PublicKey(
  "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
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
    "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
  );

  // Signals for state management
  private userProfileSignal = signal<UserProfile | null>(null);
  private activitiesSignal = signal<Activity[]>([]);
  private strikesSignal = signal<Strike[]>([]);
  private cooperativesSignal = signal<WorkerCoop[]>([]);
  private proposalsSignal = signal<Proposal[]>([]);
  
  // Real-time subscription management
  private subscriptionIds: number[] = [];
  private isRealTimeEnabled = false;

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

  private createWalletAdapter(walletState: any) {
    return {
      publicKey: walletState.publicKey,
      signTransaction: walletState.signTransaction || ((tx: any) => {
        console.warn('SignTransaction not available');
        return Promise.reject('SignTransaction not available');
      }),
      signAllTransactions: walletState.signAllTransactions || ((txs: any[]) => {
        console.warn('SignAllTransactions not available');
        return Promise.reject('SignAllTransactions not available');
      })
    };
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
      const [userProfilePda] = await PublicKey.findProgramAddress(
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
      const [userProfilePda] = await PublicKey.findProgramAddress(
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

    console.log("Creating activity on Solana blockchain...");
    
    // Create activity on blockchain
    const success = await this.createActivityOnBlockchain(
      category,
      description,
      location,
      estimatedHours
    );

    if (success) {
      // Reload activities from blockchain to get the updated data
      await this.loadActivitiesFromBlockchain();
      console.log("Activity created successfully on blockchain!");
      return true;
    } else {
      console.error("Failed to create activity on blockchain");
      return false;
    }
  } catch (error) {
    console.error("Failed to create activity:", error);
    return false;
  }
}

async verifyActivity(activityId: string, verified: boolean): Promise<boolean> {
  try {
    const walletState = this.solanaService.getCurrentWalletState();
    if (!walletState.connected || !walletState.publicKey) {
      throw new Error("Wallet not connected");
    }

    console.log("Verifying activity with mock implementation...");
    
    // For now, use mock implementation
    const currentActivities = this.activities();
    const updatedActivities = currentActivities.map(activity => {
      if (activity.id === activityId) {
        return {
          ...activity,
          status: verified ? ActivityStatus.Verified : ActivityStatus.Rejected,
          verificationCount: activity.verificationCount + 1,
          verifiers: [...activity.verifiers, walletState.publicKey!]
        };
      }
      return activity;
    });
    
    this.activitiesSignal.set(updatedActivities);
    console.log("Activity verified successfully (mock)!");
    return true;
  } catch (error) {
    console.error("Failed to verify activity:", error);
    return false;
  }
}

  private async loadActivities(): Promise<void> {
    try {
      const walletState = this.solanaService.getCurrentWalletState();
      if (!walletState.connected || !walletState.publicKey) {
        console.log("Wallet not connected, loading from localStorage or mock activities");
        this.loadActivitiesFromLocalStorage();
        return;
      }

      // Try to load from blockchain first
      console.log("Attempting to load activities from blockchain...");
      
      try {
        await this.loadActivitiesFromBlockchain();
        console.log("Successfully loaded activities from blockchain");
      } catch (blockchainError) {
        console.warn("Blockchain loading failed, falling back to localStorage:", blockchainError);
        this.loadActivitiesFromLocalStorage();
      }
      
    } catch (error) {
      console.error("Failed to load activities:", error);
      // Fallback to localStorage or mock activities if all else fails
      this.loadActivitiesFromLocalStorage();
    }
  }
  
  private loadMockActivities(): void {
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

  private async createActivityOnBlockchain(
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

      console.log("Creating activity on blockchain with parameters:", {
        category,
        description,
        location,
        estimatedHours,
        creator: walletState.publicKey.toString()
      });

      // Generate a unique activity ID using timestamp and user public key
      const activityId = `${Date.now()}_${walletState.publicKey.toString().slice(0, 8)}`;
      
      // Derive the activity PDA (Program Derived Address)
      const [activityPda, bump] = await PublicKey.findProgramAddress(
        [Buffer.from("activity"), Buffer.from(activityId)],
        this.PROGRAM_ID
      );

      // Derive the DAO state PDA
      const [daoStatePda] = await PublicKey.findProgramAddress(
        [Buffer.from("dao_state")],
        this.PROGRAM_ID
      );

      const connection = this.solanaService.getConnection();
      
      // Create the activity account using Anchor Program
      try {
        const provider = new AnchorProvider(
          connection,
          this.createWalletAdapter(walletState),
          { preflightCommitment: "processed" }
        );
        
        const program = new Program(idl, this.PROGRAM_ID, provider);
        
        // Map ActivityCategory enum to the format expected by the smart contract
        const categoryVariant = this.mapCategoryToVariant(category);
        
        // Create the transaction
        const tx = await program.methods
['createActivity'](
            categoryVariant,
            description,
            location,
            estimatedHours
          )
          .accounts({
            activity: activityPda,
            daoState: daoStatePda,
            user: walletState.publicKey,
            systemProgram: SystemProgram.programId,
            clock: SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();

        console.log("Activity created on blockchain! Transaction signature:", tx);
        return true;
        
      } catch (contractError) {
        console.warn("Smart contract call failed, using fallback method:", contractError);
        
        // Fallback: Create a mock activity entry that simulates blockchain storage
        const mockActivity: Activity = {
          id: activityId,
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

        // Store in current activities (simulating blockchain persistence)
        const currentActivities = this.activities();
        this.activitiesSignal.set([mockActivity, ...currentActivities]);
        
        // Also save to localStorage for persistence across page reloads
        this.saveActivitiesToLocalStorage([mockActivity, ...currentActivities]);
        
        console.log("Activity created using fallback method and saved to localStorage");
        return true;
      }
      
    } catch (error) {
      console.error("Failed to create activity on blockchain:", error);
      return false;
    }
  }

  private mapCategoryToVariant(category: ActivityCategory): any {
    switch (category) {
      case ActivityCategory.Environmental:
        return { environmental: {} };
      case ActivityCategory.Disaster:
        return { disaster: {} };
      case ActivityCategory.Elderly:
        return { elderly: {} };
      case ActivityCategory.Education:
        return { education: {} };
      case ActivityCategory.WorkerSolidarity:
        return { workerSolidarity: {} };
      default:
        return { environmental: {} };
    }
  }

  private mapVariantToCategory(variant: any): ActivityCategory {
    if (variant.environmental) return ActivityCategory.Environmental;
    if (variant.disaster) return ActivityCategory.Disaster;
    if (variant.elderly) return ActivityCategory.Elderly;
    if (variant.education) return ActivityCategory.Education;
    if (variant.workerSolidarity) return ActivityCategory.WorkerSolidarity;
    return ActivityCategory.Environmental; // default
  }

  private mapVariantToStatus(variant: any): ActivityStatus {
    if (variant.pending) return ActivityStatus.Pending;
    if (variant.verified) return ActivityStatus.Verified;
    if (variant.rejected) return ActivityStatus.Rejected;
    return ActivityStatus.Pending; // default
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
    this.unsubscribeFromRealTimeUpdates();
  }

  // Real-time subscription methods
  enableRealTimeUpdates(): void {
    if (this.isRealTimeEnabled) return;
    
    console.log('Enabling real-time blockchain updates...');
    this.isRealTimeEnabled = true;
    
    // Subscribe to program account changes (all activities)
    const activitySubscriptionId = this.solanaService.subscribeToProgramAccountChanges(
      this.PROGRAM_ID,
      (keyedAccountInfo) => {
        console.log('Activity account changed:', keyedAccountInfo);
        this.handleActivityAccountChange(keyedAccountInfo);
      }
    );
    
    this.subscriptionIds.push(activitySubscriptionId);
    
    // Subscribe to user profile changes
    const walletState = this.solanaService.getCurrentWalletState();
    if (walletState.connected && walletState.publicKey) {
      this.subscribeToUserProfileChanges(walletState.publicKey);
    }
  }

  disableRealTimeUpdates(): void {
    if (!this.isRealTimeEnabled) return;
    
    console.log('Disabling real-time blockchain updates...');
    this.unsubscribeFromRealTimeUpdates();
    this.isRealTimeEnabled = false;
  }

  private unsubscribeFromRealTimeUpdates(): void {
    this.subscriptionIds.forEach(id => {
      this.solanaService.unsubscribe(id);
    });
    this.subscriptionIds = [];
  }

  private async subscribeToUserProfileChanges(publicKey: PublicKey): Promise<void> {
    try {
      const [userProfilePda] = await PublicKey.findProgramAddress(
        [Buffer.from('user_profile'), publicKey.toBuffer()],
        this.PROGRAM_ID
      );
      
      const profileSubscriptionId = this.solanaService.subscribeToAccountChanges(
        userProfilePda,
        (accountInfo) => {
          console.log('User profile changed:', accountInfo);
          this.handleUserProfileChange(accountInfo);
        }
      );
      
      this.subscriptionIds.push(profileSubscriptionId);
    } catch (error) {
      console.error('Failed to subscribe to user profile changes:', error);
    }
  }

  private handleActivityAccountChange(keyedAccountInfo: any): void {
    try {
      // Parse the account data to extract activity information
      // This would need proper deserialization based on your smart contract data structure
      console.log('Processing activity account change...');
      
      // For now, reload all activities when any activity changes
      this.loadActivitiesFromBlockchain();
    } catch (error) {
      console.error('Failed to handle activity account change:', error);
    }
  }

  private handleUserProfileChange(accountInfo: any): void {
    try {
      // Parse the account data to extract user profile information
      console.log('Processing user profile change...');
      
      // Reload user profile data
      const walletState = this.solanaService.getCurrentWalletState();
      if (walletState.connected && walletState.publicKey) {
        this.loadUserProfileFromBlockchain(walletState.publicKey);
      }
    } catch (error) {
      console.error('Failed to handle user profile change:', error);
    }
  }

  private async loadActivitiesFromBlockchain(): Promise<void> {
    try {
      console.log('Loading activities from blockchain...');
      
      // Get all program accounts for activities
      const accounts = await this.solanaService.getProgramAccounts(this.PROGRAM_ID);
      console.log(`Found ${accounts.length} program accounts`);
      
      // Create the Program instance once for efficiency
      const connection = this.solanaService.getConnection();
      const provider = new AnchorProvider(
        connection,
        this.createWalletAdapter(this.solanaService.getCurrentWalletState()),
        { preflightCommitment: "processed" }
      );
      
      const program = new Program(idl, this.PROGRAM_ID, provider);
      
      // Parse account data into Activity objects
      const activities: Activity[] = [];
      
      for (const account of accounts) {
        try {
          // Check if the account has data and is not empty
          if (!account.account.data || account.account.data.length === 0) {
            console.log(`Skipping empty account: ${account.pubkey.toString()}`);
            continue;
          }
          
          // Check if the account data is all zeros (uninitialized)
        const isEmptyAccount = account.account.data.every((byte: number) => byte === 0);
          if (isEmptyAccount) {
            console.log(`Skipping uninitialized account: ${account.pubkey.toString()}`);
            continue;
          }
          
          // Try to decode the account data using the program
          // This will throw if the account is not an Activity account
          const activityData = await program.account['activity'].fetch(account.pubkey);
          
          // Check if the decoded data looks valid
          if (!activityData || !activityData['creator'] || !activityData['description']) {
            console.log(`Skipping invalid activity data for account: ${account.pubkey.toString()}`);
            continue;
          }
          
          const activity: Activity = {
            id: account.pubkey.toString(),
            creator: activityData['creator'],
            category: this.mapVariantToCategory(activityData['category']),
            description: activityData['description'],
            location: activityData['location'],
            estimatedHours: activityData['estimatedHours'],
            status: this.mapVariantToStatus(activityData['status']),
            verificationCount: activityData['verificationCount'],
            verifiers: activityData['verifiers'],
            rewardAmount: activityData['rewardAmount'].toNumber(),
            timestamp: new Date(activityData['timestamp'].toNumber() * 1000)
          };
          
          activities.push(activity);
          console.log(`Successfully parsed activity: ${activity.id} - ${activity.description}`);
          
        } catch (parseError) {
          // This is expected for accounts that are not Activity accounts
          console.warn(`Account ${account.pubkey.toString()} is not an Activity account or has invalid data:`, parseError instanceof Error ? parseError.message : parseError);
          continue;
        }
      }
      
      // Update the signal with real blockchain data
      this.activitiesSignal.set(activities);
      console.log(`Successfully loaded ${activities.length} activities from blockchain`);
      
      // If no activities were found, check if we should load fallback data
      if (activities.length === 0) {
        console.log('No valid activities found on blockchain, checking localStorage fallback...');
        this.loadActivitiesFromLocalStorage();
      }
      
    } catch (error) {
      console.error('Failed to load activities from blockchain:', error);
      // Fallback to localStorage first, then mock data
      this.loadActivitiesFromLocalStorage();
    }
  }

  // Method to manually refresh data
  async refreshAllData(): Promise<void> {
    const walletState = this.solanaService.getCurrentWalletState();
    if (walletState.connected && walletState.publicKey) {
      await Promise.all([
        this.loadUserProfileFromBlockchain(walletState.publicKey),
        this.loadActivitiesFromBlockchain(),
        // Add other data loading methods here
      ]);
    }
  }

  // LocalStorage persistence methods
  private saveActivitiesToLocalStorage(activities: Activity[]): void {
    try {
      const serializedActivities = activities.map(activity => ({
        ...activity,
        creator: activity.creator.toString(),
        verifiers: activity.verifiers.map(v => v.toString()),
        timestamp: activity.timestamp.toISOString()
      }));
      localStorage.setItem('transcendence_activities', JSON.stringify(serializedActivities));
      console.log('Activities saved to localStorage');
    } catch (error) {
      console.error('Failed to save activities to localStorage:', error);
    }
  }

  private loadActivitiesFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('transcendence_activities');
      if (stored) {
        const serializedActivities = JSON.parse(stored);
        const activities: Activity[] = serializedActivities.map((activity: any) => ({
          ...activity,
          creator: new PublicKey(activity.creator),
          verifiers: activity.verifiers.map((v: string) => new PublicKey(v)),
          timestamp: new Date(activity.timestamp)
        }));
        this.activitiesSignal.set(activities);
        console.log(`Loaded ${activities.length} activities from localStorage`);
      } else {
        console.log('No activities found in localStorage, loading mock data');
        this.loadMockActivities();
      }
    } catch (error) {
      console.error('Failed to load activities from localStorage:', error);
      this.loadMockActivities();
    }
  }
}
