// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title EnsRegistry
 * @dev 0xterm's own ENS registry + resolver for testnets, behind a UUPS
 *      upgradeable proxy. Mainnet keeps the canonical ENS (resolved via viem's
 *      v1 universal resolver); testnets use this contract so ENS names resolve
 *      on the ACTIVE chain the terminal is switched to.
 *
 *      Registration is OPEN: anyone may call setRecord() for any name, but each
 *      address can hold at most one name — setting a new name frees the caller's
 *      previous one. Names are reassignable (setting a name that another address
 *      holds simply moves it). This intentionally mirrors a testnet namespace
 *      where users claim an address-bound nickname rather than squatting a name.
 *
 *      Records are keyed by `namehash(name)` for forward lookup (addr(node))
 *      and by address for reverse lookup (nameOfAddr(who)). Clearing a record
 *      removes both directions.
 */
contract EnsRegistry is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // namehash(name) => address (forward resolution)
    mapping(bytes32 => address) public addrOf;
    // address => name (reverse resolution, for display in the UI)
    mapping(address => string) public nameOf;
    // address => namehash of the name currently held (so we can free the
    // previous record without computing namehash in Solidity)
    mapping(address => bytes32) public nodeOf;

    event RecordSet(bytes32 indexed node, address indexed addr, string name);
    event RecordCleared(bytes32 indexed node, address indexed addr);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
    }

    /**
     * @notice Register (or update) a name → address record in both directions.
     *         Open to anyone. One name per address: setting a new name frees
     *         the caller's previous name; names are reassignable.
     * @param node namehash(name) — the forward-lookup key
     * @param who address the name resolves to
     * @param name the human-readable name (for reverse lookup / display)
     */
    function setRecord(bytes32 node, address who, string calldata name) external {
        require(who != address(0), "ENS: zero address");
        require(bytes(name).length > 0, "ENS: empty name");

        // one name per address — free `who`'s previous name first
        bytes32 prevNode = nodeOf[who];
        if (prevNode != bytes32(0) && addrOf[prevNode] == who) delete addrOf[prevNode];

        // names are reassignable — if `node` points at another address, free
        // that address's reverse + node mappings (it no longer owns this name)
        address prevOwner = addrOf[node];
        if (prevOwner != address(0) && prevOwner != who) {
            delete nameOf[prevOwner];
            delete nodeOf[prevOwner];
        }

        addrOf[node] = who;
        nameOf[who] = name;
        nodeOf[who] = node;
        emit RecordSet(node, who, name);
    }

    /// Remove a record (both directions) if `node` currently resolves to `who`.
    function clearRecord(bytes32 node, address who) external {
        if (addrOf[node] == who) {
            delete addrOf[node];
            delete nameOf[who];
            delete nodeOf[who];
            emit RecordCleared(node, who);
        }
    }

    /// Forward: namehash(name) → registered address (zero if unregistered).
    function addr(bytes32 node) external view returns (address) {
        return addrOf[node];
    }

    /// Reverse: address → registered name (empty string if none).
    function nameOfAddr(address who) external view returns (string memory) {
        return nameOf[who];
    }

    /**
     * @notice UUPS: only the owner may point the proxy at a new implementation.
     *         Records live in the proxy's storage, so they survive upgrades.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
