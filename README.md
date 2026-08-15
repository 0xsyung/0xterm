# 0xterm

`0xterm` is a retro-styled, web-based terminal interface designed for interacting with decentralized finance (DeFi) protocols and EVM-compatible smart contracts. It bridges the gap between classic command-line user experiences and modern Web3 tooling.

---

## **Features**

* **Interactive CLI Shell:** Type commands or use integrated widgets inside a terminal environment complete with Matrix rain effects and logs.
* **DeFi Operations:**
  * Swap tokens.
  * Add liquidity and manage pools.
  * Initialize new liquidity pools[cite: 1].
  * Check account and token balances[cite: 1].
* **Foundry Smart Contract Backend:** Complete development environment for testing, deploying, and managing core contracts (Tokens, Routers, WETH)[cite: 1].
* **Wagmi-Powered Web3 Integration:** Robust support for connecting EVM wallets and switching networks seamlessly[cite: 1].

---

## **Project Architecture**

```text
0xterm-main/
├── contracts/             # Foundry smart contracts workspace
│   ├── script/            # Deployment and setup scripts (e.g., DeployTokens.s.sol)
│   ├── src/               # Smart contract sources (MockToken, SimpleRouter, WETH9)
│   └── test/              # Foundry test files
├── logo-generator/        # Python script utility for generating project logos
└── src/                   # Next.js frontend application
    ├── app/               # App router pages, global styles, and providers
    ├── components/        # Terminal shell, prompt, logs, and matrix visual effects
    │   └── terminal/
    │       └── widgets/   # Modular DeFi UI widgets (Swap, Liquidity, Balance, etc.)
    └── config/            # Web3 and Wagmi configurations
```

---

## **Getting Started**

### **1. Prerequisites**
* Node.js (v18+ recommended)[cite: 1]
* npm or yarn[cite: 1]
* [Foundry](https://book.getfoundry.sh/) (for smart contract compilation and testing)[cite: 1]

### **2. Frontend Installation & Running**
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
    ```bash
    Bash
    npm run dev
    ```
3. Open http://localhost:3000 in your browser.

### **3. Smart Contracts (Foundry)
Navigate to the contracts/ directory to run tests or deploy contracts:
```bash
Bash
cd contracts
forge test
```

---

## **License**
This project is licensed under the MIT License.
