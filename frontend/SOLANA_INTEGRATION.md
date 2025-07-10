# Solana and SolanaService in Angular

This document explains how Solana is integrated into this Angular application and how the `SolanaService` works to interact with the Solana blockchain.

## What is Solana?

Solana is a high-performance blockchain platform designed for decentralized applications and crypto-currencies. It is known for its fast transaction speeds and low fees. In this application, we use Solana to interact with a wallet (Phantom) and send transactions to the blockchain.

## What is `SolanaService`?

The `SolanaService` is an Angular injectable service that encapsulates all the logic for interacting with the Solana blockchain. It simplifies the process of connecting to a wallet, checking the balance, and sending transactions. By centralizing this logic, we make it easy for any component in our application to interact with Solana without duplicating code.

## Key Dependencies

Our project uses the following key dependencies for Solana integration:

-   `@solana/web3.js`: The official Solana library for interacting with the Solana JSON RPC API. It provides the tools to create transactions, connect to the network, and interact with accounts.
-   `@project-serum/anchor`: A framework that simplifies building Solana programs. While it is a dependency in this project, it is not directly used in the `solana.service.ts` file. It is likely used for interacting with specific on-chain programs.
-   `bn.js`: A library for working with large numbers, which is essential for handling token amounts and other blockchain-related calculations.
-   `buffer`: Provides a Buffer implementation, which is necessary for handling binary data when creating transactions.

## How `SolanaService` Works

The `solana.service.ts` file contains the core logic for our Solana integration. Here's a breakdown of its key parts:

### Wallet State Management

The service uses a RxJS `BehaviorSubject` to manage the wallet's state. This allows other parts of the application to subscribe to wallet state changes and react accordingly.

```typescript
export interface WalletState {
  connected: boolean;
  publicKey: PublicKey | null;
  balance: number;
}

private walletStateSubject = new BehaviorSubject<WalletState>({
  connected: false,
  publicKey: null,
  balance: 0,
});

public walletState$: Observable<WalletState> = this.walletStateSubject.asObservable();
```

Any component can subscribe to `walletState$` to get real-time updates on the wallet's connection status, public key, and balance.

### Connection to Solana

The service connects to the Solana "devnet" (a test network for development purposes) in its constructor.

```typescript
constructor() {
  this.connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  this.initializeWallet();
}
```

### Key Methods

-   `initializeWallet()`: This private method is called in the constructor to check if the Phantom wallet is already connected to the site. If so, it updates the wallet state.
-   `connectWallet()`: This method prompts the user to connect their Phantom wallet. If successful, it updates the wallet state.
-   `disconnectWallet()`: This method disconnects the wallet and resets the wallet state.
-   `updateWalletState(publicKey: PublicKey)`: This private method is called after a successful connection. It fetches the account balance and updates the `walletStateSubject`.
-   `getBalance(publicKey: PublicKey)`: A utility method to get the balance of any public key.
-   `sendTransaction(transaction: Transaction)`: This method takes a `Transaction` object, signs it using the connected Phantom wallet, sends it to the network, and waits for confirmation.
-   `getConnection()`: Returns the raw `Connection` object for more advanced use cases.
-   `getCurrentWalletState()`: Returns the current value of the wallet state.

## Usage in an Angular Component

Here is a hypothetical example of how a component might use the `SolanaService`:

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { SolanaService, WalletState } from './core/services/solana.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-wallet-status',
  template: `
    <div *ngIf="walletState.connected">
      <p>Connected with public key: {{ walletState.publicKey?.toBase58() }}</p>
      <p>Balance: {{ walletState.balance }} SOL</p>
      <button (click)="disconnect()">Disconnect</button>
    </div>
    <div *ngIf="!walletState.connected">
      <button (click)="connect()">Connect Wallet</button>
    </div>
  `
})
export class WalletStatusComponent implements OnInit, OnDestroy {
  walletState: WalletState;
  private walletStateSubscription: Subscription;

  constructor(private solanaService: SolanaService) {}

  ngOnInit() {
    this.walletStateSubscription = this.solanaService.walletState$.subscribe(state => {
      this.walletState = state;
    });
  }

  ngOnDestroy() {
    if (this.walletStateSubscription) {
      this.walletStateSubscription.unsubscribe();
    }
  }

  connect() {
    this.solanaService.connectWallet();
  }

  disconnect() {
    this.solanaService.disconnectWallet();
  }
}
```

This example demonstrates how a component can subscribe to the `walletState$` observable to display wallet information and provide connect/disconnect functionality.
