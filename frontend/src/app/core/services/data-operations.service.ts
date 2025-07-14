import { Injectable } from '@angular/core';
import { AnchorProvider, Program, BN } from '@project-serum/anchor';
import { 
  PublicKey, 
  SystemProgram, 
  Transaction, 
  TransactionInstruction,
  SYSVAR_CLOCK_PUBKEY,
  Keypair
} from '@solana/web3.js';
import { SolanaService } from './solana.service';

declare const Buffer: any;

@Injectable({
  providedIn: 'root'
})
export class DataOperationsService {
  
  private readonly PROGRAM_ID = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');
  
  constructor(private solanaService: SolanaService) {}

  /**
   * REGISTRATION OPERATIONS
   * Creating new data records on Solana blockchain
   */
  
  // Register User Profile
  async registerUserProfile(unionMembership: boolean): Promise<{ success: boolean; signature?: string }> {
    try {
      const walletState = this.solanaService.getCurrentWalletState();
      if (!walletState.connected || !walletState.publicKey) {
        throw new Error('Wallet not connected');
      }

      // Derive Program Derived Address (PDA) for user profile
      const [userProfilePda, bump] = await PublicKey.findProgramAddress(
        [Buffer.from('user_profile'), walletState.publicKey.toBuffer()],
        this.PROGRAM_ID
      );

      // Check if profile already exists
      const connection = this.solanaService.getConnection();
      const existingProfile = await connection.getAccountInfo(userProfilePda);
      
      if (existingProfile) {
        return { success: false }; // Profile already exists
      }

      // Create transaction
      const transaction = new Transaction();
      
      // Build instruction data
      const instructionData = this.buildCreateUserProfileInstruction(unionMembership);
      
      const instruction = new TransactionInstruction({
        programId: this.PROGRAM_ID,
        keys: [
          { pubkey: userProfilePda, isSigner: false, isWritable: true },
          { pubkey: walletState.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: instructionData
      });

      transaction.add(instruction);

      // Send transaction
      const signature = await this.solanaService.sendTransaction(transaction);
      
      return { 
        success: signature !== null, 
        signature: signature || undefined 
      };
      
    } catch (error) {
      console.error('Failed to register user profile:', error);
      return { success: false };
    }
  }

  // Register Activity
  async registerActivity(
    category: string, 
    description: string, 
    location: any, 
    estimatedHours: number
  ): Promise<{ success: boolean; signature?: string; activityId?: string }> {
    try {
      const walletState = this.solanaService.getCurrentWalletState();
      if (!walletState.connected || !walletState.publicKey) {
        throw new Error('Wallet not connected');
      }

      // Generate unique activity ID
      const activityId = `${Date.now()}_${walletState.publicKey.toString().slice(0, 8)}`;
      
      // Derive PDA for activity
      const [activityPda, bump] = await PublicKey.findProgramAddress(
        [Buffer.from('activity'), Buffer.from(activityId)],
        this.PROGRAM_ID
      );

      // Derive DAO state PDA
      const [daoStatePda] = await PublicKey.findProgramAddress(
        [Buffer.from('dao_state')],
        this.PROGRAM_ID
      );

      const transaction = new Transaction();
      
      const instructionData = this.buildCreateActivityInstruction(
        category, description, location, estimatedHours
      );
      
      const instruction = new TransactionInstruction({
        programId: this.PROGRAM_ID,
        keys: [
          { pubkey: activityPda, isSigner: false, isWritable: true },
          { pubkey: daoStatePda, isSigner: false, isWritable: true },
          { pubkey: walletState.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: instructionData
      });

      transaction.add(instruction);

      const signature = await this.solanaService.sendTransaction(transaction);
      
      return { 
        success: signature !== null, 
        signature: signature || undefined,
        activityId: signature ? activityId : undefined
      };
      
    } catch (error) {
      console.error('Failed to register activity:', error);
      return { success: false };
    }
  }

  /**
   * FETCHING OPERATIONS
   * Retrieving data from Solana blockchain
   */
  
  // Fetch User Profile
  async fetchUserProfile(userPublicKey: PublicKey): Promise<any> {
    try {
      const [userProfilePda] = await PublicKey.findProgramAddress(
        [Buffer.from('user_profile'), userPublicKey.toBuffer()],
        this.PROGRAM_ID
      );

      const connection = this.solanaService.getConnection();
      const accountInfo = await connection.getAccountInfo(userProfilePda);
      
      if (!accountInfo) {
        return null; // Profile doesn't exist
      }

      // Deserialize account data
      return this.deserializeUserProfile(accountInfo.data);
      
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      return null;
    }
  }

  // Fetch All Activities
  async fetchAllActivities(): Promise<any[]> {
    try {
      const connection = this.solanaService.getConnection();
      
      // Get all program accounts
      const accounts = await connection.getProgramAccounts(this.PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 0, // Discriminator offset
              bytes: this.getActivityDiscriminator() // Activity account discriminator
            }
          }
        ]
      });

      const activities = [];
      
      for (const account of accounts) {
        try {
          const activityData = this.deserializeActivity(account.account.data);
          activities.push({
            publicKey: account.pubkey,
            ...activityData
          });
        } catch (parseError) {
          console.warn('Failed to parse activity:', parseError);
        }
      }

      return activities;
      
    } catch (error) {
      console.error('Failed to fetch activities:', error);
      return [];
    }
  }

