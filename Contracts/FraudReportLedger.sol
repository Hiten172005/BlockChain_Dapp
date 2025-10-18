// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBankRegistry {
    function isBankRegistered(address _bankAddress) external view returns (bool);
}

contract FraudReportLedger {
    // --- State Variables ---

    address public bankRegistryAddress;

    struct Report {
        uint256 reportId;
        // NEW: The address of the customer involved in the fraud.
        address customerAddress; 
        string reportDetails;
        address reportingBank;
        uint256 timestamp;
    }

    mapping(uint256 => Report) public reports;
    uint256 public reportCounter;

    // NEW: A mapping to link a customer's address to a list of their fraud report IDs.
    mapping(address => uint256[]) public customerFraudReportIds;

    // --- Events ---

    event ReportSubmitted(
        uint256 indexed reportId, 
        address indexed customerAddress, 
        address indexed bankAddress
    );

    // --- Constructor ---
    constructor(address _bankRegistryAddress) {
        require(_bankRegistryAddress != address(0), "Invalid registry address");
        bankRegistryAddress = _bankRegistryAddress;
    }

    // --- Functions ---

    /**
     * @notice Allows a registered bank to submit a new fraud report LINKED to a customer.
     * @param _customerAddress The wallet address of the customer involved.
     * @param _reportDetails A string containing the details of the fraud.
     */
    function submitReport(address _customerAddress, string memory _reportDetails) external {
        require(
            IBankRegistry(bankRegistryAddress).isBankRegistered(msg.sender),
            "Caller is not a registered bank"
        );
        require(_customerAddress != address(0), "Invalid customer address");

        reportCounter++;
        
        // Save the full report in the main mapping
        reports[reportCounter] = Report(
            reportCounter,
            _customerAddress,
            _reportDetails,
            msg.sender,
            block.timestamp
        );

        // NEW: Add the new report ID to the customer's personal list of reports.
        customerFraudReportIds[_customerAddress].push(reportCounter);

        emit ReportSubmitted(reportCounter, _customerAddress, msg.sender);
    }
    
    /**
     * @notice Retrieves all fraud reports associated with a specific customer.
     * @param _customerAddress The address of the customer to look up.
     * @return An array of Report structs.
     */
    function getReportsForCustomer(address _customerAddress) external view returns (Report[] memory) {
        // Get the list of IDs for this customer
        uint256[] memory reportIds = customerFraudReportIds[_customerAddress];
        
        // Create a new array in memory to store the full report details
        Report[] memory customerReports = new Report[](reportIds.length);

        // Loop through the IDs and fetch the full report for each one
        for (uint i = 0; i < reportIds.length; i++) {
            customerReports[i] = reports[reportIds[i]];
        }

        return customerReports;
    }
}