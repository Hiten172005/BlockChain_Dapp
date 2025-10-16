// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IBankRegistry
 * @notice This is an interface to interact with the BankRegistry contract.
 * It defines the function we need to call without needing the full source code.
 */
interface IBankRegistry {
    function isBankRegistered(address _bankAddress) external view returns (bool);
}

/**
 * @title FraudReportLedger
 * @author Divij (with Gemini)
 * @notice This contract stores fraud reports submitted by authorized banks.
 * It relies on the BankRegistry contract to verify the identity of the reporter.
 */
contract FraudReportLedger {
    // --- State Variables ---

    address public bankRegistryAddress;

    struct Report {
        uint256 reportId;
        string reportDetails; // In a real system, this would be an IPFS hash
        address reportingBank;
        uint256 timestamp;
    }

    mapping(uint256 => Report) public reports;
    uint256 public reportCounter;

    // --- Events ---

    /**
     * @notice Emitted when a new fraud report is successfully submitted.
     * @param reportId The unique ID of the new report.
     * @param bankAddress The address of the bank that submitted the report.
     */
    event ReportSubmitted(uint256 indexed reportId, address indexed bankAddress);

    // --- Constructor ---

    /**
     * @notice The constructor takes the address of the already deployed BankRegistry contract.
     * This links the two contracts together.
     * @param _bankRegistryAddress The address of the BankRegistry contract.
     */
    constructor(address _bankRegistryAddress) {
        require(_bankRegistryAddress != address(0), "Invalid registry address");
        bankRegistryAddress = _bankRegistryAddress;
    }

    // --- Functions ---

    /**
     * @notice Allows a registered bank to submit a new fraud report.
     * @param _reportDetails A string containing the details of the fraud.
     */
    function submitReport(string memory _reportDetails) external {
        // This is the CRITICAL step:
        // It calls the isBankRegistered function on the BankRegistry contract.
        require(
            IBankRegistry(bankRegistryAddress).isBankRegistered(msg.sender),
            "Caller is not a registered bank"
        );

        reportCounter++;
        
        reports[reportCounter] = Report(
            reportCounter,
            _reportDetails,
            msg.sender,
            block.timestamp
        );

        emit ReportSubmitted(reportCounter, msg.sender);
    }
}