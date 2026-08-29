// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockToken} from "../src/MockToken.sol";

contract MockTokenTest is Test {
    MockToken token;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint8 constant DECIMALS = 18;
    uint256 constant INITIAL_SUPPLY = 1_000;

    function setUp() public {
        token = new MockToken("Mock USD", "mUSD", DECIMALS, INITIAL_SUPPLY);
    }

    function test_Constructor_MintsInitialSupplyToDeployer() public view {
        uint256 expected = INITIAL_SUPPLY * 10 ** uint256(DECIMALS);
        assertEq(token.name(), "Mock USD");
        assertEq(token.symbol(), "mUSD");
        assertEq(token.decimals(), DECIMALS);
        assertEq(token.totalSupply(), expected);
        assertEq(token.balanceOf(address(this)), expected);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_Transfer() public {
        token.transfer(alice, 100);
        assertEq(token.balanceOf(alice), 100);
        assertEq(token.balanceOf(address(this)), token.totalSupply() - 100);
    }

    function test_ApproveAndTransferFrom() public {
        token.approve(alice, 50);
        vm.prank(alice);
        token.transferFrom(address(this), bob, 50);
        assertEq(token.balanceOf(bob), 50);
        assertEq(token.allowance(address(this), alice), 0);
    }

    function test_Burn() public {
        uint256 beforeSupply = token.totalSupply();
        token.burn(10);
        assertEq(token.totalSupply(), beforeSupply - 10);
        assertEq(token.balanceOf(address(this)), beforeSupply - 10);
    }

    /// DOCUMENTATION (not a fix): mint is public with no access control.
    /// Any caller can mint today. Do not treat this as intended production ACL.
    function test_Mint_StrangerSucceeds() public {
        uint256 beforeSupply = token.totalSupply();
        vm.prank(alice);
        token.mint(bob, 123);

        assertEq(token.balanceOf(bob), 123);
        assertEq(token.totalSupply(), beforeSupply + 123);
        // stranger minted to themselves as well
        vm.prank(alice);
        token.mint(alice, 1);
        assertEq(token.balanceOf(alice), 1);
    }
}
