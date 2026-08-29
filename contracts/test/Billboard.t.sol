// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Billboard} from "../src/Billboard.sol";
import {BillboardV2} from "./BillboardV2.t.sol";

contract BillboardTest is Test {
    Billboard billboard;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint256 constant FEE = 0.0001 ether;

    receive() external payable {}

    function setUp() public {
        Billboard impl = new Billboard();
        billboard = Billboard(address(new ERC1967Proxy(address(impl), abi.encodeCall(Billboard.initialize, (FEE)))));
    }

    /// fund `sender` then prank-post on their behalf
    function postAs(address sender, string memory content) internal {
        vm.deal(sender, FEE);
        vm.prank(sender);
        billboard.post{value: FEE}(content);
    }

    function test_Proxy_OwnerAndFee() public view {
        assertEq(billboard.owner(), address(this));
        assertEq(billboard.fee(), FEE);
    }

    function test_Post_StoresPlaintext_ByAnyone() public {
        postAs(alice, "gm everyone");
        postAs(bob, "happy birthday");

        assertEq(billboard.postCount(), 2);

        Billboard.Post memory newest = billboard.getLatest(10, 0)[0];
        assertEq(newest.author, bob);
        assertEq(newest.content, "happy birthday");
        assertEq(newest.timestamp, block.timestamp);

        Billboard.Post memory older = billboard.getLatest(10, 1)[0];
        assertEq(older.author, alice);
        assertEq(older.content, "gm everyone");
    }

    function test_Post_ReturnsId() public {
        vm.deal(alice, FEE);
        vm.prank(alice);
        uint256 id = billboard.post{value: FEE}("first");
        assertEq(id, 0);

        vm.deal(bob, FEE);
        vm.prank(bob);
        id = billboard.post{value: FEE}("second");
        assertEq(id, 1);
    }

    function test_Post_EmptyContent_Reverts() public {
        vm.deal(alice, FEE);
        vm.prank(alice);
        vm.expectRevert("Billboard: empty post");
        billboard.post{value: FEE}("");
    }

    function test_Post_EnforcesFee() public {
        vm.prank(alice);
        vm.expectRevert("Billboard: fee too low");
        billboard.post("no fee");
    }

    function test_GetLatest_ReturnsNewestFirst() public {
        for (uint256 i = 0; i < 7; i++) {
            postAs(alice, string(abi.encodePacked("post ", vm.toString(i))));
        }

        Billboard.Post[] memory latest = billboard.getLatest(3, 0);
        assertEq(latest.length, 3);
        assertEq(latest[0].content, "post 6");
        assertEq(latest[1].content, "post 5");
        assertEq(latest[2].content, "post 4");
    }

    function test_GetLatest_OffsetPages() public {
        for (uint256 i = 0; i < 7; i++) {
            postAs(alice, string(abi.encodePacked("post ", vm.toString(i))));
        }

        // page 2 (skip the 2 newest) — should be posts 4,3,2
        Billboard.Post[] memory page = billboard.getLatest(3, 2);
        assertEq(page.length, 3);
        assertEq(page[0].content, "post 4");
        assertEq(page[1].content, "post 3");
        assertEq(page[2].content, "post 2");

        // offset=1 → posts 5,4,3
        page = billboard.getLatest(3, 1);
        assertEq(page[0].content, "post 5");
        assertEq(page[1].content, "post 4");
        assertEq(page[2].content, "post 3");
    }

    function test_GetLatest_CountClamped() public {
        postAs(alice, "only one");

        Billboard.Post[] memory latest = billboard.getLatest(50, 0);
        assertEq(latest.length, 1);
    }

    function test_GetLatest_OffsetBeyondEnd_ReturnsEmpty() public {
        postAs(alice, "only one");

        Billboard.Post[] memory empty = billboard.getLatest(5, 5);
        assertEq(empty.length, 0);
    }

    function test_GetLatest_EmptyBoard_ReturnsEmpty() public {
        Billboard.Post[] memory empty = billboard.getLatest(5, 0);
        assertEq(empty.length, 0);
    }

    function test_SetFee_OnlyOwner() public {
        vm.prank(billboard.owner());
        billboard.setFee(1 gwei);
        assertEq(billboard.fee(), 1 gwei);
    }

    function test_SetFee_OnlyOwner_Reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        billboard.setFee(1 gwei);
    }

    function test_Withdraw_FeesAccumulate() public {
        postAs(alice, "one");
        postAs(bob, "two");

        uint256 bal = address(billboard).balance;
        assertEq(bal, FEE * 2);

        uint256 before = address(this).balance;
        billboard.withdraw(address(this));
        assertEq(address(billboard).balance, 0);
        assertEq(address(this).balance, before + bal);
    }

    function test_Withdraw_OnlyOwner_Reverts() public {
        postAs(alice, "one");
        vm.prank(bob);
        vm.expectRevert();
        billboard.withdraw(bob);
    }

    /// only the owner can upgrade
    function test_Upgrade_OnlyOwner() public {
        BillboardV2 implV2 = new BillboardV2();

        vm.prank(alice);
        vm.expectRevert();
        billboard.upgradeToAndCall(address(implV2), "");
    }

    function test_Upgrade_PreservesPosts() public {
        postAs(alice, "keep me");

        BillboardV2 implV2 = new BillboardV2();
        billboard.upgradeToAndCall(address(implV2), "");

        BillboardV2(address(billboard)).setVersionTag(12345);
        assertEq(BillboardV2(address(billboard)).versionTag(), 12345);

        assertEq(billboard.postCount(), 1);
        Billboard.Post memory p = billboard.getLatest(10, 0)[0];
        assertEq(p.author, alice);
        assertEq(p.content, "keep me");
    }
}
