import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DeployModule = buildModule("DeployModule", (m) => {
  // Deploy BankRegistry first
  const bankRegistry = m.contract("BankRegistry");

  // Deploy CreditDataLedger with BankRegistry address
  const creditDataLedger = m.contract("CreditDataLedger", [bankRegistry]);

  // Deploy FraudReportLedger with BankRegistry address
  const fraudReportLedger = m.contract("FraudReportLedger", [bankRegistry]);

  return { bankRegistry, creditDataLedger, fraudReportLedger };
});

export default DeployModule;