  // Fetch Specific Activity
  async fetchActivity(activityId: string): Promise<any> {
    try {
      const [activityPda] = await PublicKey.findProgramAddress(
        [Buffer.from('activity'), Buffer.from(activityId)],
        this.PROGRAM_ID
      );

      const connection = this.solanaService.getConnection();
      const accountInfo = await connection.getAccountInfo(activityPda);
      
      if (!accountInfo) {
        return null;
      }

      return this.deserializeActivity(accountInfo.data);
      
    } catch (error) {
      console.error('Failed to fetch activity:', error);
      return null;
    }
  }

  /**
   * APPROVAL OPERATIONS
   * Approving or verifying data records
   */
  
  // Approve/Verify Activity
  async approveActivity(
    activityId: string, 
    approved: boolean
  ): Promise<{ success: boolean; signature?: string }> {
    try {
      const walletState = this.solanaService.getCurrentWalletState();
      if (!walletState.connected || !walletState.publicKey) {
        throw new Error('Wallet not connected');
      }

      // Derive PDAs
      const [activityPda] = await PublicKey.findProgramAddress(
        [Buffer.from('activity'), Buffer.from(activityId)],
        this.PROGRAM_ID
      );

      const [userProfilePda] = await PublicKey.findProgramAddress(
        [Buffer.from('user_profile'), walletState.publicKey.toBuffer()],
        this.PROGRAM_ID
      );

      const transaction = new Transaction();
      
      const instructionData = this.buildVerifyActivityInstruction(approved);
      
      const instruction = new TransactionInstruction({
        programId: this.PROGRAM_ID,
        keys: [
          { pubkey: activityPda, isSigner: false, isWritable: true },
          { pubkey: userProfilePda, isSigner: false, isWritable: true },
          { pubkey: walletState.publicKey, isSigner: true, isWritable: true },
        ],
        data: instructionData
      });

      transaction.add(instruction);

      const signature = await this.solanaService.sendTransaction(transaction);
      
      return { 
        success: signature !== null, 
        signature: signature || undefined 
      };
      
    } catch (error) {
      console.error('Failed to approve activity:', error);
      return { success: false };
    }
  }

  /**
   * DELETION OPERATIONS
   * Soft delete or archive data records
   */
  
