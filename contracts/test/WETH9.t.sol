// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {WETH9} from "../src/WETH9.sol";

contract WETH9Test is Test {
    WETH9 weth;
    address alice = makeAddr("alice");

    receive() external payable {}

    function setUp() public {
        weth = new WETH9();
    }

    function test_Metadata() public view {
        assertEq(weth.name(), "Wrapped Ether");
        assertEq(weth.symbol(), "WETH");
        assertEq(weth.decimals(), 18);
        assertEq(weth.totalSupply(), 0);
    }

    function test_Deposit_WrapsRealEth() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        weth.deposit{value: 1 ether}();

        assertEq(weth.balanceOf(alice), 1 ether);
        assertEq(address(weth).balance, 1 ether);
        assertEq(weth.totalSupply(), 1 ether);
        assertEq(alice.balance, 0);
    }

    function test_Receive_Deposits() public {
        vm.deal(alice, 0.5 ether);
        vm.prank(alice);
        (bool ok,) = address(weth).call{value: 0.5 ether}("");
        assertTrue(ok);
        assertEq(weth.balanceOf(alice), 0.5 ether);
        assertEq(address(weth).balance, 0.5 ether);
    }

    function test_Withdraw_UnwrapsToEth() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        weth.deposit{value: 1 ether}();

        vm.prank(alice);
        weth.withdraw(0.4 ether);

        assertEq(weth.balanceOf(alice), 0.6 ether);
        assertEq(alice.balance, 0.4 ether);
        assertEq(address(weth).balance, 0.6 ether);
    }

    function test_Withdraw_InsufficientBalance_Reverts() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        weth.deposit{value: 1 ether}();

        vm.prank(alice);
        vm.expectRevert();
        weth.withdraw(1 ether + 1);
    }

    function test_Transfer() public {
        weth.deposit{value: 1 ether}();
        assertTrue(weth.transfer(alice, 0.25 ether));
        assertEq(weth.balanceOf(alice), 0.25 ether);
        assertEq(weth.balanceOf(address(this)), 0.75 ether);
    }
}
