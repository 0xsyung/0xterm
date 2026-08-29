// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ERC20Base} from "../src/ERC20Base.sol";

contract ERC20BaseTest is Test {
    ERC20Base impl;
    ERC20Base token;
    address alice = makeAddr("alice");

    function setUp() public {
        impl = new ERC20Base();
        token = ERC20Base(Clones.clone(address(impl)));
        token.initialize("Foo", "FOO", 18);
    }

    function test_Initialize_SetsMetadataAndZeroSupply() public view {
        assertEq(token.name(), "Foo");
        assertEq(token.symbol(), "FOO");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 0);
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(address(this)), 0);
    }

    function test_Initialize_CustomDecimals() public {
        ERC20Base clone6 = ERC20Base(Clones.clone(address(impl)));
        clone6.initialize("USD Coin", "USDC", 6);
        assertEq(clone6.decimals(), 6);
        assertEq(clone6.totalSupply(), 0);
    }

    function test_NoMint_SupplyStaysZeroAndTransferReverts() public {
        // ERC20Base has no mint; current behavior is a zero-supply token.
        vm.expectRevert();
        token.transfer(alice, 1);
        assertEq(token.totalSupply(), 0);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_Implementation_CannotInitialize() public {
        vm.expectRevert();
        impl.initialize("X", "X", 18);
    }

    function test_Initialize_CannotCallTwice() public {
        vm.expectRevert();
        token.initialize("Bar", "BAR", 8);
    }
}
