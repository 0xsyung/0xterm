// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title PortfolioShare
 * @dev Opt-in public portfolio / PnL index. One combined card per owner
 *      (bytes payload, versioned off-chain). A tiny per-share fee (native
 *      token) deters spam; fees accumulate until the owner sweeps via
 *      withdraw(). Testnets first — same posture as Billboard / Chat.
 *
 *      The PROXY owns the storage, so the share ledger survives logic upgrades.
 */
contract PortfolioShare is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public fee;

    mapping(address => bytes) private cards;
    mapping(address => bool) private active;
    mapping(address => uint256) private updatedAt;

    // chronological owners (newest = last). Re-share moves the owner to the end.
    address[] private owners;
    // 1-based index into owners; 0 = never shared
    mapping(address => uint256) private ownerIndex;

    event Shared(address indexed owner, uint256 updatedAt, bytes32 contentHash);
    event Unshared(address indexed owner);
    event FeeChanged(uint256 newFee);
    event FeeWithdrawn(address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 initialFee) public initializer {
        __Ownable_init(msg.sender);
        fee = initialFee;
    }

    /**
     * @notice Publish or replace the caller's share card. Pays >= `fee`.
     *         The owner is always msg.sender — cannot share as another address.
     */
    function share(bytes calldata card) external payable {
        require(msg.value >= fee, "PortfolioShare: fee too low");
        require(card.length > 0, "PortfolioShare: empty card");

        cards[msg.sender] = card;
        active[msg.sender] = true;
        updatedAt[msg.sender] = block.timestamp;
        _touch(msg.sender);

        emit Shared(msg.sender, block.timestamp, keccak256(card));
    }

    /**
     * @notice Revoke the caller's public share. Card bytes stay so look can
     *         show REVOKED; get() returns active=false.
     */
    function unshare() external {
        require(updatedAt[msg.sender] != 0, "PortfolioShare: not shared");
        active[msg.sender] = false;
        emit Unshared(msg.sender);
    }

    function get(address owner)
        external
        view
        returns (bytes memory card, bool isActive, uint256 updatedAt_)
    {
        return (cards[owner], active[owner], updatedAt[owner]);
    }

    /**
     * @notice Latest `count` sharers, newest first, skipping `offset` newest
     *         (pagination). Includes revoked owners so feed can show REVOKED.
     */
    function latest(uint256 count, uint256 offset) external view returns (address[] memory out) {
        if (owners.length == 0 || offset >= owners.length || count == 0) {
            return new address[](0);
        }
        if (count > owners.length - offset) count = owners.length - offset;
        out = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            out[i] = owners[owners.length - 1 - offset - i];
        }
    }

    function ownerCount() external view returns (uint256) {
        return owners.length;
    }

    function setFee(uint256 newFee) external onlyOwner {
        fee = newFee;
        emit FeeChanged(newFee);
    }

    function withdraw(address to) external onlyOwner {
        require(to != address(0), "PortfolioShare: zero address");
        uint256 bal = address(this).balance;
        require(bal > 0, "PortfolioShare: nothing to withdraw");
        (bool ok,) = payable(to).call{value: bal}("");
        require(ok, "PortfolioShare: withdraw failed");
        emit FeeWithdrawn(to, bal);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// First share appends; re-share moves the owner to the newest slot.
    function _touch(address who) internal {
        uint256 idx = ownerIndex[who];
        if (idx == 0) {
            owners.push(who);
            ownerIndex[who] = owners.length;
            return;
        }
        uint256 i = idx - 1;
        uint256 last = owners.length - 1;
        if (i == last) return;
        for (uint256 j = i; j < last; j++) {
            address nxt = owners[j + 1];
            owners[j] = nxt;
            ownerIndex[nxt] = j + 1;
        }
        owners[last] = who;
        ownerIndex[who] = last + 1;
    }
}
