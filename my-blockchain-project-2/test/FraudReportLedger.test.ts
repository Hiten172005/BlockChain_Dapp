import { expect } from "chai";
import { ethers } from "hardhat";
import { BankRegistry, FraudReportLedger } from "../typechain-types";
import { Signer } from "ethers";

describe("FraudReportLedger - IPFS Evidence Upload Tests", function () {
  let bankRegistry: BankRegistry;
  let fraudReportLedger: FraudReportLedger;
  let owner: Signer;
  let bank1: Signer;
  let bank2: Signer;
  let customer1: Signer;
  let customer2: Signer;

  let ownerAddress: string;
  let bank1Address: string;
  let bank2Address: string;
  let customer1Address: string;
  let customer2Address: string;

  // Sample IPFS CIDs (valid format)
  const validCID1 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"; // CIDv0
  const validCID2 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"; // CIDv1
  const validCID3 = "QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX"; // Another CIDv0
  const invalidCID = "invalid"; // Too short

  beforeEach(async function () {
    // Get signers
    [owner, bank1, bank2, customer1, customer2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    bank1Address = await bank1.getAddress();
    bank2Address = await bank2.getAddress();
    customer1Address = await customer1.getAddress();
    customer2Address = await customer2.getAddress();

    // Deploy BankRegistry
    const BankRegistryFactory = await ethers.getContractFactory("BankRegistry");
    bankRegistry = await BankRegistryFactory.deploy();
    await bankRegistry.waitForDeployment();

    // Deploy FraudReportLedger
    const FraudReportLedgerFactory = await ethers.getContractFactory("FraudReportLedger");
    fraudReportLedger = await FraudReportLedgerFactory.deploy(await bankRegistry.getAddress());
    await fraudReportLedger.waitForDeployment();

    // Register banks
    await bankRegistry.registerBank(bank1Address);
    await bankRegistry.registerBank(bank2Address);
  });

  describe("📤 Evidence Upload - Submit Report Functionality", function () {
    it("✅ Should successfully submit a report with valid IPFS CID (CIDv0)", async function () {
      const tx = await fraudReportLedger.connect(bank1).submitReport(customer1Address, validCID1);
      await tx.wait();

      const reportCount = await fraudReportLedger.reportCounter();
      expect(reportCount).to.equal(1);

      const report = await fraudReportLedger.getReport(1);
      expect(report.customerAddress).to.equal(customer1Address);
      expect(report.ipfsCID).to.equal(validCID1);
      expect(report.reportingBank).to.equal(bank1Address);
    });

    it("✅ Should successfully submit a report with valid IPFS CID (CIDv1)", async function () {
      const tx = await fraudReportLedger.connect(bank1).submitReport(customer1Address, validCID2);
      await tx.wait();

      const report = await fraudReportLedger.getReport(1);
      expect(report.ipfsCID).to.equal(validCID2);
    });

    it("✅ Should emit ReportSubmitted event with correct IPFS CID", async function () {
      await expect(fraudReportLedger.connect(bank1).submitReport(customer1Address, validCID1))
        .to.emit(fraudReportLedger, "ReportSubmitted")
        .withArgs(1, customer1Address, bank1Address, validCID1);
    });

    it("❌ Should reject empty IPFS CID", async function () {
      await expect(
        fraudReportLedger.connect(bank1).submitReport(customer1Address, "")
      ).to.be.revertedWith("IPFS CID cannot be empty");
    });

    it("❌ Should reject invalid IPFS CID (too short)", async function () {
      await expect(
        fraudReportLedger.connect(bank1).submitReport(customer1Address, invalidCID)
      ).to.be.revertedWith("Invalid IPFS CID format");
    });

    it("❌ Should reject if caller is not a registered bank", async function () {
      await expect(
        fraudReportLedger.connect(customer1).submitReport(customer2Address, validCID1)
      ).to.be.revertedWith("Caller is not a registered bank");
    });

    it("❌ Should reject if customer address is zero address", async function () {
      await expect(
        fraudReportLedger.connect(bank1).submitReport(ethers.ZeroAddress, validCID1)
      ).to.be.revertedWith("Invalid customer address");
    });
  });

  describe("📊 Multiple Reports - Evidence Tracking", function () {
    it("✅ Should allow multiple reports for the same customer", async function () {
      await fraudReportLedger.connect(bank1).submitReport(customer1Address, validCID1);
      await fraudReportLedger.connect(bank2).submitReport(customer1Address, validCID2);
      await fraudReportLedger.connect(bank1).submitReport(customer1Address, validCID3);

      const reportCount = await fraudReportLedger.getReportCount(customer1Address);
      expect(reportCount).to.equal(3);

      const reports = await fraudReportLedger.getReportsForCustomer(customer1Address);
      expect(reports.length).to.equal(3);
      expect(reports[0].ipfsCID).to.equal(validCID1);
      expect(reports[1].ipfsCID).to.equal(validCID2);
      expect(reports[2].ipfsCID).to.equal(validCID3);
    });

    it("✅ Should track reports for different customers separately", async function () {
      await fraudReportLedger.connect(bank1).submitReport(customer1Address, validCID1);
      await fraudReportLedger.connect(bank1).submitReport(customer2Address, validCID2);

      const customer1Reports = await fraudReportLedger.getReportCount(customer1Address);
      const customer2Reports = await fraudReportLedger.getReportCount(customer2Address);

      expect(customer1Reports).to.equal(1);
      expect(customer2Reports).to.equal(1);
    });

    it("✅ Should return correct report IDs for a customer", async function () {
      await fraudReportLedger.connect(bank1).submitReport(customer1Address, validCID1);
      await fraudReportLedger.connect(bank2).submitReport(customer2Address, validCID2);
      await fraudReportLedger.connect(bank1).submitReport(customer1Address, validCID3);

      const reportIds = await fraudReportLedger.getReportIds(customer1Address);
      expect(reportIds.length).to.equal(2);
      expect(reportIds[0]).to.equal(1);
      expect(reportIds[1]).to.equal(3);
    });
  });

  describe("🔍 Query Reports - Evidence Retrieval", function () {
    beforeEach(async function () {
      // Setup: Add some reports
      await fraudReportLedger.connect(bank1).submitReport(customer1Address, validCID1);
      await fraudReportLedger.connect(bank2).submitReport(customer1Address, validCID2);
    });

    it("✅ Should retrieve report by ID with correct IPFS CID", async function () {
      const report = await fraudReportLedger.getReport(1);
      expect(report.reportId).to.equal(1);
      expect(report.ipfsCID).to.equal(validCID1);
      expect(report.reportingBank).to.equal(bank1Address);
    });

    it("✅ Should retrieve all reports for a customer", async function () {
      const reports = await fraudReportLedger.getReportsForCustomer(customer1Address);
      expect(reports.length).to.equal(2);
      expect(reports[0].ipfsCID).to.equal(validCID1);
      expect(reports[1].ipfsCID).to.equal(validCID2);
    });

    it("✅ Should return empty array for customer with no reports", async function () {
      const reports = await fraudReportLedger.getReportsForCustomer(customer2Address);
      expect(reports.length).to.equal(0);
    });

    it("❌ Should revert when querying invalid report ID", async function () {
      await expect(fraudReportLedger.getReport(999)).to.be.revertedWith("Invalid report ID");
    });

    it("❌ Should revert when querying report ID 0", async function () {
      await expect(fraudReportLedger.getReport(0)).to.be.revertedWith("Invalid report ID");
    });
  });

  describe("⏰ Timestamp Tracking", function () {
    it("✅ Should store correct timestamp for each report", async function () {
      const tx = await fraudReportLedger.connect(bank1).submitReport(customer1Address, validCID1);
      const receipt = await tx.wait();
      
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      const report = await fraudReportLedger.getReport(1);
      
      expect(report.timestamp).to.equal(block!.timestamp);
    });

    it("✅ Should have different timestamps for reports submitted in different blocks", async function () {
      await fraudReportLedger.connect(bank1).submitReport(customer1Address, validCID1);
      
      // Mine a new block
      await ethers.provider.send("evm_mine", []);
      
      await fraudReportLedger.connect(bank2).submitReport(customer1Address, validCID2);
      
      const report1 = await fraudReportLedger.getReport(1);
      const report2 = await fraudReportLedger.getReport(2);
      
      expect(Number(report2.timestamp)).to.be.greaterThan(Number(report1.timestamp));
    });
  });

  describe("📈 Counter Management", function () {
    it("✅ Should increment report counter correctly", async function () {
      expect(await fraudReportLedger.reportCounter()).to.equal(0);
      
      await fraudReportLedger.connect(bank1).submitReport(customer1Address, validCID1);
      expect(await fraudReportLedger.reportCounter()).to.equal(1);
      
      await fraudReportLedger.connect(bank1).submitReport(customer2Address, validCID2);
      expect(await fraudReportLedger.reportCounter()).to.equal(2);
      
      await fraudReportLedger.connect(bank2).submitReport(customer1Address, validCID3);
      expect(await fraudReportLedger.reportCounter()).to.equal(3);
    });
  });

  describe("🔗 IPFS CID Format Examples", function () {
    it("✅ Should accept various valid IPFS CID formats", async function () {
      const cidExamples = [
        "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG", // CIDv0 (Base58)
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", // CIDv1 (Base32)
        "QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX", // CIDv0
        "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku", // CIDv1 (shorter)
      ];

      for (let i = 0; i < cidExamples.length; i++) {
        await fraudReportLedger.connect(bank1).submitReport(customer1Address, cidExamples[i]);
        const report = await fraudReportLedger.getReport(i + 1);
        expect(report.ipfsCID).to.equal(cidExamples[i]);
      }
    });
  });
});