  // Delete Activity (soft delete by changing status)
  async deleteActivity(activityId: string): Promise<{ success: boolean; signature?: string }> {
    try {
      const walletState = this.solanaService.getCurrentWalletState();
      if (!walletState.connected || !walletState.publicKey) {
        throw new Error('Wallet not connected');
      }

      // Derive activity PDA
      const [activityPda] = await PublicKey.findProgramAddress(
        [Buffer.from('activity'), Buffer.from(activityId)],
        this.PROGRAM_ID
      );

      // Check if user is the creator
      const connection = this.solanaService.getConnection();
      const accountInfo = await connection.getAccountInfo(activityPda);
      
      if (!accountInfo) {
        throw new Error('Activity not found');
      }

      const activityData = this.deserializeActivity(accountInfo.data);
      
      if (activityData.creator.toString() !== walletState.publicKey.toString()) {
        throw new Error('Only creator can delete activity');
      }

      // Create soft delete transaction (change status to "Deleted")
      const transaction = new Transaction();
      
      const instructionData = this.buildDeleteActivityInstruction();
      
      const instruction = new TransactionInstruction({
        programId: this.PROGRAM_ID,
        keys: [
          { pubkey: activityPda, isSigner: false, isWritable: true },
          { pubkey: walletState.publicKey, isSigner: true, isWritable: true },
        ],
        data: instructionData
      });

      transaction.add(instruction);

      const signature = await this.solanaService.sendTransaction(transaction);
      
      return { 
        success: signature !== null, 
        signature: signature || undefined 
      };
      
    } catch (error) {
      console.error('Failed to delete activity:', error);
      return { success: false };
    }
  }

  /**
   * REAL-TIME UPDATES
   * Subscribe to account changes
   */
  
  // Subscribe to activity changes
  subscribeToActivityChanges(
    activityId: string, 
    callback: (activityData: any) => void
  ): number {
    return this.solanaService.subscribeToAccountChanges(
      new PublicKey(activityId),
      (accountInfo) => {
        if (accountInfo) {
          const activityData = this.deserializeActivity(accountInfo.data);
          callback(activityData);
        }
      }
    );
  }

  // Subscribe to user profile changes
  subscribeToUserProfileChanges(
    userPublicKey: PublicKey,
    callback: (profileData: any) => void
  ): number {
    return this.solanaService.subscribeToAccountChanges(
      userPublicKey,
      (accountInfo) => {
        if (accountInfo) {
          const profileData = this.deserializeUserProfile(accountInfo.data);
          callback(profileData);
        }
      }
    );
  }

  /**
   * BATCH OPERATIONS
   * Handle multiple operations in a single transaction
   */
  
  // Batch approve multiple activities
  async batchApproveActivities(
    activityIds: string[], 
    approved: boolean
  ): Promise<{ success: boolean; signature?: string }> {
    try {
      const walletState = this.solanaService.getCurrentWalletState();
      if (!walletState.connected || !walletState.publicKey) {
        throw new Error('Wallet not connected');
      }

      const transaction = new Transaction();
      
      // Add instruction for each activity
      for (const activityId of activityIds) {
        const [activityPda] = await PublicKey.findProgramAddress(
          [Buffer.from('activity'), Buffer.from(activityId)],
          this.PROGRAM_ID
        );

        const [userProfilePda] = await PublicKey.findProgramAddress(
          [Buffer.from('user_profile'), walletState.publicKey.toBuffer()],
          this.PROGRAM_ID
        );

        const instructionData = this.buildVerifyActivityInstruction(approved);
        
        const instruction = new TransactionInstruction({
          programId: this.PROGRAM_ID,
          keys: [
            { pubkey: activityPda, isSigner: false, isWritable: true },
            { pubkey: userProfilePda, isSigner: false, isWritable: true },
            { pubkey: walletState.publicKey, isSigner: true, isWritable: true },
          ],
          data: instructionData
        });

        transaction.add(instruction);
      }

      const signature = await this.solanaService.sendTransaction(transaction);
      
      return { 
        success: signature !== null, 
        signature: signature || undefined 
      };
      
    } catch (error) {
      console.error('Failed to batch approve activities:', error);
      return { success: false };
    }
  }

  /**
   * HELPER METHODS
   * Instruction building and data serialization
   */
  
  private buildCreateUserProfileInstruction(unionMembership: boolean): Buffer {
    // Build instruction data for creating user profile
    const data = Buffer.alloc(9); // 8 bytes for discriminator + 1 for bool
    
    // Add discriminator (method selector)
    data.writeUInt32LE(0x12345678, 0); // Replace with actual discriminator
    
    // Add union membership flag
    data.writeUInt8(unionMembership ? 1 : 0, 8);
    
    return data;
  }

