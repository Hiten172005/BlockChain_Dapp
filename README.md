# Credit System Dapp - Setup & Usage Guide

This guide will help you set up, deploy, and test the Credit System Dapp using Hardhat and MetaMask.  
Follow each step carefully, even if you are new to blockchain development.

---

## 1. Prerequisites

- **Node.js**: Download and install from [nodejs.org](https://nodejs.org/) (LTS version recommended).
- **MetaMask**: Install the MetaMask browser extension from [metamask.io](https://metamask.io/).

---

## 2. Project Setup

Open your terminal and run:

```bash
# Clone or create your project folder
cd /path/to/your/projects
mkdir BlockChain_Dapp
cd BlockChain_Dapp

# Initialize npm
npm init -y

# Install Hardhat
npm install --save-dev hardhat

# Initialize Hardhat project (choose TypeScript + Mocha + Ethers.js if prompted)
npx hardhat --init
```

Follow the prompts:

- Choose TypeScript Hardhat project using Mocha and Ethers.js.
- Accept ESM changes if asked.
- Install all recommended dependencies.

---

## 3. Add Your Smart Contracts

Copy your `.sol` files (e.g., `BankRegistry.sol`, `CreditDataLedger.sol`, `FraudReportLedger.sol`) into the `contracts/` folder.

Delete any sample contract (like `Lock.sol`) if present.

---

## 4. Compile Contracts

```bash
npx hardhat compile
```

Fix any errors if compilation fails.

---

## 5. Start Local Hardhat Node

Open a **new terminal window** and run:

```bash
npx hardhat node
```

- This starts a local blockchain at `http://127.0.0.1:8545`.
- You will see 20 test accounts with private keys and 10,000 ETH each.
- **Keep this terminal running!**

---

## 6. Deploy Contracts

Open another **new terminal window** (keep the node running) and run:

```bash
npx hardhat ignition deploy ignition/modules/deploy.ts --network localhost
```

- This deploys your contracts and prints their addresses.
- Save these addresses for frontend use.

---

## 7. Configure MetaMask

### Add Hardhat Network

1. Open MetaMask.
2. Click the network dropdown → "Add network" → "Add network manually".
3. Enter:
   - **Network Name:** Hardhat Local
   - **RPC URL:** http://127.0.0.1:8545
   - **Chain ID:** 31337
   - **Currency Symbol:** ETH
4. Click "Save".

### Import Test Account

1. In the terminal running `npx hardhat node`, copy any private key.
2. In MetaMask, click account icon → "Import Account".
3. Paste the private key and import.
4. You should see 10,000 ETH in this account.

---

## 8. Test the Frontend

1. Update contract addresses in your frontend (`index.html`) to match the latest deployed addresses.
2. Open `index.html` in your browser (use Live Server in VS Code or open directly).
3. Click "Connect MetaMask" and approve connection.
4. Use the UI to interact with your contracts:
   - Register banks (use random names/license numbers for testing).
   - Add and fetch credit data.
   - Report and fetch fraud incidents.

**Note:**  
If you restart the Hardhat node, you must redeploy contracts and re-import a fresh account in MetaMask.

---

## 9. Useful Hardhat Commands

- **Compile contracts:**  
  `npx hardhat compile`
- **Start local node:**  
  `npx hardhat node`
- **Deploy contracts:**  
  `npx hardhat ignition deploy ignition/modules/deploy.ts --network localhost`
- **Open Hardhat console:**  
  `npx hardhat console --network localhost`
- **Run scripts:**  
  `npx hardhat run scripts/yourScript.ts --network localhost`
- **Run tests:**  
  `npx hardhat test`

---

## 10. Troubleshooting

- **MetaMask not connecting:**

  - Ensure Hardhat node is running.
  - Check RPC URL and Chain ID.
  - Refresh MetaMask and browser.

- **Contract errors:**

  - Make sure contract addresses and ABIs are correct.
  - Redeploy contracts after node restart.

- **Account issues:**
  - Always import a fresh private key after restarting the node.

---

## 11. Next Steps

- Write automated tests in the `test/` folder.
- Build a React frontend for better UX.
- Deploy to a public testnet (e.g., Sepolia) by updating `hardhat.config.ts`.

---

**If you follow these steps, you will be able to set up, deploy, and test your Dapp from scratch.**
