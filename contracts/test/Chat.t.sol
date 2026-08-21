// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Chat} from "../src/Chat.sol";

contract ChatTest is Test {
    Chat chat;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    uint256 constant FEE = 0.0001 ether;
    bytes12 constant IV = bytes12(hex"0102030405060708090a0b0c");
    bytes constant CT = hex"aabbccddeeff00112233445566778899";

    receive() external payable {}

    function setUp() public {
        chat = new Chat(FEE);
    }

    /// 33-byte compressed secp256k1 public key placeholder (valid length only)
    bytes constant SENDER_KEY = hex"020000000000000000000000000000000000000000000000000000000000000000";

    /// fund `sender` then prank-send `fee` wei on their behalf
    function sendAs(address sender, address to, bytes12 iv, bytes memory ct, uint256 fee) internal {
        vm.deal(sender, fee);
        vm.prank(sender);
        chat.sendMessage{value: fee}(to, iv, SENDER_KEY, ct);
    }

    function test_Constructor_SetsOwnerAndFee() public view {
        assertEq(chat.owner(), address(this));
        assertEq(chat.fee(), FEE);
    }

    function test_SendMessage_StoresCiphertextPerRecipient() public {
        sendAs(alice, bob, IV, CT, FEE);

        assertEq(chat.inboxCount(bob), 1);
        assertEq(chat.messageCount(), 1);
        assertEq(chat.inboxCount(alice), 0); // not in sender's inbox
        assertEq(chat.inboxCount(carol), 0);

        Chat.Message memory m = chat.getMessages(bob, 0, 10)[0];
        assertEq(m.from, alice);
        assertEq(m.iv, IV);
        assertEq(m.senderKey, SENDER_KEY);
        assertEq(m.ciphertext, CT);
        assertEq(m.timestamp, block.timestamp);
    }

    function test_SendMessage_FeeTooLow_Reverts() public {
        vm.deal(alice, FEE);
        vm.prank(alice);
        vm.expectRevert("Chat: fee too low");
        chat.sendMessage{value: FEE - 1}(bob, IV, SENDER_KEY, CT);
    }

    function test_SendMessage_EmptyMessage_Reverts() public {
        vm.deal(alice, FEE);
        vm.prank(alice);
        vm.expectRevert("Chat: empty message");
        chat.sendMessage{value: FEE}(bob, IV, SENDER_KEY, "");
    }

    function test_SendMessage_InvalidSenderKey_Reverts() public {
        vm.deal(alice, FEE);
        vm.prank(alice);
        vm.expectRevert("Chat: invalid sender key");
        chat.sendMessage{value: FEE}(bob, IV, hex"02", CT); // 1 byte, not 33
    }

    function test_SendMessage_IdenticalCiphertexts_GetDistinctIds() public {
        // same content, same iv — contract just stores them as separate messages
        sendAs(alice, bob, IV, CT, FEE);
        sendAs(alice, bob, IV, CT, FEE);

        assertEq(chat.inboxCount(bob), 2);
        assertEq(chat.messageCount(), 2);
    }

    function test_GetMessages_Slicing() public {
        for (uint256 i = 0; i < 5; i++) {
            sendAs(alice, bob, IV, CT, FEE);
        }
        Chat.Message[] memory all = chat.getMessages(bob, 0, 10);
        assertEq(all.length, 5);

        Chat.Message[] memory slice = chat.getMessages(bob, 2, 2);
        assertEq(slice.length, 2);
        // message ids are sequential from messageCount
        assertEq(all[2].timestamp, block.timestamp);
        assertEq(slice[0].timestamp, all[2].timestamp);
    }

    function test_GetMessages_OutOfRange_ReturnsEmpty() public view {
        Chat.Message[] memory msgs = chat.getMessages(bob, 0, 10);
        assertEq(msgs.length, 0);
    }

    function test_SetFee_OnlyOwner() public {
        uint256 newFee = 0.0005 ether;
        chat.setFee(newFee);
        assertEq(chat.fee(), newFee);

        vm.prank(alice);
        vm.expectRevert();
        chat.setFee(1);
    }

    function test_Withdraw_SendsToRecipient() public {
        sendAs(alice, bob, IV, CT, FEE);
        sendAs(alice, bob, IV, CT, FEE);

        uint256 bal = address(chat).balance;
        assertEq(bal, 2 * FEE);
        uint256 before = carol.balance;

        vm.expectEmit();
        emit Chat.FeeWithdrawn(carol, bal);
        chat.withdraw(carol);

        assertEq(address(chat).balance, 0);
        assertEq(carol.balance - before, bal);
    }

    function test_Withdraw_NoBalance_Reverts() public {
        vm.expectRevert("Chat: nothing to withdraw");
        chat.withdraw(address(this));
    }

    function test_Withdraw_ZeroAddress_Reverts() public {
        sendAs(alice, bob, IV, CT, FEE);
        vm.expectRevert("Chat: zero address");
        chat.withdraw(address(0));
    }

    function test_Withdraw_OnlyOwner() public {
        sendAs(alice, bob, IV, CT, FEE);

        vm.prank(bob);
        vm.expectRevert();
        chat.withdraw(bob);
    }

    function test_TransferOwnership_NewOwnerCanWithdraw() public {
        sendAs(alice, bob, IV, CT, FEE);

        chat.transferOwnership(bob);
        assertEq(chat.owner(), bob);

        vm.prank(bob);
        chat.withdraw(bob);
        assertEq(address(chat).balance, 0);
        assertEq(bob.balance, FEE);
    }
}
