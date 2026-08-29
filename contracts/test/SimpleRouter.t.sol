// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SimpleRouter} from "../src/SimpleRouter.sol";
import {MockToken} from "../src/MockToken.sol";
import {WETH9} from "../src/WETH9.sol";

/// Minimal V2 pair: only getReserves + swap. Does not pull in v2-core 0.5.16.
contract MockV2Pair {
    address public token0;
    address public token1;
    uint112 internal reserve0;
    uint112 internal reserve1;

    address public lastSwapTo;
    uint256 public lastAmount0Out;
    uint256 public lastAmount1Out;
    uint256 public swapCount;

    constructor(address tokenA, address tokenB) {
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    function setReserves(uint112 r0, uint112 r1) external {
        reserve0 = r0;
        reserve1 = r1;
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, 0);
    }

    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata) external {
        lastSwapTo = to;
        lastAmount0Out = amount0Out;
        lastAmount1Out = amount1Out;
        swapCount += 1;
        if (amount0Out > 0) {
            MockToken(token0).transfer(to, amount0Out);
        }
        if (amount1Out > 0) {
            MockToken(token1).transfer(to, amount1Out);
        }
    }
}

contract MockV2Factory {
    mapping(address => mapping(address => address)) public getPair;

    function setPair(address tokenA, address tokenB, address pair) external {
        getPair[tokenA][tokenB] = pair;
        getPair[tokenB][tokenA] = pair;
    }
}

