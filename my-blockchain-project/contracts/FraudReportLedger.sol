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
        address customerAddress; 
        string ipfsCID; // CHANGED: This string is now an IPFS Content ID (CID)
        address reportingBank;
        uint256 timestamp;
    }

    mapping(uint256 => Report) public reports;
    uint256 public reportCounter;
    mapping(address => uint256[]) public customerFraudReportIds;

    // --- Events ---

    event ReportSubmitted(
        uint256 indexed reportId, 
        address indexed customerAddress, 
        address indexed bankAddress,
        string ipfsCID
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
     * @param _ipfsCID The IPFS Content ID (CID) of the evidence file.
     */
    function submitReport(address _customerAddress, string memory _ipfsCID) external {
        require(
            IBankRegistry(bankRegistryAddress).isBankRegistered(msg.sender),
            "Caller is not a registered bank"
        );
        require(_customerAddress != address(0), "Invalid customer address");

        reportCounter++;
        
        reports[reportCounter] = Report(
            reportCounter,
            _customerAddress,
            _ipfsCID,
            msg.sender,
            block.timestamp
        );

        customerFraudReportIds[_customerAddress].push(reportCounter);

        emit ReportSubmitted(reportCounter, _customerAddress, msg.sender, _ipfsCID);
    }
    
    /**
     * @notice Retrieves all fraud reports associated with a specific customer.
     */
    function getReportsForCustomer(address _customerAddress) external view returns (Report[] memory) {
        uint256[] memory reportIds = customerFraudReportIds[_customerAddress];
        Report[] memory customerReports = new Report[](reportIds.length);

        for (uint i = 0; i < reportIds.length; i++) {
            customerReports[i] = reports[reportIds[i]];
        }

        return customerReports;
    }
}
