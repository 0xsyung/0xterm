// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ERC721Base} from "../src/ERC721Base.sol";

contract ERC721BaseTest is Test {
    ERC721Base impl;
    ERC721Base nft;
    address alice = makeAddr("alice");

    function setUp() public {
        impl = new ERC721Base();
        nft = ERC721Base(Clones.clone(address(impl)));
        nft.initialize("Term NFT", "TNFT");
    }

    function test_Initialize_SetsMetadataAndZeroBalances() public view {
        assertEq(nft.name(), "Term NFT");
        assertEq(nft.symbol(), "TNFT");
        assertEq(nft.balanceOf(alice), 0);
        assertEq(nft.balanceOf(address(this)), 0);
    }

    function test_NoMint_OwnerOfReverts() public {
        // ERC721Base has no mint; no tokens exist and none can be created.
        vm.expectRevert();
        nft.ownerOf(0);
        vm.expectRevert();
        nft.ownerOf(1);
        assertEq(nft.balanceOf(alice), 0);
    }

    function test_Implementation_CannotInitialize() public {
        vm.expectRevert();
        impl.initialize("X", "X");
    }

    function test_Initialize_CannotCallTwice() public {
        vm.expectRevert();
        nft.initialize("Other", "OTH");
    }
}
