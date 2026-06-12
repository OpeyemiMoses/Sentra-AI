# Sentra AI — AI-Powered RWA Yield Manager on Mantle

Sentra AI is an autonomous yield management DApp built on Mantle blockchain. It allocates user deposits across real-world asset (RWA) tokens using an AI agent that monitors yield rates, detects risk signals, and rebalances the vault automatically — all on-chain.

Built for the **Mantle Turing Test Hackathon 2026 — Track 3: AI × RWA**.

---

## Live Demo

> Deployed on Vercel — [sentra-ai-plum.vercel.app](https://sentra-ai-plum.vercel.app)

---

## Smart Contracts — Mantle Sepolia Testnet

| Contract | Address |
|---|---|
| SentraVault | `0xf12Bbf29A778244F85500C416Ac8D3ca9b62e677` |
| Mock mETH | `0x14CADfD7b1AE71f0f533Cc84ab7652e8fb09B5c8` |
| Mock USDY | `0xEDB90295680f2efC2aE1044109eb404eDF27F402` |
| Mock USDC | `0xa22Ab840F2b49E44980ED4f709930627180C7353` |
| Mock mUSD | `0x6E5673998706ab0796B49407DfD43560E71e8F4E` |

---

## What It Does

Sentra AI gives users a single vault to deposit RWA-backed assets. An AI agent running on a 5-minute cycle monitors simulated yield rates across mETH, USDY, USDC, and mUSD, then automatically rebalances the vault allocation based on the user's chosen risk profile.

Every decision the agent makes is logged on-chain and displayed in plain language on the AI Decision Feed.

---

## Key Features

**AI Vault Agent**
Runs on a 5-minute timer in the browser. Reads yield data, evaluates risk conditions, and calls `updateAllocation` on the SentraVault contract when a meaningful rebalance is needed. Respects the user's risk profile — Conservative, Balanced, or Aggressive.

**Four Supported Assets**
- **mETH** — Mock liquid staking ETH (highest yield, higher risk)
- **USDY** — Mock tokenized treasury RWA (stable yield, low risk)
- **USDC** — Mock stablecoin (liquidity reserve)
- **mUSD** — Mock Mantle-native dollar (blended yield)

**Real On-Chain Transactions**
Deposits, withdrawals, and rebalances are all real transactions on Mantle Sepolia. Every event is emitted on-chain and visible on the Mantle Sepolia explorer.

**AI Decision Feed**
A live chronological log of every agent decision — rebalances, risk alerts, yield updates, and monitoring checks — displayed in plain language with color-coded status indicators.

**Per-Wallet Feed History**
Each connected wallet has its own feed history stored in localStorage. Switching wallets loads that wallet's history automatically.

**Yield Performance Page**
Compares the Sentra AI vault against passively holding any single asset. Includes a live line chart with timeframe switching (7D, 30D, 90D, 1Y, ALL), allocation timeline, risk protection meter, and benchmark table.

**Risk Profile Settings**
Users choose Conservative, Balanced, or Aggressive. The AI agent adjusts its rebalancing logic and allocation targets accordingly. Live preview shows expected APY range, drawdown, and automation speed.

**Test Token Faucet**
Built-in mint page lets users mint 10,000 of any supported test token directly to their wallet for testing deposits and withdrawals.

**Wallet Connection**
Supports all EIP-6963 compatible wallets (MetaMask, Rabby, Coinbase Wallet, etc.) with automatic Mantle Sepolia network switching.

---

## How It Works

1. Connect your wallet — Sentra AI auto-switches to Mantle Sepolia
2. Mint test tokens from the faucet page
3. Choose your risk profile in Settings
4. Deposit any supported asset into the vault
5. The AI agent activates and begins monitoring yield conditions
6. Watch the AI Feed to see every decision the agent makes in real time
7. Check the Performance page to see how the vault compares against passive strategies

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Blockchain | Mantle Sepolia Testnet |
| Smart Contracts | Solidity ^0.8.20 |
| Wallet Connection | EIP-6963, Ethers.js v6.13.0 |
| Contract IDE | Remix IDE |
| Deployment | Vercel |

---

---


## Running Locally

1. Clone the repo
```bash
git clone https://github.com/yourusername/sentra-ai.git
cd sentra-ai
```

Open with Live Server in VS Code or any local server
 Connect MetaMask and switch to Mantle Sepolia Testnet:
RPC: https://rpc.sepolia.mantle.xyz
Chain ID: 5003
Symbol: MNT
Explorer: https://explorer.sepolia.mantle.xyz
Mint test tokens from the faucet page and start testing

AI Agent Logic
The agent runs every 5 minutes and follows this decision flow:
Generates slightly randomized yield rates for each asset each cycle
Checks for a volatility event (15% random probability)
Compares current allocation against target allocation for the active risk profile
If any asset allocation differs by 5% or more, calls updateAllocation on-chain
Logs every decision to the AI Feed regardless of whether a rebalance occurred

Risk profiles:
Conservative — USDY/mUSD heavy (70%), retreats to stables on any volatility
Balanced — Mixed allocation (38/26/20/16 default), adapts to yield signals
Aggressive — mETH heavy (70-80%), only retreats on severe yield drops

Network Details
Network: Mantle Sepolia Testnet
Chain ID: 5003
RPC: https://rpc.sepolia.mantle.xyz
Explorer: https://explorer.sepolia.mantle.xyz
Hackathon


Built for Mantle Turing Test Hackathon 2026
Track: AI × RWA (Track 3)

Sponsored by: Mantle

-----
License
MIT

