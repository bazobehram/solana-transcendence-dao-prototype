# Fairwork DAO Smart Contract

This document provides an overview of the Fairwork DAO smart contract, its architecture, and how it interacts with the frontend application.

## Overview

The Fairwork DAO smart contract is the backbone of the Fairwork DAO platform. It is a Solana program that governs the core logic of the DAO, including user profiles, activities, strikes, and proposals. The smart contract is responsible for maintaining the state of the DAO and ensuring that all interactions are secure and transparent.

## Program ID

The smart contract is deployed on the Solana devnet with the following program ID:

```
AYJ4GLWEyz6nZgKc5bEWBmvPGAMgg11LRztYBsHem8pv
```

## Architecture

The smart contract is built using the Anchor framework, which simplifies the development of Solana programs. The contract is defined in the `smart_contracts.json` file, which serves as the ABI (Application Binary Interface) for the frontend. This file describes the instructions, accounts, and data structures that the smart contract uses.

### Instructions

The smart contract exposes the following instructions, which can be called by the frontend:

-   `initializeDao`: Initializes the DAO state.
-   `createUserProfile`: Creates a new user profile.
-   `createActivity`: Creates a new activity.
-   `verifyActivity`: Verifies an existing activity.
-   `createStrike`: Creates a new strike.

### Accounts

The smart contract uses the following accounts to store data on the blockchain:

-   `DaoState`: Stores the global state of the DAO, such as the total supply of tokens and the number of active users.
-   `UserProfile`: Stores information about a specific user, such as their reputation score and the number of activities they have completed.
-   `Activity`: Stores information about a specific activity, such as its description, location, and status.

### Data Structures

The smart contract uses several data structures to represent complex data types, such as:

-   `ActivityCategory`: An enum that represents the category of an activity (e.g., Environmental, Disaster, etc.).
-   `ActivityStatus`: An enum that represents the status of an activity (e.g., Pending, Verified, etc.).
-   `Location`: A struct that represents a geographical location.

## Interaction with the Frontend

The frontend application interacts with the smart contract through the `FairworkDaoService`. This service provides methods for calling the smart contract's instructions and reading data from its accounts. The service also uses mock data for development purposes, which allows the UI to be developed and tested without requiring a constant connection to the Solana devnet.

### `FairworkDaoService`

The `FairworkDaoService` is an Angular service that encapsulates all the logic for interacting with the Fairwork DAO smart contract. It provides a clean and simple API for the rest of the application to use.

#### Key Methods

-   `initializeDao()`: Calls the `initializeDao` instruction on the smart contract.
-   `createUserProfile()`: Calls the `createUserProfile` instruction on the smart contract.
-   `createActivity()`: Calls the `createActivity` instruction on the smart contract.
-   `verifyActivity()`: Calls the `verifyActivity` instruction on the smart contract.
-   `createStrike()`: Calls the `createStrike` instruction on the smart contract.

## Future Development

The smart contract is still under development, and many features have not yet been implemented. The `fairwork-dao.service.ts` file contains several `TODO` comments that indicate where new functionality needs to be added. Future development will focus on implementing the remaining features and moving away from mock data to a fully functional smart contract.
