// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {PortfolioShare} from "../src/PortfolioShare.sol";

contract PortfolioShareTest is Test {
    PortfolioShare share;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    uint256 constant FEE = 0.0001 ether;

    receive() external payable {}

    function setUp() public {
        PortfolioShare impl = new PortfolioShare();
        share = PortfolioShare(
            address(new ERC1967Proxy(address(impl), abi.encodeCall(PortfolioShare.initialize, (FEE))))
        );
    }

    function shareAs(address sender, bytes memory card) internal {
        vm.deal(sender, FEE);
        vm.prank(sender);
        share.share{value: FEE}(card);
    }

    function test_Proxy_OwnerAndFee() public view {
        assertEq(share.owner(), address(this));
        assertEq(share.fee(), FEE);
    }

    function test_Share_StoresCard_Active() public {
        bytes memory card = hex"01ab";
        shareAs(alice, card);

        (bytes memory got, bool active, uint256 ts) = share.get(alice);
        assertEq(got, card);
        assertTrue(active);
        assertEq(ts, block.timestamp);
        assertEq(share.ownerCount(), 1);
    }

    function test_Share_OwnerIsMsgSender() public {
        shareAs(alice, hex"11");
        (bytes memory got,,) = share.get(alice);
        assertEq(got, hex"11");
        (bytes memory bobCard, bool bobActive, uint256 bobTs) = share.get(bob);
        assertEq(bobCard.length, 0);
        assertFalse(bobActive);
        assertEq(bobTs, 0);
    }

    function test_Share_ReplacesPrevious() public {
        shareAs(alice, hex"01");
        shareAs(alice, hex"02");
        (bytes memory got, bool active,) = share.get(alice);
        assertEq(got, hex"02");
        assertTrue(active);
        assertEq(share.ownerCount(), 1);
    }

    function test_Share_EmptyCard_Reverts() public {
        vm.deal(alice, FEE);
        vm.prank(alice);
        vm.expectRevert("PortfolioShare: empty card");
        share.share{value: FEE}("");
    }

    function test_Share_EnforcesFee() public {
        vm.prank(alice);
        vm.expectRevert("PortfolioShare: fee too low");
        share.share(hex"01");
    }

    function test_Unshare_GetInactive() public {
        shareAs(alice, hex"aa");
        vm.prank(alice);
        share.unshare();

        (bytes memory got, bool active, uint256 ts) = share.get(alice);
        assertEq(got, hex"aa");
        assertFalse(active);
        assertGt(ts, 0);
    }

    function test_Unshare_NeverShared_Reverts() public {
        vm.prank(alice);
        vm.expectRevert("PortfolioShare: not shared");
        share.unshare();
    }

    function test_Unshare_ThenReshare_Active() public {
        shareAs(alice, hex"aa");
        vm.prank(alice);
        share.unshare();
        shareAs(alice, hex"bb");
        (bytes memory got, bool active,) = share.get(alice);
        assertEq(got, hex"bb");
        assertTrue(active);
    }

    function test_Latest_NewestFirst() public {
        shareAs(alice, hex"01");
        shareAs(bob, hex"02");
        shareAs(carol, hex"03");

        address[] memory latest = share.latest(10, 0);
        assertEq(latest.length, 3);
        assertEq(latest[0], carol);
        assertEq(latest[1], bob);
        assertEq(latest[2], alice);
    }

    function test_Latest_ReshareMovesToFront() public {
        shareAs(alice, hex"01");
        shareAs(bob, hex"02");
        shareAs(carol, hex"03");
        shareAs(alice, hex"01ff");

        address[] memory latest = share.latest(10, 0);
        assertEq(latest.length, 3);
        assertEq(latest[0], alice);
        assertEq(latest[1], carol);
        assertEq(latest[2], bob);
    }

    function test_Latest_OffsetPages() public {
        shareAs(alice, hex"01");
        shareAs(bob, hex"02");
        shareAs(carol, hex"03");

        address[] memory page = share.latest(1, 1);
        assertEq(page.length, 1);
        assertEq(page[0], bob);

        page = share.latest(2, 1);
        assertEq(page.length, 2);
        assertEq(page[0], bob);
        assertEq(page[1], alice);
    }

    function test_Latest_CountClamped() public {
        shareAs(alice, hex"01");
        address[] memory latest = share.latest(50, 0);
        assertEq(latest.length, 1);
    }

    function test_Latest_OffsetBeyondEnd_ReturnsEmpty() public {
        shareAs(alice, hex"01");
        address[] memory empty = share.latest(5, 5);
        assertEq(empty.length, 0);
    }

    function test_Latest_Empty_ReturnsEmpty() public view {
        address[] memory empty = share.latest(5, 0);
        assertEq(empty.length, 0);
    }

    function test_Latest_IncludesRevoked() public {
        shareAs(alice, hex"01");
        vm.prank(alice);
        share.unshare();
        address[] memory latest = share.latest(5, 0);
        assertEq(latest.length, 1);
        assertEq(latest[0], alice);
        (, bool active,) = share.get(alice);
        assertFalse(active);
    }

    function test_Get_Unknown_EmptyInactive() public view {
        (bytes memory card, bool active, uint256 ts) = share.get(alice);
        assertEq(card.length, 0);
        assertFalse(active);
        assertEq(ts, 0);
    }

    function test_SetFee_OnlyOwner() public {
        share.setFee(1 gwei);
        assertEq(share.fee(), 1 gwei);
    }

    function test_SetFee_OnlyOwner_Reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        share.setFee(1 gwei);
    }

    function test_Withdraw_FeesAccumulate() public {
        shareAs(alice, hex"01");
        shareAs(bob, hex"02");
        uint256 bal = address(share).balance;
        assertEq(bal, FEE * 2);
        uint256 before = address(this).balance;
        share.withdraw(address(this));
        assertEq(address(share).balance, 0);
        assertEq(address(this).balance, before + bal);
    }

    function test_Withdraw_OnlyOwner_Reverts() public {
        shareAs(alice, hex"01");
        vm.prank(bob);
        vm.expectRevert();
        share.withdraw(bob);
    }

    function test_Withdraw_ZeroAddress_Reverts() public {
        shareAs(alice, hex"01");
        vm.expectRevert("PortfolioShare: zero address");
        share.withdraw(address(0));
    }

    function test_Withdraw_Nothing_Reverts() public {
        vm.expectRevert("PortfolioShare: nothing to withdraw");
        share.withdraw(address(this));
    }

    function test_SharedEvent() public {
        vm.deal(alice, FEE);
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit PortfolioShare.Shared(alice, block.timestamp, keccak256(hex"abcd"));
        share.share{value: FEE}(hex"abcd");
    }

    function test_UnsharedEvent() public {
        shareAs(alice, hex"01");
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit PortfolioShare.Unshared(alice);
        share.unshare();
    }
}
