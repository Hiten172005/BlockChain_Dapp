import { expect } from "chai";
import { ethers } from "hardhat";
import { BankRegistry, FraudReportLedger } from "../typechain-types";
import { Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("FraudReportLedger - Staking & Validation System", function () {
  let bankRegistry: BankRegistry;
  let fraudReportLedger: FraudReportLedger;
  let owner: Signer;
  let bank1: Signer;
  let bank2: Signer;
  let bank3: Signer;
  let bank4: Signer;
  let customer1: Signer;

  let bank1Address: string;
  let bank2Address: string;
  let bank3Address: string;
  let bank4Address: string;
  let customer1Address: string;

  const validCID = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
  const REPORTER_STAKE = ethers.parseEther("0.05");
  const VALIDATOR_STAKE = ethers.parseEther("0.01");
  const LOCK_PERIOD = 48 * 60 * 60; // 48 hours in seconds

  beforeEach(async function () {
    [owner, bank1, bank2, bank3, bank4, customer1] = await ethers.getSigners();
    
    bank1Address = await bank1.getAddress();
    bank2Address = await bank2.getAddress();
    bank3Address = await bank3.getAddress();
    bank4Address = await bank4.getAddress();
    customer1Address = await customer1.getAddress();

    // Deploy BankRegistry
    const BankRegistryFactory = await ethers.getContractFactory("BankRegistry");
    bankRegistry = await BankRegistryFactory.deploy();
    await bankRegistry.waitForDeployment();

    // Deploy FraudReportLedger
    const FraudReportLedgerFactory = await ethers.getContractFactory("FraudReportLedger");
    fraudReportLedger = await FraudReportLedgerFactory.deploy(await bankRegistry.getAddress());
    await fraudReportLedger.waitForDeployment();

    // Register all banks
    await bankRegistry.registerBank(bank1Address);
    await bankRegistry.registerBank(bank2Address);
    await bankRegistry.registerBank(bank3Address);
    await bankRegistry.registerBank(bank4Address);
  });

  describe("📤 Report Submission with Staking", function () {
    it("✅ Should accept report with correct stake amount", async function () {
      const tx = await fraudReportLedger.connect(bank1).submitReport(
        customer1Address,
        validCID,
        { value: REPORTER_STAKE }
      );

      await expect(tx)
        .to.emit(fraudReportLedger, "ReportSubmitted")
        .withArgs(1, customer1Address, bank1Address, validCID, REPORTER_STAKE);

      const report = await fraudReportLedger.getReport(1);
      expect(report.reporterStake).to.equal(REPORTER_STAKE);
      expect(report.status).to.equal(0); // PENDING
      expect(report.isFinalized).to.be.false;
    });

    it("❌ Should reject report with insufficient stake", async function () {
      await expect(
        fraudReportLedger.connect(bank1).submitReport(
          customer1Address,
          validCID,
          { value: ethers.parseEther("0.01") }
        )
      ).to.be.revertedWith("Insufficient stake amount");
    });

    it("✅ Should set correct finalize time (48 hours)", async function () {
      const txTime = await time.latest();
      
      await fraudReportLedger.connect(bank1).submitReport(
        customer1Address,
        validCID,
        { value: REPORTER_STAKE }
      );

      const report = await fraudReportLedger.getReport(1);
      const expectedFinalizeTime = txTime + LOCK_PERIOD + 1; // +1 for block time
      
      expect(Number(report.finalizeTime)).to.be.closeTo(expectedFinalizeTime, 5);
    });

    it("✅ Should accept extra stake amount", async function () {
      const extraStake = ethers.parseEther("0.1");
      
      await fraudReportLedger.connect(bank1).submitReport(
        customer1Address,
        validCID,
        { value: extraStake }
      );

      const report = await fraudReportLedger.getReport(1);
      expect(report.reporterStake).to.equal(extraStake);
    });
  });

  describe("🗳️ Validation & Voting System", function () {
    beforeEach(async function () {
      // Submit a report first
      await fraudReportLedger.connect(bank1).submitReport(
        customer1Address,
        validCID,
        { value: REPORTER_STAKE }
      );
    });

    it("✅ Should accept validation with correct stake", async function () {
      const tx = await fraudReportLedger.connect(bank2).validateReport(
        1,
        0, // APPROVE
        { value: VALIDATOR_STAKE }
      );

      await expect(tx)
        .to.emit(fraudReportLedger, "ReportValidated")
        .withArgs(1, bank2Address, 0, VALIDATOR_STAKE);

      expect(await fraudReportLedger.hasVoted(1, bank2Address)).to.be.true;
    });

    it("❌ Should reject validation with insufficient stake", async function () {
      await expect(
        fraudReportLedger.connect(bank2).validateReport(
          1,
          0,
          { value: ethers.parseEther("0.005") }
        )
      ).to.be.revertedWith("Insufficient stake amount");
    });

    it("❌ Should prevent double voting", async function () {
      await fraudReportLedger.connect(bank2).validateReport(
        1,
        0,
        { value: VALIDATOR_STAKE }
      );

      await expect(
        fraudReportLedger.connect(bank2).validateReport(
          1,
          1, // DISPUTE
          { value: VALIDATOR_STAKE }
        )
      ).to.be.revertedWith("Already voted on this report");
    });

    it("❌ Should prevent reporter from validating own report", async function () {
      await expect(
        fraudReportLedger.connect(bank1).validateReport(
          1,
          0,
          { value: VALIDATOR_STAKE }
        )
      ).to.be.revertedWith("Cannot validate own report");
    });

    it("✅ Should allow multiple validators", async function () {
      await fraudReportLedger.connect(bank2).validateReport(1, 0, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank3).validateReport(1, 0, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank4).validateReport(1, 1, { value: VALIDATOR_STAKE });

      const [approveCount, disputeCount] = await fraudReportLedger.getVoteCounts(1);
      expect(approveCount).to.equal(2);
      expect(disputeCount).to.equal(1);
    });

    it("❌ Should prevent validation after voting period", async function () {
      // Fast forward 48+ hours
      await time.increase(LOCK_PERIOD + 1);

      await expect(
        fraudReportLedger.connect(bank2).validateReport(
          1,
          0,
          { value: VALIDATOR_STAKE }
        )
      ).to.be.revertedWith("Voting period ended");
    });

    it("✅ Should track validations correctly", async function () {
      await fraudReportLedger.connect(bank2).validateReport(1, 0, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank3).validateReport(1, 1, { value: VALIDATOR_STAKE });

      const validations = await fraudReportLedger.getReportValidations(1);
      expect(validations.length).to.equal(2);
      expect(validations[0].validator).to.equal(bank2Address);
      expect(validations[0].vote).to.equal(0); // APPROVE
      expect(validations[1].validator).to.equal(bank3Address);
      expect(validations[1].vote).to.equal(1); // DISPUTE
    });
  });

  describe("⏰ Finalization & Time Lock", function () {
    beforeEach(async function () {
      await fraudReportLedger.connect(bank1).submitReport(
        customer1Address,
        validCID,
        { value: REPORTER_STAKE }
      );
    });

    it("❌ Should prevent finalization before lock period", async function () {
      await expect(
        fraudReportLedger.finalizeReport(1)
      ).to.be.revertedWith("Lock period not over");
    });

    it("✅ Should allow finalization after lock period", async function () {
      await time.increase(LOCK_PERIOD + 1);

      await expect(fraudReportLedger.finalizeReport(1))
        .to.emit(fraudReportLedger, "ReportFinalized");

      const report = await fraudReportLedger.getReport(1);
      expect(report.isFinalized).to.be.true;
    });

    it("❌ Should prevent double finalization", async function () {
      await time.increase(LOCK_PERIOD + 1);
      await fraudReportLedger.finalizeReport(1);

      await expect(
        fraudReportLedger.finalizeReport(1)
      ).to.be.revertedWith("Report already finalized");
    });

    it("✅ Should set APPROVED status when majority votes approve", async function () {
      await fraudReportLedger.connect(bank2).validateReport(1, 0, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank3).validateReport(1, 0, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank4).validateReport(1, 1, { value: VALIDATOR_STAKE });

      await time.increase(LOCK_PERIOD + 1);
      await fraudReportLedger.finalizeReport(1);

      const report = await fraudReportLedger.getReport(1);
      expect(report.status).to.equal(1); // APPROVED
    });

    it("✅ Should set DISPUTED status when majority votes dispute", async function () {
      await fraudReportLedger.connect(bank2).validateReport(1, 1, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank3).validateReport(1, 1, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank4).validateReport(1, 0, { value: VALIDATOR_STAKE });

      await time.increase(LOCK_PERIOD + 1);
      await fraudReportLedger.finalizeReport(1);

      const report = await fraudReportLedger.getReport(1);
      expect(report.status).to.equal(2); // DISPUTED
    });

    it("✅ Should set DISPUTED on tie", async function () {
      await fraudReportLedger.connect(bank2).validateReport(1, 0, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank3).validateReport(1, 1, { value: VALIDATOR_STAKE });

      await time.increase(LOCK_PERIOD + 1);
      await fraudReportLedger.finalizeReport(1);

      const report = await fraudReportLedger.getReport(1);
      expect(report.status).to.equal(2); // DISPUTED (tie goes to DISPUTED)
    });
  });

  describe("💰 Stake Distribution & Rewards", function () {
    it("✅ Should return reporter stake if approved", async function () {
      await fraudReportLedger.connect(bank1).submitReport(
        customer1Address,
        validCID,
        { value: REPORTER_STAKE }
      );

      const bank1BalanceBefore = await ethers.provider.getBalance(bank1Address);

      // 2 approve, 1 dispute
      await fraudReportLedger.connect(bank2).validateReport(1, 0, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank3).validateReport(1, 0, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank4).validateReport(1, 1, { value: VALIDATOR_STAKE });

      await time.increase(LOCK_PERIOD + 1);
      await fraudReportLedger.finalizeReport(1);

      const bank1BalanceAfter = await ethers.provider.getBalance(bank1Address);
      expect(bank1BalanceAfter).to.be.greaterThan(bank1BalanceBefore);
    });

    it("✅ Should NOT return reporter stake if disputed", async function () {
      await fraudReportLedger.connect(bank1).submitReport(
        customer1Address,
        validCID,
        { value: REPORTER_STAKE }
      );

      const bank1BalanceBefore = await ethers.provider.getBalance(bank1Address);

      // 1 approve, 2 dispute
      await fraudReportLedger.connect(bank2).validateReport(1, 1, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank3).validateReport(1, 1, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank4).validateReport(1, 0, { value: VALIDATOR_STAKE });

      await time.increase(LOCK_PERIOD + 1);
      await fraudReportLedger.finalizeReport(1);

      const bank1BalanceAfter = await ethers.provider.getBalance(bank1Address);
      // Should not increase (reporter was wrong)
      expect(bank1BalanceAfter).to.equal(bank1BalanceBefore);
    });

    it("✅ Should distribute loser stakes to winners", async function () {
      await fraudReportLedger.connect(bank1).submitReport(
        customer1Address,
        validCID,
        { value: REPORTER_STAKE }
      );

      const bank2BalanceBefore = await ethers.provider.getBalance(bank2Address);

      // Bank2 and Bank3 vote correctly (APPROVE), Bank4 votes incorrectly (DISPUTE)
      await fraudReportLedger.connect(bank2).validateReport(1, 0, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank3).validateReport(1, 0, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank4).validateReport(1, 1, { value: VALIDATOR_STAKE });

      await time.increase(LOCK_PERIOD + 1);
      await fraudReportLedger.finalizeReport(1);

      const bank2BalanceAfter = await ethers.provider.getBalance(bank2Address);
      
      // Bank2 should get: stake back + share of bank4's stake
      const expectedMinIncrease = VALIDATOR_STAKE; // At least stake back
      expect(bank2BalanceAfter).to.be.greaterThan(bank2BalanceBefore + expectedMinIncrease);
    });

    it("✅ Should track rewards earned correctly", async function () {
      await fraudReportLedger.connect(bank1).submitReport(
        customer1Address,
        validCID,
        { value: REPORTER_STAKE }
      );

      await fraudReportLedger.connect(bank2).validateReport(1, 0, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank3).validateReport(1, 1, { value: VALIDATOR_STAKE });

      await time.increase(LOCK_PERIOD + 1);
      await fraudReportLedger.finalizeReport(1);

      const [, , rewardsEarned] = await fraudReportLedger.getBankStats(bank2Address);
      expect(rewardsEarned).to.be.greaterThan(0);
    });

    it("✅ Should track stakes lost correctly", async function () {
      await fraudReportLedger.connect(bank1).submitReport(
        customer1Address,
        validCID,
        { value: REPORTER_STAKE }
      );

      await fraudReportLedger.connect(bank2).validateReport(1, 0, { value: VALIDATOR_STAKE });
      await fraudReportLedger.connect(bank3).validateReport(1, 1, { value: VALIDATOR_STAKE });

      await time.increase(LOCK_PERIOD + 1);
      await fraudReportLedger.finalizeReport(1);

      const [, , , stakesLost] = await fraudReportLedger.getBankStats(bank3Address);
      expect(stakesLost).to.equal(VALIDATOR_STAKE);
    });
  });

  describe("📊 Helper Functions & Queries", function () {
    beforeEach(async function () {
      // Create multiple reports in different states
      await fraudReportLedger.connect(bank1).submitReport(customer1Address, validCID, { value: REPORTER_STAKE });
      await fraudReportLedger.connect(bank2).submitReport(customer1Address, validCID, { value: REPORTER_STAKE });
    });

    it("✅ Should return pending reports", async function () {
      const pending = await fraudReportLedger.getPendingReports();
      expect(pending.length).to.equal(2);
      expect(pending[0]).to.equal(1);
      expect(pending[1]).to.equal(2);
    });

    it("✅ Should return finalizable reports", async function () {
      await time.increase(LOCK_PERIOD + 1);
      
      const finalizable = await fraudReportLedger.getFinalizableReports();
      expect(finalizable.length).to.equal(2);
    });

    it("✅ Should correctly check if report can be finalized", async function () {
      expect(await fraudReportLedger.canFinalize(1)).to.be.false;
      
      await time.increase(LOCK_PERIOD + 1);
      
      expect(await fraudReportLedger.canFinalize(1)).to.be.true;
    });

    it("✅ Should calculate fraud score correctly", async function () {
      // 0 reports = score 100
      expect(await fraudReportLedger.getFraudScore(bank4Address)).to.equal(100);
      
      // 2 reports = score 55
      expect(await fraudReportLedger.getFraudScore(customer1Address)).to.equal(55);
    });

    it("✅ Should return bank statistics", async function () {
      const [reportsSubmitted, validationsMade, rewardsEarned, stakesLost] = 
        await fraudReportLedger.getBankStats(bank1Address);
      
      expect(reportsSubmitted).to.equal(1);
      expect(validationsMade).to.equal(0);
    });
  });
});