contract SimpleRouterTest is Test {
    SimpleRouter router;
    MockV2Factory factory;
    WETH9 weth;
    MockToken tokenA;
    MockToken tokenB;
    MockToken tokenC;
    MockV2Pair pairAB;
    MockV2Pair pairBC;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint112 constant RESERVE_IN = 1_000_000 ether;
    uint112 constant RESERVE_OUT = 1_000_000 ether;

    function setUp() public {
        factory = new MockV2Factory();
        weth = new WETH9();
        router = new SimpleRouter(address(factory), address(weth));

        tokenA = new MockToken("Token A", "TKA", 18, 0);
        tokenB = new MockToken("Token B", "TKB", 18, 0);
        tokenC = new MockToken("Token C", "TKC", 18, 0);

        pairAB = new MockV2Pair(address(tokenA), address(tokenB));
        pairBC = new MockV2Pair(address(tokenB), address(tokenC));
        factory.setPair(address(tokenA), address(tokenB), address(pairAB));
        factory.setPair(address(tokenB), address(tokenC), address(pairBC));

        _seedPair(pairAB, address(tokenA), address(tokenB));
        _seedPair(pairBC, address(tokenB), address(tokenC));
    }

    function _seedPair(MockV2Pair pair, address tokenIn, address tokenOut) internal {
        if (tokenIn < tokenOut) {
            pair.setReserves(RESERVE_IN, RESERVE_OUT);
        } else {
            pair.setReserves(RESERVE_OUT, RESERVE_IN);
        }
        // cover a large swap output so the mock can pay
        MockToken(tokenOut).mint(address(pair), RESERVE_OUT);
    }

    function _expectedOut(uint256 amountIn) internal pure returns (uint256) {
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * uint256(RESERVE_OUT);
        uint256 denominator = (uint256(RESERVE_IN) * 1000) + amountInWithFee;
        return numerator / denominator;
    }

    function test_Constructor_SetsFactoryAndWeth() public view {
        assertEq(router.factory(), address(factory));
        assertEq(router.WETH(), address(weth));
    }

    function test_GetAmountOut_KnownValue() public view {
        uint256 amountIn = 1000 ether;
        uint256 expected = _expectedOut(amountIn);
        assertEq(router.getAmountOut(amountIn, RESERVE_IN, RESERVE_OUT), expected);
        assertTrue(expected < amountIn); // fee + curve
    }

    function test_GetAmountOut_ZeroIn_Reverts() public {
        vm.expectRevert("SimpleRouter: INSUFFICIENT_INPUT_AMOUNT");
        router.getAmountOut(0, RESERVE_IN, RESERVE_OUT);
    }

    function test_SwapExactTokensForTokens_SingleHop_SendsToRecipient() public {
        uint256 amountIn = 1 ether;
        tokenA.mint(alice, amountIn);
        vm.prank(alice);
        tokenA.approve(address(router), amountIn);

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        uint256 expectedOut = _expectedOut(amountIn);

        vm.prank(alice);
        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn, expectedOut, path, bob, block.timestamp + 1
        );

        assertEq(amounts[0], amountIn);
        assertEq(amounts[1], expectedOut);
        assertEq(pairAB.lastSwapTo(), bob);
        assertEq(pairAB.swapCount(), 1);
        assertEq(tokenB.balanceOf(bob), expectedOut);
        assertEq(tokenA.balanceOf(alice), 0);
        assertEq(tokenA.balanceOf(address(pairAB)), amountIn);
        assertEq(tokenA.balanceOf(address(router)), 0);
    }

    function test_SwapExactTokensForTokens_MultiHop_IntermediateGoesToNextPair() public {
        uint256 amountIn = 1 ether;
        tokenA.mint(alice, amountIn);
        vm.prank(alice);
        tokenA.approve(address(router), amountIn);

        address[] memory path = new address[](3);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);

        uint256 outB = _expectedOut(amountIn);
        uint256 outC = _expectedOut(outB);

        vm.prank(alice);
        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn, outC, path, bob, block.timestamp + 1
        );

        assertEq(amounts.length, 3);
        assertEq(amounts[1], outB);
        assertEq(amounts[2], outC);

        // hop 0 must send B to pairBC, not to `bob`
        assertEq(pairAB.lastSwapTo(), address(pairBC));
        assertEq(pairAB.swapCount(), 1);
        // hop 1 sends C to the recipient
        assertEq(pairBC.lastSwapTo(), bob);
        assertEq(pairBC.swapCount(), 1);

        assertEq(tokenC.balanceOf(bob), outC);
        assertEq(tokenB.balanceOf(bob), 0);
        assertEq(tokenB.balanceOf(address(pairBC)), outB); // hop0 output landed on next pair
        assertEq(tokenA.balanceOf(address(router)), 0);
        assertEq(tokenB.balanceOf(address(router)), 0);
    }

    function test_SwapExactTokensForTokens_InsufficientOutput_RevertsBeforePull() public {
        uint256 amountIn = 1 ether;
        tokenA.mint(alice, amountIn);
        vm.prank(alice);
        tokenA.approve(address(router), amountIn);

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        uint256 expectedOut = _expectedOut(amountIn);

        vm.prank(alice);
        vm.expectRevert("SimpleRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        router.swapExactTokensForTokens(amountIn, expectedOut + 1, path, bob, block.timestamp + 1);

        // quote-then-check: input never left alice
        assertEq(tokenA.balanceOf(alice), amountIn);
        assertEq(pairAB.swapCount(), 0);
    }

    function test_SwapExactTokensForTokens_Expired_Reverts() public {
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        vm.expectRevert("SimpleRouter: EXPIRED");
        router.swapExactTokensForTokens(1, 0, path, bob, block.timestamp - 1);
    }

    function test_SwapExactTokensForTokens_InvalidPath_Reverts() public {
        address[] memory path = new address[](1);
        path[0] = address(tokenA);
        vm.expectRevert("SimpleRouter: INVALID_PATH");
        router.swapExactTokensForTokens(1, 0, path, bob, block.timestamp + 1);
    }

    function test_GetReserves_UnknownPair_Reverts() public {
        MockToken other = new MockToken("Other", "OTH", 18, 0);
        vm.expectRevert("SimpleRouter: PAIR_NOT_FOUND");
        router.getReserves(address(tokenA), address(other));
    }
}
