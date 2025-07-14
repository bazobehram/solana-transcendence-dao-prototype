import { Injectable, signal, computed } from "@angular/core";
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  Transaction,
} from "@solana/web3.js";

export interface WalletState {
  connected: boolean;
  publicKey: PublicKey | null;
  balance: number;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
}

@Injectable({
  providedIn: "root",
})
export class SolanaService {
  private connection: Connection;
  
  // Signals for wallet state
  private walletStateSignal = signal<WalletState>({
    connected: false,
    publicKey: null,
    balance: 0,
  });

  // Public readonly signal
  public readonly walletState = this.walletStateSignal.asReadonly();
  
  // Computed signals for convenience
  public readonly isConnected = computed(() => this.walletState().connected);
  public readonly publicKey = computed(() => this.walletState().publicKey);
  public readonly balance = computed(() => this.walletState().balance);

  constructor() {
    // Initialize connection to Solana devnet
    this.connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    this.initializeWallet();
  }

  private async initializeWallet(): Promise<void> {
    try {
      // Check if Phantom wallet is available
      if (typeof window !== "undefined" && (window as any).solana) {
        const solana = (window as any).solana;

        if (solana.isPhantom) {
          // Check if already connected
          const response = await solana.connect({ onlyIfTrusted: true });
          if (response.publicKey) {
            await this.updateWalletState(response.publicKey);
          }
        }
      }
    } catch (error) {
      console.log("Wallet not connected or not available");
    }
  }

  async connectWallet(): Promise<boolean> {
    try {
      if (typeof window !== "undefined" && (window as any).solana) {
        const solana = (window as any).solana;

        if (solana.isPhantom) {
          const response = await solana.connect();
          await this.updateWalletState(response.publicKey);
          return true;
        } else {
          alert(
            "Phantom wallet is not installed. Please install it from phantom.app"
          );
          return false;
        }
      } else {
        alert("Solana wallet not detected. Please install Phantom wallet.");
        return false;
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      return false;
    }
  }

  async disconnectWallet(): Promise<void> {
    try {
      // Update local state first to ensure UI responds quickly
      this.walletStateSignal.set({
        connected: false,
        publicKey: null,
        balance: 0,
      });

      // Then try to disconnect from wallet (this may fail but won't affect functionality)
      if (typeof window !== "undefined" && (window as any).solana) {
        const solana = (window as any).solana;
        try {
          await solana.disconnect();
          console.log("Wallet disconnected successfully");
        } catch (walletError: any) {
          // Phantom service worker errors are common and can be safely ignored
          if (
            walletError?.message?.includes("disconnected port") ||
            walletError?.message?.includes("service worker")
          ) {
            console.log(
              "Wallet disconnected (service worker communication ended)"
            );
          } else {
            console.warn(
              "Wallet disconnect warning:",
              walletError?.message || walletError
            );
          }
        }
      }
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      // Ensure UI state is still updated even if disconnect fails
      this.walletStateSignal.set({
        connected: false,
        publicKey: null,
        balance: 0,
      });
    }
  }

  private async updateWalletState(publicKey: PublicKey): Promise<void> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      const solana = (window as any).solana;

      this.walletStateSignal.set({
        connected: true,
        publicKey,
        balance: balance / 1e9, // Convert lamports to SOL
        signTransaction: solana?.signTransaction,
        signAllTransactions: solana?.signAllTransactions,
      });
    } catch (error) {
      console.error("Failed to update wallet state:", error);
    }
  }

  async getBalance(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error("Failed to get balance:", error);
      return 0;
    }
  }

  async sendTransaction(transaction: Transaction): Promise<string | null> {
    try {
      if (typeof window !== "undefined" && (window as any).solana) {
        const solana = (window as any).solana;

        const { signature } = await solana.signAndSendTransaction(transaction);

        // Wait for confirmation
        await this.connection.confirmTransaction(signature, "confirmed");

        return signature;
      }
      return null;
    } catch (error) {
      console.error("Failed to send transaction:", error);
      return null;
    }
  }

  getConnection(): Connection {
    return this.connection;
  }

  getCurrentWalletState(): WalletState {
    return this.walletState();
  }

  // Real-time subscription methods
  subscribeToAccountChanges(publicKey: PublicKey, callback: (accountInfo: any) => void): number {
    return this.connection.onAccountChange(publicKey, callback, 'confirmed');
  }

  subscribeToProgramAccountChanges(programId: PublicKey, callback: (keyedAccountInfo: any) => void): number {
    return this.connection.onProgramAccountChange(programId, callback, 'confirmed');
  }

  unsubscribe(subscriptionId: number): void {
    this.connection.removeAccountChangeListener(subscriptionId);
  }

  async getAccountInfo(publicKey: PublicKey): Promise<any> {
    return await this.connection.getAccountInfo(publicKey);
  }

  async getProgramAccounts(programId: PublicKey): Promise<readonly any[]> {
    return await this.connection.getProgramAccounts(programId);
  }
}
