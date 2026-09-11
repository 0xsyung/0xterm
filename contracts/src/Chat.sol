// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title Chat
 * @dev Encrypted 1:1 messaging stored on-chain. Shared implementation is used
 *      both behind a UUPS proxy (legacy/official) and as the target of EIP-1167
 *      clones via ChatFactory (user channels). The contract only ever holds
 *      opaque ciphertext (iv + encrypted bytes) — it can never read messages.
 *      Decryption happens in the browser via ECDH + AES-GCM.
 *
 *      Each deployment has an immutable on-chain `name` set at initialize.
 *      A tiny per-message fee (native token) deters spam; fees accumulate and
 *      are swept to the owner by withdraw(). Ownership is transferable.
 */
contract Chat is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public fee;

    struct Message {
        address from;
        uint256 timestamp;
        bytes12 iv; // AES-GCM nonce (12 bytes), public — unique per message
        bytes senderKey; // sender's 33-byte compressed secp256k1 public key
        bytes ciphertext; // encrypted content, opaque to the contract
    }

    // per-recipient, per-sender thread: inbox[to][from] is one conversation.
    // sendersOf[to] tracks distinct senders so the recipient can enumerate all
    // threads in one place (instead of scanning every address).
    mapping(address => mapping(address => Message[])) public inbox;
    mapping(address => address[]) public sendersOf;
    uint256 public messageCount;

    // public-key registry: keys[address] = the owner's 33-byte compressed
    // secp256k1 public key (their chat/messaging key). Lets a stranger send a
    // message knowing only the recipient's ADDRESS — no out-of-band key
    // exchange needed. Anyone may register/update their own key, at any time.
    // Registration requires proof-of-possession: the key must be signed by the
    // wallet controlling `msg.sender` (see setPublicKey), so an attacker cannot
    // register a key for an address they don't control. This is what makes the
    // registry authoritative for ECDH: the recipient can trust that keys[addr]
    // belongs to addr's owner.
    mapping(address => bytes) public keys;

    // Human label set once at initialize (≤32 bytes). Appended at end of
    // layout so a UUPS upgrade of an older proxy keeps prior slots intact.
    string private _name;

    event MessageSent(
        address indexed from,
        address indexed to,
        bytes32 indexed id,
        uint256 timestamp,
        uint256 len
    );
    event FeeChanged(uint256 newFee);
    event FeeWithdrawn(address indexed to, uint256 amount);
    event PublicKeyRegistered(address indexed who, bytes key);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // The implementation is deployed directly (not through a proxy), so it
        // must not be initializable — locks it forever to prevent a logic-level
        // hijack. Only the proxy is initialized via initialize().
        _disableInitializers();
    }

    function initialize(uint256 initialFee, string calldata name_) public initializer {
        uint256 len = bytes(name_).length;
        require(len > 0 && len <= 32, "Chat: bad name");
        __Ownable_init(msg.sender);
        fee = initialFee;
        _name = name_;
    }

    /// On-chain channel label set at initialize; immutable afterwards.
    function name() external view returns (string memory) {
        return _name;
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
    ) external payable returns (bytes32 id) {
        require(msg.value >= fee, "Chat: fee too low");
        require(ciphertext.length > 0, "Chat: empty message");
        require(senderKey.length == 33, "Chat: invalid sender key");

        // id = content-address (keccak of the message) mixed with the global
        // send counter. The content part makes it tamper-evident and not
        // guessable in advance; the counter (nonce) guarantees a UNIQUE id
        // even for identical messages, and provides a chain-wide ordering/freshness
        // signal for external indexers.
        id = keccak256(abi.encodePacked(messageCount++, to, iv, senderKey, ciphertext));
        inbox[to][msg.sender].push(
            Message({
                from: msg.sender,
                timestamp: block.timestamp,
                iv: iv,
                senderKey: senderKey,
                ciphertext: ciphertext
            })
        );
        _addSender(to, msg.sender);

        emit MessageSent(msg.sender, to, id, block.timestamp, ciphertext.length);
    }

    /// Register (or rotate) the caller's chat public key — 33-byte compressed
    /// secp256k1, matching what sendMessage() stores as senderKey.
    ///
    /// Proof-of-possession: `v`/`r`/`s` must be a signature by the wallet that
    /// controls `msg.sender` over the EIP-191 personal-message digest of
    /// `keccak256(abi.encodePacked(block.chainid, msg.sender, key))`. The inner
    /// hash binds the key to BOTH the chain and the address (not chain-agnostic),
    /// so a signature harvested on one chain is worthless on another; the EIP-191
    /// wrapper matches how wallets (wagmi/hardware) actually sign — they always
    /// personal-sign, so requiring the wrapper is what makes ecrecover recover
    /// msg.sender. Without this, anyone could register a key for any address and
    /// the ECDH "encryption" would be key-authenticated by nothing (finding C-1).
    function setPublicKey(bytes calldata key, uint8 v, bytes32 r, bytes32 s) external {
        require(key.length == 33, "Chat: invalid public key");
        bytes32 msgHash = keccak256(abi.encodePacked(block.chainid, msg.sender, key));
        bytes32 signedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        address recovered = ecrecover(signedHash, v, r, s);
        require(recovered == msg.sender, "Chat: not the key owner");
        keys[msg.sender] = key;
        emit PublicKeyRegistered(msg.sender, key);
    }

    /// The recipient's registered public key, or empty bytes if not registered.
    function getPublicKey(address who) external view returns (bytes memory) {
        return keys[who];
    }

    /// record `from` in `to`'s sender list on first message (else no-op)
    function _addSender(address to, address from) internal {
        address[] storage senders = sendersOf[to];
        for (uint256 i = 0; i < senders.length; i++) {
            if (senders[i] == from) return;
        }
        senders.push(from);
    }

    /**
     * @notice Read a slice of the `to` ↔ `from` thread (oldest first).
     */
    function getThread(
        address to,
        address from,
        uint256 start,
        uint256 count
    ) external view returns (Message[] memory msgs) {
        Message[] storage thread = inbox[to][from];
        if (start >= thread.length) return new Message[](0);
        uint256 end = start + count;
        if (end > thread.length) end = thread.length;
        msgs = new Message[](end - start);
        for (uint256 i = start; i < end; i++) {
            msgs[i - start] = thread[i];
        }
    }

    /// total messages in the `to` ↔ `from` thread
    function threadCount(address to, address from) external view returns (uint256) {
        return inbox[to][from].length;
    }

    /// distinct senders who have messaged `to` (to enumerate conversations)
    function getSenders(address to) external view returns (address[] memory) {
        return sendersOf[to];
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

    /**
     * @notice UUPS: only the owner may point the proxy at a new implementation.
     *         History lives in the proxy's storage, so it is preserved across
     *         upgrades.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
