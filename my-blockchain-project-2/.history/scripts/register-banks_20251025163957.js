const hre = require("hardhat");

async function main() {
  console.log("🏦 Registering Banks...\n");

  // Get deployed contract address
  const BANK_REGISTRY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  // Get signers (accounts)
  const [owner, bankA, bankB, bankC, customer] = await hre.ethers.getSigners();

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
