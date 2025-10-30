// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BankRegistry
 * @author Divij (with Gemini)
 * @notice This contract manages a list of authorized bank addresses.
 * It serves as a single source of truth for other contracts in the system
 * to verify if an action is being performed by a registered institution.
 */
contract BankRegistry {
    // --- State Variables ---

    address public owner;
    mapping(address => bool) public registeredBanks;

    // --- Events ---

    /**
     * @notice Emitted when a new bank is successfully registered.
     * @param bankAddress The address of the newly registered bank.
     */
    event BankRegistered(address indexed bankAddress);

    /**
     * @notice Emitted when a bank is removed from the registry.
     * @param bankAddress The address of the removed bank.
     */
    event BankRemoved(address indexed bankAddress);

    // --- Modifiers ---

    /**
     * @notice Restricts a function to be callable only by the contract owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    // --- Constructor ---

    /**
     * @notice The constructor function is called once when the contract is deployed.
     * It sets the deployer of the contract as the owner.
     */
    constructor() {
        owner = msg.sender;
    }

    // --- Functions ---

    /**
     * @notice Registers a new bank address. Can only be called by the owner.
     * @param _bankAddress The address of the bank to register.
     */
    function registerBank(address _bankAddress) external onlyOwner {
        require(_bankAddress != address(0), "Cannot register the zero address");
        require(!registeredBanks[_bankAddress], "Bank is already registered");
        
        registeredBanks[_bankAddress] = true;
        emit BankRegistered(_bankAddress);
    }

    /**
     * @notice Removes a bank from the registry. Can only be called by the owner.
     * @param _bankAddress The address of the bank to remove.
     */
    function removeBank(address _bankAddress) external onlyOwner {
        require(registeredBanks[_bankAddress], "Bank is not registered");
        
        registeredBanks[_bankAddress] = false;
        emit BankRemoved(_bankAddress);
    }

    /**
     * @notice A public view function to check if an address belongs to a registered bank.
     * This function can be called by anyone, including other smart contracts.
     * @param _bankAddress The address to check.
     * @return A boolean value: true if the bank is registered, false otherwise.
     */
    function isBankRegistered(address _bankAddress) external view returns (bool) {
        return registeredBanks[_bankAddress];
    }
}