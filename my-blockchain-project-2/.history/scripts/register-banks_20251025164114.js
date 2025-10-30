import hre from "hardhat";
import { ethers } from "ethers";

async function main() {
  console.log("🏦 Registering Banks...\n");

  // Get deployed contract address
  const BANK_REGISTRY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  // Connect to local provider
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  
  // Create wallets with private keys
  const owner = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
  const bankA = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", provider);
  const bankB = new ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", provider);
  const bankC = new ethers.Wallet("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", provider);
  const customer = new ethers.Wallet("0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", provider);

  console.log("👤 Accounts:");
  console.log("Owner:", owner.address);
  console.log("Bank A:", bankA.address);
  console.log("Bank B:", bankB.address);
  console.log("Bank C:", bankC.address);
  console.log("Customer:", customer.address);
  console.log("\n");

  // Get BankRegistry contract
  const BankRegistry = await hre.ethers.getContractFactory("BankRegistry");
  const bankRegistry = BankRegistry.attach(BANK_REGISTRY_ADDRESS);

  // Register Bank A
  console.log("📝 Registering Bank A...");
  const tx1 = await bankRegistry.registerBank(bankA.address);
  await tx1.wait();
  console.log("✅ Bank A registered:", bankA.address);

  // Register Bank B
  console.log("📝 Registering Bank B...");
  const tx2 = await bankRegistry.registerBank(bankB.address);
  await tx2.wait();
  console.log("✅ Bank B registered:", bankB.address);

  // Register Bank C
  console.log("📝 Registering Bank C...");
  const tx3 = await bankRegistry.registerBank(bankC.address);
  await tx3.wait();
  console.log("✅ Bank C registered:", bankC.address);

  console.log("\n");

  // Verify registrations
  console.log("🔍 Verifying registrations...");
  const isARegistered = await bankRegistry.isBankRegistered(bankA.address);
  const isBRegistered = await bankRegistry.isBankRegistered(bankB.address);
  const isCRegistered = await bankRegistry.isBankRegistered(bankC.address);
  const isCustomerRegistered = await bankRegistry.isBankRegistered(customer.address);

  console.log("Bank A registered?", isARegistered ? "✅ YES" : "❌ NO");
  console.log("Bank B registered?", isBRegistered ? "✅ YES" : "❌ NO");
  console.log("Bank C registered?", isCRegistered ? "✅ YES" : "❌ NO");
  console.log("Customer registered?", isCustomerRegistered ? "❌ NO (correct)" : "✅ YES");

  console.log("\n");
  console.log("🎉 All banks registered successfully!");
  console.log("\n📋 Summary:");
  console.log("   Contract Addresses:");
  console.log("   - BankRegistry:", BANK_REGISTRY_ADDRESS);
  console.log("   - CreditDataLedger: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
  console.log("   - FraudReportLedger: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0");
  console.log("\n");
  console.log("   Registered Banks:");
  console.log("   - Bank A:", bankA.address);
  console.log("   - Bank B:", bankB.address);
  console.log("   - Bank C:", bankC.address);
  console.log("\n");
  console.log("✅ You can now use these accounts to test the fraud reporting system!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
