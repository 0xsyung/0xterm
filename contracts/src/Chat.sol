// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Chat
 * @dev Encrypted 1:1 messaging stored on-chain. The contract only ever holds
 *      opaque ciphertext (iv + encrypted bytes) — it can never read messages.
 *      Decryption happens in the browser via ECDH + AES-GCM.
 *
 *      A tiny per-message fee (paid in the chain's native token) deters spam.
 *      Fees accumulate in the contract and are swept to the owner by
 *      withdraw(); ownership is transferable via Ownable so the fee sink can
 *      be moved, and setFee() lets the owner tune the spam threshold without
 *      redeploying.
 */
contract Chat is Ownable {
    uint256 public fee;

    struct Message {
        address from;
        uint256 timestamp;
        bytes12 iv; // AES-GCM nonce (12 bytes), public — unique per message
        bytes senderKey; // sender's 33-byte compressed secp256k1 public key
        bytes ciphertext; // encrypted content, opaque to the contract
    }

    // per-recipient inbox; a conversation is the intersection of both inboxes
    mapping(address => Message[]) public inbox;
    uint256 public messageCount;

    event MessageSent(
        address indexed from,
        address indexed to,
        uint256 indexed id,
        uint256 timestamp,
        uint256 len
    );
    event FeeChanged(uint256 newFee);
    event FeeWithdrawn(address indexed to, uint256 amount);

    constructor(uint256 initialFee) Ownable(msg.sender) {
        fee = initialFee;
    }

    /**
     * @notice Store an encrypted message for `to`.
     * @param to recipient address
     * @param iv 12-byte AES-GCM nonce used to encrypt `ciphertext`
     * @param senderKey sender's 33-byte compressed secp256k1 public key, so the
     *        recipient can derive the ECDH shared secret and decrypt
     * @param ciphertext encrypted message bytes (ciphertext ‖ auth tag)
     */
    function sendMessage(
        address to,
        bytes12 iv,
        bytes calldata senderKey,
        bytes calldata ciphertext
    ) external payable returns (uint256 id) {
        require(msg.value >= fee, "Chat: fee too low");
        require(ciphertext.length > 0, "Chat: empty message");
        require(senderKey.length == 33, "Chat: invalid sender key");

        id = messageCount++;
        inbox[to].push(
            Message({
                from: msg.sender,
                timestamp: block.timestamp,
                iv: iv,
                senderKey: senderKey,
                ciphertext: ciphertext
            })
        );

        emit MessageSent(msg.sender, to, id, block.timestamp, ciphertext.length);
    }

    /**
     * @notice Read a slice of `to`'s inbox (oldest first).
     */
    function getMessages(
        address to,
        uint256 start,
        uint256 count
    ) external view returns (Message[] memory msgs) {
        Message[] storage all = inbox[to];
        if (start >= all.length) return new Message[](0);
        uint256 end = start + count;
        if (end > all.length) end = all.length;
        msgs = new Message[](end - start);
        for (uint256 i = start; i < end; i++) {
            msgs[i - start] = all[i];
        }
    }

    function inboxCount(address to) external view returns (uint256) {
        return inbox[to].length;
    }

    function setFee(uint256 newFee) external onlyOwner {
        fee = newFee;
        emit FeeChanged(newFee);
    }

    /**
     * @notice Sweep accumulated message fees to an arbitrary recipient.
     * @param to address that receives the accumulated native balance
     */
    function withdraw(address to) external onlyOwner {
        require(to != address(0), "Chat: zero address");
        uint256 bal = address(this).balance;
        require(bal > 0, "Chat: nothing to withdraw");
        (bool ok, ) = payable(to).call{value: bal}("");
        require(ok, "Chat: withdraw failed");
        emit FeeWithdrawn(to, bal);
    }
}
