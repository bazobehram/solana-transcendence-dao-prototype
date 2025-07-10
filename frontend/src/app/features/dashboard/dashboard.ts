import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SolanaService } from '../../core/services/solana.service';
import { TranscendenceDaoService } from '../../core/services/transcendence-dao.service';
import { Activities } from '../activities/activities';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, Activities],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard {
  // Reactive signals from services
  walletState;
  userProfile;
  
  // Computed properties
  isConnected;
  balance;
  publicKey;
  hasProfile;
  totalTokensEarned;
  
  showActivities = false;

  constructor(
    private solanaService: SolanaService,
    private transcendenceDaoService: TranscendenceDaoService
  ) {
    // Initialize signals after services are available
    this.walletState = this.solanaService.walletState;
    this.userProfile = this.transcendenceDaoService.userProfile;
    this.isConnected = this.solanaService.isConnected;
    this.balance = this.solanaService.balance;
    this.publicKey = this.solanaService.publicKey;
    this.hasProfile = this.transcendenceDaoService.hasProfile;
    this.totalTokensEarned = this.transcendenceDaoService.totalTokensEarned;
  }

  async connectWallet(): Promise<void> {
    await this.solanaService.connectWallet();
  }

  async disconnectWallet(): Promise<void> {
    console.log('Disconnecting wallet...');
    await this.solanaService.disconnectWallet();
    console.log('Wallet disconnected successfully');
    // Note: User profile data is automatically cleared by the effect in TranscendenceDaoService
  }

  async createProfile(): Promise<void> {
    const success = await this.transcendenceDaoService.createUserProfile(false);
    if (success) {
      console.log('Profile created successfully!');
    } else {
      console.error('Failed to create profile');
    }
  }

  formatPublicKey(publicKey: any): string {
    if (!publicKey) return '';
    const key = publicKey.toString();
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }
}
