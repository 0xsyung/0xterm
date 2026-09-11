// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Chat} from "./Chat.sol";

/**
 * @title ChatFactory
 * @dev Deploys EIP-1167 minimal proxies of a shared Chat implementation.
 *      Each clone is initialized with (fee, name); ownership is transferred to
 *      the deployer. Factory owner may swap `implementation` for *future*
 *      clones only — existing channels keep their bytecode.
 */
contract ChatFactory is Ownable {
    using Clones for address;

    address public implementation;

    event ChannelCreated(
        address indexed channel,
        address indexed deployer,
        string name,
        uint256 fee
    );
    event ImplementationUpdated(address indexed implementation);

    constructor(address implementation_) Ownable(msg.sender) {
        require(implementation_ != address(0), "ChatFactory: zero impl");
        implementation = implementation_;
    }

    function deploy(string calldata name_, uint256 initialFee) external returns (address channel) {
        channel = implementation.clone();
        Chat(channel).initialize(initialFee, name_);
        // initialize sets owner=factory; hand the channel to the deployer
        Chat(channel).transferOwnership(msg.sender);
        emit ChannelCreated(channel, msg.sender, name_, initialFee);
    }

    function setImplementation(address implementation_) external onlyOwner {
        require(implementation_ != address(0), "ChatFactory: zero impl");
        implementation = implementation_;
        emit ImplementationUpdated(implementation_);
    }
}
