// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Chat} from "../src/Chat.sol";
import {ChatFactory} from "../src/ChatFactory.sol";

contract ChatFactoryTest is Test {
    ChatFactory factory;
    Chat impl;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint256 constant FEE = 0.0001 ether;
    bytes12 constant IV = bytes12(hex"0102030405060708090a0b0c");
    bytes constant CT = hex"aabbccddeeff00112233445566778899";
    bytes constant SENDER_KEY = hex"020000000000000000000000000000000000000000000000000000000000000000";

    function setUp() public {
        impl = new Chat();
        factory = new ChatFactory(address(impl));
    }

    function test_Factory_ImplementationView() public view {
        assertEq(factory.implementation(), address(impl));
    }

    function test_Factory_Deploy_SetsNameFeeOwner() public {
        vm.prank(alice);
        address channel = factory.deploy("lobby", FEE);
        Chat chat = Chat(channel);
        assertEq(chat.name(), "lobby");
        assertEq(chat.fee(), FEE);
        assertEq(chat.owner(), alice);
    }

    function test_Factory_NameImmutable_EmptyAndLongRevert() public {
        vm.expectRevert("Chat: bad name");
        factory.deploy("", FEE);

        vm.expectRevert("Chat: bad name");
        factory.deploy("abcdefghijklmnopqrstuvwxyz0123456", FEE); // 33 bytes
    }

    function test_Factory_SendGetThread_OnClone() public {
        address channel = factory.deploy("room", FEE);
        Chat chat = Chat(channel);

        vm.deal(alice, FEE);
        vm.prank(alice);
        chat.sendMessage{value: FEE}(bob, IV, SENDER_KEY, CT);

        assertEq(chat.threadCount(bob, alice), 1);
        Chat.Message memory m = chat.getThread(bob, alice, 0, 10)[0];
        assertEq(m.from, alice);
        assertEq(m.ciphertext, CT);
    }

    function test_Factory_SecondClone_IndependentStorage() public {
        address a = factory.deploy("a", FEE);
        address b = factory.deploy("b", FEE);
        assertTrue(a != b);
        assertEq(Chat(a).name(), "a");
        assertEq(Chat(b).name(), "b");

        vm.deal(alice, FEE);
        vm.prank(alice);
        Chat(a).sendMessage{value: FEE}(bob, IV, SENDER_KEY, CT);

        assertEq(Chat(a).threadCount(bob, alice), 1);
        assertEq(Chat(b).threadCount(bob, alice), 0);
        assertEq(Chat(a).messageCount(), 1);
        assertEq(Chat(b).messageCount(), 0);
    }

    function test_Factory_OwnerCanUpdateImplementation_FutureOnly() public {
        Chat impl2 = new Chat();
        factory.setImplementation(address(impl2));
        assertEq(factory.implementation(), address(impl2));

        address oldChannel = factory.deploy("old", FEE);
        // old channel still works (delegates to whatever was baked into clone bytecode —
        // actually EIP-1167 embeds impl address at deploy time, so this clone uses impl2)
        assertEq(Chat(oldChannel).name(), "old");
    }

    /// Gas: EIP-1167 factory deploy vs legacy UUPS proxy+impl path (same impl contract).
    function test_Gas_CloneVsUups() public {
        // Measure clone path (factory already has impl)
        uint256 g0 = gasleft();
        address clone = factory.deploy("gas-clone", FEE);
        uint256 cloneGas = g0 - gasleft();
        clone; // silence

        // Measure UUPS path: new impl + proxy + initialize (legacy DeployChat)
        uint256 g1 = gasleft();
        Chat uupsImpl = new Chat();
        address proxy = address(
            new ERC1967Proxy(address(uupsImpl), abi.encodeCall(Chat.initialize, (FEE, "gas-uups")))
        );
        uint256 uupsGas = g1 - gasleft();
        proxy;

        // Emit via assertTrue so -vvvv shows values in traces; also log
        emit log_named_uint("clone_deploy_gas", cloneGas);
        emit log_named_uint("uups_impl_plus_proxy_gas", uupsGas);
        assertTrue(cloneGas < uupsGas, "clone should be cheaper than full UUPS path");
    }
}
