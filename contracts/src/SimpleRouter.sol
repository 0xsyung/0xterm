// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.6.6;

import "lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "lib/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "lib/v2-core/contracts/interfaces/IERC20.sol";
import "lib/solidity-lib/contracts/libraries/TransferHelper.sol";

contract SimpleRouter {
    address public immutable factory;
    address public immutable WETH;

    event SwapExecution(address indexed user, uint256 amountIn, uint256 amountOut);
    event LiquidityAdded(address indexed user, uint256 amountTokenA, uint256 amountTokenB);

    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }

    // Swap exact tokens for tokens
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(deadline >= block.timestamp, "SimpleRouter: EXPIRED");
        require(path.length >= 2, "SimpleRouter: INVALID_PATH");
        
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        
        // Transfer input tokens from sender
        TransferHelper.safeTransferFrom(path[0], msg.sender, address(this), amountIn);
        
        // Execute swaps
        for (uint i = 0; i < path.length - 1; i++) {
            (uint reserveIn, uint reserveOut) = getReserves(path[i], path[i + 1]);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
            
            address pair = IUniswapV2Factory(factory).getPair(path[i], path[i + 1]);
            TransferHelper.safeTransfer(path[i], pair, amounts[i]);
            
            IUniswapV2Pair(pair).swap(
                path[i] < path[i + 1] ? 0 : amounts[i + 1],
                path[i] < path[i + 1] ? amounts[i + 1] : 0,
                to,
                ""
            );
        }
        
        require(amounts[amounts.length - 1] >= amountOutMin, "SimpleRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        emit SwapExecution(msg.sender, amountIn, amounts[amounts.length - 1]);
    }

    // Add liquidity to a pair
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(deadline >= block.timestamp, "SimpleRouter: EXPIRED");
        
        // Create pair if it doesn't exist
        address pair = IUniswapV2Factory(factory).getPair(tokenA, tokenB);
        if (pair == address(0)) {
            pair = IUniswapV2Factory(factory).createPair(tokenA, tokenB);
        }
        
        // Calculate amounts
        (amountA, amountB) = calculateOptimalAmounts(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            pair
        );
        
        // Transfer tokens to pair
        TransferHelper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, pair, amountB);
        
        // Mint LP tokens
        liquidity = IUniswapV2Pair(pair).mint(to);
        
        emit LiquidityAdded(msg.sender, amountA, amountB);
    }

    // Helper functions
    function getReserves(address tokenA, address tokenB) public view returns (uint256 reserveA, uint256 reserveB) {
        address pair = IUniswapV2Factory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "SimpleRouter: PAIR_NOT_FOUND");
        
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
        (reserveA, reserveB) = tokenA < tokenB ? (uint256(reserve0), uint256(reserve1)) : (uint256(reserve1), uint256(reserve0));
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "SimpleRouter: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "SimpleRouter: INSUFFICIENT_LIQUIDITY");
        
        uint256 amountInWithFee = amountIn * 997; // 0.3% fee
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function calculateOptimalAmounts(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address pair
    ) internal view returns (uint256 amountA, uint256 amountB) {
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
        (uint256 reserveA, uint256 reserveB) = tokenA < tokenB ? (uint256(reserve0), uint256(reserve1)) : (uint256(reserve1), uint256(reserve0));
        
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "SimpleRouter: INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = quote(amountBDesired, reserveB, reserveA);
                require(amountAOptimal <= amountADesired, "SimpleRouter: EXCESSIVE_A_AMOUNT");
                require(amountAOptimal >= amountAMin, "SimpleRouter: INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) public pure returns (uint256 amountB) {
        require(amountA > 0, "SimpleRouter: INSUFFICIENT_AMOUNT");
        require(reserveA > 0 && reserveB > 0, "SimpleRouter: INSUFFICIENT_LIQUIDITY");
        amountB = (amountA * reserveB) / reserveA;
    }
}
