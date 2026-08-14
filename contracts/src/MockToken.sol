// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockToken
 * @dev A simple ERC20 token implementation for testing purposes
 */
contract MockToken {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Constructor to initialize the token
     * @param _name The name of the token
     * @param _symbol The symbol of the token
     * @param _decimals The number of decimal places
     * @param _initialSupply The initial supply of tokens (will be minted to deployer)
     */
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply
    ) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _initialSupply * 10 ** uint256(_decimals);
        balanceOf[msg.sender] = totalSupply;
    }

    /**
     * @dev Transfer tokens from caller to recipient
     * @param _to The recipient address
     * @param _value The amount of tokens to transfer
     * @return success True if transfer was successful
     */
    function transfer(address _to, uint256 _value) public returns (bool success) {
        require(_to != address(0), "Invalid address");
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");

        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;

        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    /**
     * @dev Transfer tokens from one address to another (requires approval)
     * @param _from The sender address
     * @param _to The recipient address
     * @param _value The amount of tokens to transfer
     * @return success True if transfer was successful
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public returns (bool success) {
        require(_to != address(0), "Invalid address");
        require(balanceOf[_from] >= _value, "Insufficient balance");
        require(allowance[_from][msg.sender] >= _value, "Allowance exceeded");

        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        allowance[_from][msg.sender] -= _value;

        emit Transfer(_from, _to, _value);
        return true;
    }

    /**
     * @dev Approve tokens to be spent by another address
     * @param _spender The address that can spend the tokens
     * @param _value The amount of tokens to approve
     * @return success True if approval was successful
     */
    function approve(address _spender, uint256 _value) public returns (bool success) {
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /**
     * @dev Mint new tokens (only callable by owner)
     * @param _to The recipient of the minted tokens
     * @param _value The amount of tokens to mint
     */
    function mint(address _to, uint256 _value) public {
        balanceOf[_to] += _value;
        totalSupply += _value;
        emit Transfer(address(0), _to, _value);
    }

    /**
     * @dev Burn tokens from caller's balance
     * @param _value The amount of tokens to burn
     */
    function burn(uint256 _value) public {
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");
        balanceOf[msg.sender] -= _value;
        totalSupply -= _value;
        emit Transfer(msg.sender, address(0), _value);
    }
}