  private buildCreateActivityInstruction(
    category: string, 
    description: string, 
    location: any, 
    estimatedHours: number
  ): Buffer {
    // Build instruction data for creating activity
    const descriptionBuffer = Buffer.from(description, 'utf8');
    const addressBuffer = Buffer.from(location.address, 'utf8');
    
    const data = Buffer.alloc(
      8 + // discriminator
      1 + // category enum
      4 + descriptionBuffer.length + // description length + data
      8 + 8 + // location lat/lng
      4 + addressBuffer.length + // address length + data
      4 // estimated hours
    );
    
    let offset = 0;
    
    // Add discriminator
    data.writeUInt32LE(0x87654321, offset); // Replace with actual discriminator
    offset += 8;
    
    // Add category
    data.writeUInt8(this.mapCategoryToIndex(category), offset);
    offset += 1;
    
    // Add description
    data.writeUInt32LE(descriptionBuffer.length, offset);
    offset += 4;
    descriptionBuffer.copy(data, offset);
    offset += descriptionBuffer.length;
    
    // Add location
    data.writeDoubleLE(location.latitude, offset);
    offset += 8;
    data.writeDoubleLE(location.longitude, offset);
    offset += 8;
    
    // Add address
    data.writeUInt32LE(addressBuffer.length, offset);
    offset += 4;
    addressBuffer.copy(data, offset);
    offset += addressBuffer.length;
    
    // Add estimated hours
    data.writeUInt32LE(estimatedHours, offset);
    
    return data;
  }

  private buildVerifyActivityInstruction(verified: boolean): Buffer {
    const data = Buffer.alloc(9);
    
    // Add discriminator
    data.writeUInt32LE(0x11223344, 0); // Replace with actual discriminator
    
    // Add verified flag
    data.writeUInt8(verified ? 1 : 0, 8);
    
    return data;
  }

  private buildDeleteActivityInstruction(): Buffer {
    const data = Buffer.alloc(8);
    
    // Add discriminator for delete operation
    data.writeUInt32LE(0x44332211, 0); // Replace with actual discriminator
    
    return data;
  }

  private deserializeUserProfile(data: Buffer): any {
    // Deserialize user profile data from account
    let offset = 8; // Skip discriminator
    
    return {
      owner: new PublicKey(data.slice(offset, offset + 32)),
      unionMembership: data.readUInt8(offset + 32) === 1,
      tokensEarned: new BN(data.slice(offset + 33, offset + 41), 'le'),
      hoursWorked: new BN(data.slice(offset + 41, offset + 49), 'le'),
      activitiesCompleted: new BN(data.slice(offset + 49, offset + 57), 'le'),
      reputationScore: new BN(data.slice(offset + 57, offset + 65), 'le'),
      strikeParticipation: new BN(data.slice(offset + 65, offset + 73), 'le'),
      classSolidarityScore: new BN(data.slice(offset + 73, offset + 81), 'le'),
      lastActivity: new BN(data.slice(offset + 81, offset + 89), 'le'),
      bump: data.readUInt8(offset + 89)
    };
  }

  private deserializeActivity(data: Buffer): any {
    // Deserialize activity data from account
    let offset = 8; // Skip discriminator
    
    return {
      creator: new PublicKey(data.slice(offset, offset + 32)),
      category: data.readUInt8(offset + 32),
      description: this.readString(data, offset + 33),
      // ... continue parsing based on your data structure
    };
  }

  private readString(buffer: Buffer, offset: number): string {
    const length = buffer.readUInt32LE(offset);
    return buffer.slice(offset + 4, offset + 4 + length).toString('utf8');
  }

  private mapCategoryToIndex(category: string): number {
    const categories = ['Environmental', 'Disaster', 'Elderly', 'Education', 'WorkerSolidarity'];
    return categories.indexOf(category);
  }

  private getActivityDiscriminator(): string {
    // Return the base58 encoded discriminator for Activity accounts
    // This should match your smart contract's discriminator
    return 'base58EncodedDiscriminator';
  }
}
