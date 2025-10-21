// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IBankRegistry
 * @notice This is an interface to interact with the BankRegistry contract.
 * An interface defines the function signatures of another contract, allowing
 * this contract to call them without needing the full source code.
 */
interface IBankRegistry {
    function isBankRegistered(address _bankAddress) external view returns (bool);
}

/**
 * @title CreditDataLedger
 * @author Divij (with Gemini)
 * @notice This contract stores credit history and data submitted by authorized banks.
 * It is linked to the BankRegistry contract to ensure that only verified
 * institutions can add or modify credit records.
 */
contract CreditDataLedger {
    // --- State Variables ---

    // Stores the address of the deployed BankRegistry contract to use for verification.
    address public bankRegistryAddress;

    // A custom data structure to hold the details of a single credit event.
    struct CreditEntry {
        uint256 entryId;
        string entryDetails; // e.g., "Loan Repayment Successful: ID 987" or "New Credit Line Approved"
        address reportingBank;
        uint256 timestamp;
    }

    // A mapping that links a customer's wallet address to an array of their credit entries.
    // This allows a single customer to have a complete, ordered history of credit events.
    mapping(address => CreditEntry[]) public userCreditHistory;
    
    // A global counter to ensure every credit entry has a unique ID.
    uint256 public entryCounter;

    // --- Events ---

    /**
     * @notice Emitted when new credit data is successfully added for a user.
     * Events create a log on the blockchain that external applications can listen to.
     * @param userAddress The address of the customer whose credit is being updated.
     * @param bankAddress The address of the bank that submitted the data.
     * @param entryId The unique ID of this new credit entry.
     */
    event CreditDataAdded(address indexed userAddress, address indexed bankAddress, uint256 entryId);

    // --- Constructor ---

    /**
     * @notice The constructor is a special function that runs only once upon deployment.
     * It permanently links this contract to the already deployed BankRegistry contract.
     * @param _bankRegistryAddress The address of the deployed BankRegistry contract.
     */
    constructor(address _bankRegistryAddress) {
        require(_bankRegistryAddress != address(0), "Invalid registry address");
        bankRegistryAddress = _bankRegistryAddress;
    }

    // --- Functions ---

    /**
     * @notice Allows a registered bank to add a new credit entry to a customer's history.
     * @param _userAddress The address of the customer whose credit history is being updated.
     * @param _entryDetails A string containing the details of the credit event (e.g., loan status).
     */
    function addCreditEntry(address _userAddress, string memory _entryDetails) external {
        // Step 1: Security Check - Verify the caller is a registered bank by calling the
        // isBankRegistered function on the BankRegistry contract.
        require(
            IBankRegistry(bankRegistryAddress).isBankRegistered(msg.sender),
            "Caller is not a registered bank"
        );

        // Step 2: Input Validation - Ensure the customer address is not the zero address.
        require(_userAddress != address(0), "Invalid user address");

        // Step 3: Increment counter for a unique ID.
        entryCounter++;
        
        // Step 4: Create the new credit entry in memory.
        CreditEntry memory newEntry = CreditEntry(
            entryCounter,
            _entryDetails,
            msg.sender, // The address of the bank calling the function
            block.timestamp // The timestamp of the block this transaction is included in
        );
        
        // Step 5: Append the new entry to the customer's credit history array.
        userCreditHistory[_userAddress].push(newEntry);

        // Step 6: Emit an event to log that this action occurred.
        emit CreditDataAdded(_userAddress, msg.sender, entryCounter);
    }

    /**
     * @notice A public view function to retrieve the entire credit history for a specific customer.
     * 'view' means this function only reads data and does not cost any gas to call.
     * @param _userAddress The address of the customer to look up.
     * @return An array of CreditEntry structs containing the customer's full history.
     */
    function getUserCreditHistory(address _userAddress) external view returns (CreditEntry[] memory) {
        return userCreditHistory[_userAddress];
    }
}
