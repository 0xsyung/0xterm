// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title Billboard
 * @dev Public notice board stored on-chain, behind a UUPS upgradeable proxy.
 *      Anyone may post plaintext content (no encryption, no target user — fully
 *      public). A tiny per-post fee (paid in the chain's native token) deters
 *      spam, accumulating in the contract until the owner sweeps it via
 *      withdraw().
 *
 *      The PROXY owns the storage, so the post ledger survives logic upgrades.
 *      The implementation is deployed separately; upgradeToAndCall() swaps it
 *      while keeping all posts.
 */
contract Billboard is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public fee;

    struct Post {
        address author;
        uint256 timestamp;
        string content;
    }

    // append-only public ledger (newest = last element)
    Post[] public posts;
    uint256 public postCount;

    event Posted(address indexed author, uint256 timestamp, uint256 len);
    event FeeChanged(uint256 newFee);
    event FeeWithdrawn(address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Implementation is deployed directly (not through a proxy), so it
        // must not be initializable — locks it forever to prevent a
        // logic-level hijack. Only the proxy is initialized via initialize().
        _disableInitializers();
    }

    function initialize(uint256 initialFee) public initializer {
        __Ownable_init(msg.sender);
        fee = initialFee;
    }

    /**
     * @notice Post public content to the board. Anyone may post; a tiny fee
     *         (>= `fee`) deters spam.
     * @return id index of the new post in the ledger (0-based)
     */
    function post(string calldata content) external payable returns (uint256 id) {
        require(msg.value >= fee, "Billboard: fee too low");
        require(bytes(content).length > 0, "Billboard: empty post");

        posts.push(Post(msg.sender, block.timestamp, content));
        postCount = posts.length;
        emit Posted(msg.sender, block.timestamp, bytes(content).length);
        return posts.length - 1;
    }

    /**
     * @notice Latest `count` posts, newest first, skipping `offset` newest
     *         posts (for pagination). e.g. getLatest(5, 0) = the 5 newest;
     *         getLatest(5, 5) = the next 5 back in time.
     */
    function getLatest(uint256 count, uint256 offset) external view returns (Post[] memory out) {
        if (posts.length == 0 || offset >= posts.length || count == 0) {
            return new Post[](0);
        }
        if (count > posts.length - offset) count = posts.length - offset;
        out = new Post[](count);
        for (uint256 i = 0; i < count; i++) {
            out[i] = posts[posts.length - 1 - offset - i];
        }
    }

    function setFee(uint256 newFee) external onlyOwner {
        fee = newFee;
        emit FeeChanged(newFee);
    }

    /**
     * @notice Sweep accumulated post fees to an arbitrary recipient.
     */
    function withdraw(address to) external onlyOwner {
        require(to != address(0), "Billboard: zero address");
        uint256 bal = address(this).balance;
        require(bal > 0, "Billboard: nothing to withdraw");
        (bool ok,) = payable(to).call{value: bal}("");
        require(ok, "Billboard: withdraw failed");
        emit FeeWithdrawn(to, bal);
    }

    /**
     * @notice UUPS: only the owner may point the proxy at a new implementation.
     *         The post ledger lives in the proxy's storage, so it is preserved
     *         across upgrades.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
