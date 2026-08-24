// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {EnsRegistry} from "../src/EnsRegistry.sol";
import {EnsRegistryV2} from "./EnsRegistryV2.t.sol";

contract EnsRegistryTest is Test {
    EnsRegistry ens;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    // namehash(name) — computed with keccak256 + label splitting. Built here
    // with the standard algorithm so the test doesn't need a lib.
    bytes32 constant ALICE_NODE =
        keccak256(abi.encodePacked(keccak256(abi.encodePacked("alice")), keccak256(abi.encodePacked("eth"))));
    string constant ALICE_NAME = "alice.eth";
    bytes32 constant BOB_NODE =
        keccak256(abi.encodePacked(keccak256(abi.encodePacked("bob")), keccak256(abi.encodePacked("eth"))));
    string constant BOB_NAME = "bob.eth";

    receive() external payable {}

    function setUp() public {
        EnsRegistry impl = new EnsRegistry();
        ens = EnsRegistry(address(new ERC1967Proxy(address(impl), abi.encodeCall(EnsRegistry.initialize, ()))));
    }

    function test_Proxy_Owner() public view {
        assertEq(ens.owner(), address(this));
    }

    function test_SetRecord_StoresForwardAndReverse() public {
        ens.setRecord(ALICE_NODE, alice, ALICE_NAME);
        assertEq(ens.addr(ALICE_NODE), alice);
        assertEq(ens.nameOfAddr(alice), ALICE_NAME);
    }

    function test_SetRecord_AnyoneCanRegister() public {
        vm.prank(alice);
        ens.setRecord(ALICE_NODE, alice, ALICE_NAME);
        assertEq(ens.addr(ALICE_NODE), alice);
        assertEq(ens.nameOfAddr(alice), ALICE_NAME);
    }

    function test_SetRecord_ZeroAddress_Reverts() public {
        vm.expectRevert("ENS: zero address");
        ens.setRecord(ALICE_NODE, address(0), ALICE_NAME);
    }

    function test_SetRecord_EmptyName_Reverts() public {
        vm.expectRevert("ENS: empty name");
        ens.setRecord(ALICE_NODE, alice, "");
    }

    function test_SetRecord_MovesAddress_ClearsOldReverse() public {
        ens.setRecord(ALICE_NODE, alice, ALICE_NAME);
        ens.setRecord(ALICE_NODE, bob, ALICE_NAME);

        assertEq(ens.addr(ALICE_NODE), bob);
        assertEq(ens.nameOfAddr(alice), ""); // old reverse removed
        assertEq(ens.nameOfAddr(bob), ALICE_NAME);
    }

    function test_SetRecord_OneNamePerAddress_FreesPrevious() public {
        ens.setRecord(ALICE_NODE, alice, ALICE_NAME);
        ens.setRecord(BOB_NODE, alice, BOB_NAME);

        assertEq(ens.nameOfAddr(alice), BOB_NAME); // alice now holds bob.eth
        assertEq(ens.addr(BOB_NODE), alice);
        assertEq(ens.addr(ALICE_NODE), address(0)); // alice.eth freed
    }

    function test_SetRecord_NameReassigns() public {
        ens.setRecord(ALICE_NODE, alice, ALICE_NAME);
        ens.setRecord(ALICE_NODE, bob, ALICE_NAME);

        assertEq(ens.addr(ALICE_NODE), bob); // name moved to bob
        assertEq(ens.nameOfAddr(alice), ""); // alice no longer owns it
        assertEq(ens.nameOfAddr(bob), ALICE_NAME);
    }

    function test_ClearRecord_RemovesBothDirections() public {
        ens.setRecord(ALICE_NODE, alice, ALICE_NAME);
        ens.clearRecord(ALICE_NODE, alice);

        assertEq(ens.addr(ALICE_NODE), address(0));
        assertEq(ens.nameOfAddr(alice), "");
    }

    function test_ClearRecord_OpenToAnyone() public {
        ens.setRecord(ALICE_NODE, alice, ALICE_NAME);
        vm.prank(bob);
        ens.clearRecord(ALICE_NODE, alice);

        assertEq(ens.addr(ALICE_NODE), address(0));
        assertEq(ens.nameOfAddr(alice), "");
    }

    function test_Upgrade_PreservesRecords() public {
        ens.setRecord(ALICE_NODE, alice, ALICE_NAME);

        EnsRegistryV2 implV2 = new EnsRegistryV2();
        ens.upgradeToAndCall(address(implV2), "");

        EnsRegistryV2(address(ens)).setVersionTag(12345);
        assertEq(EnsRegistryV2(address(ens)).versionTag(), 12345);
        assertEq(ens.addr(ALICE_NODE), alice);
        assertEq(ens.nameOfAddr(alice), ALICE_NAME);
    }

    function test_Upgrade_OnlyOwner_Reverts() public {
        EnsRegistryV2 implV2 = new EnsRegistryV2();
        vm.prank(alice);
        vm.expectRevert();
        ens.upgradeToAndCall(address(implV2), "");
    }
}
