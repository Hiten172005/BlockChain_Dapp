// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBankRegistry {
    function isBankRegistered(address _bankAddress) external view returns (bool);
}

contract FraudReportLedger {
    // --- Enums ---
    enum ReportStatus { PENDING, APPROVED, DISPUTED, FINALIZED }
    enum VoteType { APPROVE, DISPUTE }

    // --- State Variables ---
    address public bankRegistryAddress;

    // Staking and Fee amounts
    uint256 public constant REPORTER_STAKE = 0.05 ether;
    uint256 public constant VALIDATOR_STAKE = 0.01 ether;
    uint256 public constant LOCK_PERIOD = 48 hours;
    uint256 public constant SCORE_QUERY_FEE = 0.0001 ether;
    uint256 public constant REPORT_PURCHASE_FEE_PER_REPORT = 0.0005 ether;

    // --- Structs ---
    struct Report {
        uint256 reportId;
        address customerAddress; 
        string ipfsCID;
        address reportingBank;
        uint256 timestamp;
        uint256 reporterStake;        // Amount staked by reporter
        uint256 finalizeTime;         // When voting ends (timestamp + 48 hours)
        ReportStatus status;          // Current status
        bool isFinalized;             // Has voting ended?
    }

    struct Validation {
        address validator;
        uint256 stake;
        VoteType vote;
        uint256 timestamp;
    }

    // --- Mappings ---
    mapping(uint256 => Report) public reports;
    uint256 public reportCounter;
    mapping(address => uint256[]) public customerFraudReportIds;
    
    // Validation tracking
    mapping(uint256 => Validation[]) public reportValidations;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    // Stats tracking
    mapping(address => uint256) public bankRewardsEarned;
    mapping(address => uint256) public bankStakesLost;
    uint256 public accumulatedFees;
    address public owner;

    // --- Events ---
    event ReportSubmitted(
        uint256 indexed reportId, 
        address indexed customerAddress, 
        address indexed bankAddress,
        string ipfsCID,
        uint256 stake
    );

    event ReportValidated(
        uint256 indexed reportId,
        address indexed validator,
        VoteType vote,
        uint256 stake
    );

    event ReportFinalized(
        uint256 indexed reportId,
        ReportStatus finalStatus,
        uint256 approveCount,
        uint256 disputeCount
    );

    event StakeReturned(
        address indexed recipient,
        uint256 amount
    );

    event RewardDistributed(
        address indexed recipient,
        uint256 amount
    );

    event FeesWithdrawn(address indexed owner, uint256 amount);

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    // --- Constructor ---
    constructor(address _bankRegistryAddress) {
        require(_bankRegistryAddress != address(0), "Invalid registry address");
        bankRegistryAddress = _bankRegistryAddress;
        owner = msg.sender;
    }

    // --- Functions ---

    /**
     * @notice Allows a registered bank to submit a new fraud report with staking.
     * @param _customerAddress The wallet address of the customer involved.
     * @param _ipfsCID The IPFS Content ID (CID) of the evidence file.
     */
    function submitReport(address _customerAddress, string memory _ipfsCID) external payable {
        require(
            IBankRegistry(bankRegistryAddress).isBankRegistered(msg.sender),
            "Caller is not a registered bank"
        );
        require(_customerAddress != address(0), "Invalid customer address");
        require(bytes(_ipfsCID).length > 0, "IPFS CID cannot be empty");
        require(bytes(_ipfsCID).length >= 46, "Invalid IPFS CID format");
        require(msg.value >= REPORTER_STAKE, "Insufficient stake amount");

        reportCounter++;
        
        reports[reportCounter] = Report({
            reportId: reportCounter,
            customerAddress: _customerAddress,
            ipfsCID: _ipfsCID,
            reportingBank: msg.sender,
            timestamp: block.timestamp,
            reporterStake: msg.value,
            finalizeTime: block.timestamp + LOCK_PERIOD,
            status: ReportStatus.PENDING,
            isFinalized: false
        });

        customerFraudReportIds[_customerAddress].push(reportCounter);

        emit ReportSubmitted(reportCounter, _customerAddress, msg.sender, _ipfsCID, msg.value);
    }

    /**
     * @notice Allows registered banks to validate a report by voting.
     * @param _reportId The ID of the report to validate.
     * @param _vote The vote (APPROVE or DISPUTE).
     */
    function validateReport(uint256 _reportId, VoteType _vote) external payable {
        require(
            IBankRegistry(bankRegistryAddress).isBankRegistered(msg.sender),
            "Caller is not a registered bank"
        );
        require(_reportId > 0 && _reportId <= reportCounter, "Invalid report ID");
        require(msg.value >= VALIDATOR_STAKE, "Insufficient stake amount");
        require(!hasVoted[_reportId][msg.sender], "Already voted on this report");

        Report storage report = reports[_reportId];
        require(!report.isFinalized, "Report already finalized");
        require(block.timestamp < report.finalizeTime, "Voting period ended");
        require(msg.sender != report.reportingBank, "Cannot validate own report");

        // Record validation
        reportValidations[_reportId].push(Validation({
            validator: msg.sender,
            stake: msg.value,
            vote: _vote,
            timestamp: block.timestamp
        }));

        hasVoted[_reportId][msg.sender] = true;

        emit ReportValidated(_reportId, msg.sender, _vote, msg.value);
    }

    /**
     * @notice Finalizes a report after the lock period and distributes stakes.
     * @param _reportId The ID of the report to finalize.
     */
    function finalizeReport(uint256 _reportId) external {
        require(_reportId > 0 && _reportId <= reportCounter, "Invalid report ID");
        
        Report storage report = reports[_reportId];
        require(!report.isFinalized, "Report already finalized");
        require(block.timestamp >= report.finalizeTime, "Lock period not over");

        // Count votes
        Validation[] storage validations = reportValidations[_reportId];
        uint256 approveCount = 0;
        uint256 disputeCount = 0;

        for (uint256 i = 0; i < validations.length; i++) {
            if (validations[i].vote == VoteType.APPROVE) {
                approveCount++;
            } else {
                disputeCount++;
            }
        }

        // Determine outcome (majority wins, tie goes to DISPUTED)
        bool approved = approveCount > disputeCount;
        report.status = approved ? ReportStatus.APPROVED : ReportStatus.DISPUTED;
        report.isFinalized = true;

        // Distribute stakes
        _distributeStakes(_reportId, approved);

        emit ReportFinalized(_reportId, report.status, approveCount, disputeCount);
    }

    /**
     * @notice Internal function to distribute stakes after finalization.
     * @param _reportId The report ID.
     * @param approved Whether the report was approved.
     */
    function _distributeStakes(uint256 _reportId, bool approved) internal {
        Report storage report = reports[_reportId];
        Validation[] storage validations = reportValidations[_reportId];

        uint256 totalLoserStakes = 0;
        uint256 winnerCount = 0;
        bool reporterIsWinner = approved; // Reporter wins if report is approved

        // First pass: identify winners/losers and calculate total loser stakes
        for (uint256 i = 0; i < validations.length; i++) {
            bool votedCorrectly = (approved && validations[i].vote == VoteType.APPROVE) ||
                                 (!approved && validations[i].vote == VoteType.DISPUTE);
            
            if (votedCorrectly) {
                winnerCount++;
            } else {
                totalLoserStakes += validations[i].stake;
                bankStakesLost[validations[i].validator] += validations[i].stake;
            }
        }

        // Handle reporter stake
        if (approved) {
            // Reporter was correct, count them as a winner for reward distribution
            winnerCount++;
        } else {
            // Reporter was wrong, add to loser pool
            totalLoserStakes += report.reporterStake;
            bankStakesLost[report.reportingBank] += report.reporterStake;
        }

        // Distribute rewards to winners
        if (winnerCount > 0 && totalLoserStakes > 0) {
            uint256 rewardPerWinner = totalLoserStakes / winnerCount;
            
            // Reward the reporting bank if they won
            if (reporterIsWinner) {
                uint256 reporterPayout = report.reporterStake + rewardPerWinner;
                payable(report.reportingBank).transfer(reporterPayout);
                bankRewardsEarned[report.reportingBank] += rewardPerWinner;
                
                emit StakeReturned(report.reportingBank, report.reporterStake);
                emit RewardDistributed(report.reportingBank, rewardPerWinner);
            }
            
            // Reward the validators who voted correctly
            for (uint256 i = 0; i < validations.length; i++) {
                bool votedCorrectly = (approved && validations[i].vote == VoteType.APPROVE) ||
                                     (!approved && validations[i].vote == VoteType.DISPUTE);
                
                if (votedCorrectly) {
                    uint256 totalPayout = validations[i].stake + rewardPerWinner;
                    payable(validations[i].validator).transfer(totalPayout);
                    bankRewardsEarned[validations[i].validator] += rewardPerWinner;
                    
                    emit StakeReturned(validations[i].validator, validations[i].stake);
                    emit RewardDistributed(validations[i].validator, rewardPerWinner);
                }
            }
        } else if (winnerCount > 0) {
            // No losers, just return stakes to winners
            if (reporterIsWinner) {
                payable(report.reportingBank).transfer(report.reporterStake);
                emit StakeReturned(report.reportingBank, report.reporterStake);
            }
            
            for (uint256 i = 0; i < validations.length; i++) {
                bool votedCorrectly = (approved && validations[i].vote == VoteType.APPROVE) ||
                                     (!approved && validations[i].vote == VoteType.DISPUTE);
                
                if (votedCorrectly) {
                    payable(validations[i].validator).transfer(validations[i].stake);
                    emit StakeReturned(validations[i].validator, validations[i].stake);
                }
            }
        }
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

    /**
     * @notice Get the total number of fraud reports for a customer.
     * @param _customerAddress The address of the customer.
     * @return The count of fraud reports.
     */
    function getReportCount(address _customerAddress) external view returns (uint256) {
        return customerFraudReportIds[_customerAddress].length;
    }

    /**
     * @notice Get a specific report by its ID.
     * @param _reportId The ID of the report.
     * @return The report details.
     */
    function getReport(uint256 _reportId) external view returns (Report memory) {
        require(_reportId > 0 && _reportId <= reportCounter, "Invalid report ID");
        return reports[_reportId];
    }

    /**
     * @notice Get all report IDs for a customer.
     * @param _customerAddress The address of the customer.
     * @return Array of report IDs.
     */
    function getReportIds(address _customerAddress) external view returns (uint256[] memory) {
        return customerFraudReportIds[_customerAddress];
    }

    /**
     * @notice Get all validations for a report.
     * @param _reportId The report ID.
     * @return Array of validations.
     */
    function getReportValidations(uint256 _reportId) external view returns (Validation[] memory) {
        return reportValidations[_reportId];
    }

    /**
     * @notice Get vote counts for a report.
     * @param _reportId The report ID.
     * @return approveCount Number of APPROVE votes.
     * @return disputeCount Number of DISPUTE votes.
     */
    function getVoteCounts(uint256 _reportId) external view returns (uint256 approveCount, uint256 disputeCount) {
        Validation[] storage validations = reportValidations[_reportId];
        
        for (uint256 i = 0; i < validations.length; i++) {
            if (validations[i].vote == VoteType.APPROVE) {
                approveCount++;
            } else {
                disputeCount++;
            }
        }
        
        return (approveCount, disputeCount);
    }

    /**
     * @notice Check if a report can be finalized.
     * @param _reportId The report ID.
     * @return Whether the report can be finalized.
     */
    function canFinalize(uint256 _reportId) external view returns (bool) {
        if (_reportId == 0 || _reportId > reportCounter) return false;
        
        Report storage report = reports[_reportId];
        return !report.isFinalized && block.timestamp >= report.finalizeTime;
    }

    /**
     * @notice Get all pending reports (not finalized).
     * @return Array of pending report IDs.
     */
    function getPendingReports() external view returns (uint256[] memory) {
        uint256 pendingCount = 0;
        
        // First, count pending reports
        for (uint256 i = 1; i <= reportCounter; i++) {
            if (!reports[i].isFinalized) {
                pendingCount++;
            }
        }
        
        // Then, collect them
        uint256[] memory pendingReports = new uint256[](pendingCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= reportCounter; i++) {
            if (!reports[i].isFinalized) {
                pendingReports[index] = i;
                index++;
            }
        }
        
        return pendingReports;
    }

    /**
     * @notice Get reports ready for finalization.
     * @return Array of report IDs ready to finalize.
     */
    function getFinalizableReports() external view returns (uint256[] memory) {
        uint256 finalizableCount = 0;
        
        // Count finalizable reports
        for (uint256 i = 1; i <= reportCounter; i++) {
            if (!reports[i].isFinalized && block.timestamp >= reports[i].finalizeTime) {
                finalizableCount++;
            }
        }
        
        // Collect them
        uint256[] memory finalizableReports = new uint256[](finalizableCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= reportCounter; i++) {
            if (!reports[i].isFinalized && block.timestamp >= reports[i].finalizeTime) {
                finalizableReports[index] = i;
                index++;
            }
        }
        
        return finalizableReports;
    }

    /**
     * @notice Get bank statistics.
     * @param _bankAddress The bank address.
     * @return reportsSubmitted Number of reports submitted.
     * @return validationsMade Number of validations made.
     * @return rewardsEarned Total rewards earned.
     * @return stakesLost Total stakes lost.
     */
    function getBankStats(address _bankAddress) external view returns (
        uint256 reportsSubmitted,
        uint256 validationsMade,
        uint256 rewardsEarned,
        uint256 stakesLost
    ) {
        // Count reports submitted
        for (uint256 i = 1; i <= reportCounter; i++) {
            if (reports[i].reportingBank == _bankAddress) {
                reportsSubmitted++;
            }
        }
        
        // Count validations made
        for (uint256 i = 1; i <= reportCounter; i++) {
            if (hasVoted[i][_bankAddress]) {
                validationsMade++;
            }
        }
        
        return (
            reportsSubmitted,
            validationsMade,
            bankRewardsEarned[_bankAddress],
            bankStakesLost[_bankAddress]
        );
    }

    /**
     * @notice Calculate fraud score for a customer (0-100). Free to call.
     * @param _customerAddress The customer address.
     * @return score The fraud score (0 = highest risk, 100 = clean).
     */
    function getFraudScore(address _customerAddress) public view returns (uint256 score) {
        uint256 approvedReportCount = 0;
        uint256[] memory reportIds = customerFraudReportIds[_customerAddress];

        for(uint i = 0; i < reportIds.length; i++) {
            if (reports[reportIds[i]].status == ReportStatus.APPROVED) {
                approvedReportCount++;
            }
        }
        
        if (approvedReportCount == 0) return 100;      // CLEAN
        if (approvedReportCount == 1) return 75;       // LOW RISK
        if (approvedReportCount == 2) return 55;       // LOW-MEDIUM RISK
        if (approvedReportCount <= 5) return 35;       // MEDIUM RISK
        return 10;                             // HIGH RISK
    }

    /**
     * @notice Payable function to get a customer's fraud score.
     * @param _customerAddress The customer address.
     * @return score The fraud score.
     */
    function getFraudScorePayable(address _customerAddress) external payable returns (uint256 score) {
        require(msg.value >= SCORE_QUERY_FEE, "Insufficient fee for score query");
        accumulatedFees += msg.value;
        return getFraudScore(_customerAddress);
    }

    /**
     * @notice Purchase access to all report CIDs for a customer.
     * @param _customerAddress The customer address.
     * @return An array of IPFS CIDs.
     */
    function purchaseReportDetails(address _customerAddress) external payable returns (string[] memory) {
        uint256[] memory reportIds = customerFraudReportIds[_customerAddress];
        uint256 requiredFee = reportIds.length * REPORT_PURCHASE_FEE_PER_REPORT;
        require(msg.value >= requiredFee, "Insufficient fee for report details");
        
        accumulatedFees += msg.value;

        string[] memory cids = new string[](reportIds.length);
        for (uint i = 0; i < reportIds.length; i++) {
            cids[i] = reports[reportIds[i]].ipfsCID;
        }

        return cids;
    }

    /**
     * @notice Allows the owner to withdraw accumulated fees.
     */
    function withdrawFees() external onlyOwner {
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees to withdraw");
        
        accumulatedFees = 0;
        payable(owner).transfer(amount);

        emit FeesWithdrawn(owner, amount);
    }
}
