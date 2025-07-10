import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  TranscendenceDaoService, 
  Activity, 
  ActivityCategory, 
  ActivityStatus,
  Location 
} from '../../core/services/transcendence-dao.service';
import { SolanaService } from '../../core/services/solana.service';

@Component({
  selector: 'app-activities',
  imports: [CommonModule, FormsModule],
  templateUrl: './activities.html',
  styleUrl: './activities.scss'
})
export class Activities {
  // Use signal directly from service
  activities;
  isCreatingActivity = false;
  
  // Form data for new activity
  newActivity = {
    category: ActivityCategory.Environmental,
    description: '',
    address: '',
    estimatedHours: 1,
    latitude: 0,
    longitude: 0
  };

  // Enum references for template
  ActivityCategory = ActivityCategory;
  ActivityStatus = ActivityStatus;

  constructor(
    private transcendenceDaoService: TranscendenceDaoService,
    private solanaService: SolanaService
  ) {
    // Initialize signal after service is available
    this.activities = this.transcendenceDaoService.activities;
    
    // Get user's current location
    this.getCurrentLocation();
  }

  private getCurrentLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.newActivity.latitude = position.coords.latitude;
          this.newActivity.longitude = position.coords.longitude;
        },
        (error) => {
          console.log('Location access denied or unavailable');
        }
      );
    }
  }

  async createActivity(): Promise<void> {
    if (!this.newActivity.description.trim()) {
      alert('Please provide a description for your activity');
      return;
    }

    if (!this.newActivity.address.trim()) {
      alert('Please provide an address for your activity');
      return;
    }

    this.isCreatingActivity = true;

    try {
      const location: Location = {
        latitude: this.newActivity.latitude,
        longitude: this.newActivity.longitude,
        address: this.newActivity.address
      };

      const success = await this.transcendenceDaoService.createActivity(
        this.newActivity.category,
        this.newActivity.description,
        location,
        this.newActivity.estimatedHours
      );

      if (success) {
        // Reset form
        this.newActivity = {
          category: ActivityCategory.Environmental,
          description: '',
          address: '',
          estimatedHours: 1,
          latitude: this.newActivity.latitude,
          longitude: this.newActivity.longitude
        };
        alert('Activity created successfully! It will be available for verification by other users.');
      } else {
        alert('Failed to create activity. Please try again.');
      }
    } catch (error) {
      console.error('Error creating activity:', error);
      alert('Failed to create activity. Please ensure your wallet is connected.');
    } finally {
      this.isCreatingActivity = false;
    }
  }

  async verifyActivity(activityId: string, verified: boolean): Promise<void> {
    try {
      const success = await this.transcendenceDaoService.verifyActivity(activityId, verified);
      if (success) {
        const action = verified ? 'verified' : 'rejected';
        alert(`Activity ${action} successfully!`);
      } else {
        alert('Failed to verify activity. You may have already verified this activity.');
      }
    } catch (error) {
      console.error('Error verifying activity:', error);
      alert('Failed to verify activity.');
    }
  }

  getCategoryDisplayName(category: ActivityCategory): string {
    switch (category) {
      case ActivityCategory.Environmental:
        return '🌍 Environmental';
      case ActivityCategory.Disaster:
        return '🚨 Disaster Relief';
      case ActivityCategory.Elderly:
        return '👴 Elderly Care';
      case ActivityCategory.Education:
        return '📚 Education';
      case ActivityCategory.WorkerSolidarity:
        return '✊ Worker Solidarity';
      default:
        return category;
    }
  }

  getStatusColor(status: ActivityStatus): string {
    switch (status) {
      case ActivityStatus.Pending:
        return '#f57c00';
      case ActivityStatus.Verified:
        return '#2e7d32';
      case ActivityStatus.Rejected:
        return '#d32f2f';
      default:
        return '#666';
    }
  }

  formatPublicKey(publicKey: any): string {
    if (!publicKey) return '';
    const key = publicKey.toString();
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  canVerify(activity: Activity): boolean {
    const currentUser = this.solanaService.getCurrentWalletState().publicKey;
    if (!currentUser) return false;
    
    // Can't verify your own activity
    if (activity.creator.equals(currentUser)) return false;
    
    // Can't verify if already verified by this user
    return !activity.verifiers.some(verifier => verifier.equals(currentUser));
  }
}
