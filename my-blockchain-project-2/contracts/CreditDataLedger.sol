// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBankRegistry {
    function isBankRegistered(address _bankAddress) external view returns (bool);
}

contract CreditDataLedger {
    // --- State Variables ---

    address public bankRegistryAddress;

    struct CreditEntry {
        uint256 entryId;
        string ipfsCID; // CHANGED: This string is now an IPFS Content ID (CID)
        address reportingBank;
        uint256 timestamp;
    }

    mapping(address => CreditEntry[]) public userCreditHistory;
    uint256 public entryCounter;

    // --- Events ---

    event CreditDataAdded(
        address indexed userAddress, 
        address indexed bankAddress, 
        uint256 entryId,
        string ipfsCID
    );

    // --- Constructor ---
    constructor(address _bankRegistryAddress) {
        require(_bankRegistryAddress != address(0), "Invalid registry address");
        bankRegistryAddress = _bankRegistryAddress;
    }

    // --- Functions ---

    /**
     * @notice Allows a registered bank to add a new credit entry for a user.
     * @param _userAddress The address of the customer whose credit history is being updated.
     * @param _ipfsCID The IPFS Content ID (CID) of the evidence/data file.
     */
    function addCreditEntry(address _userAddress, string memory _ipfsCID) external {
        require(
            IBankRegistry(bankRegistryAddress).isBankRegistered(msg.sender),
            "Caller is not a registered bank"
        );
        require(_userAddress != address(0), "Invalid user address");

        entryCounter++;
        
        CreditEntry memory newEntry = CreditEntry(
            entryCounter,
            _ipfsCID,
            msg.sender,
            block.timestamp
        );
        
        userCreditHistory[_userAddress].push(newEntry);

        emit CreditDataAdded(_userAddress, msg.sender, entryCounter, _ipfsCID);
    }

    /**
     * @notice Retrieves the entire credit history for a specific user.
     */
    function getUserCreditHistory(address _userAddress) external view returns (CreditEntry[] memory) {
        return userCreditHistory[_userAddress];
    }
}
