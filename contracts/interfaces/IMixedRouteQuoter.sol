// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;
pragma abicoder v2;

/// @title IMixedRouteQuoter Interface
/// @notice Supports the ability to quote the calculated amounts for exact input swaps-is specialized for
/// routes containing a mix of Gridex, UniswapV2, UniswapV3 and Curve liquidity
/// @notice For each grid also tells you the number of initialized boundaries crossed and the sqrt price of the grid after the swap.
/// @dev These functions are not marked view because they rely on calling non-view functions and reverting
/// to compute the result. They are also not gas efficient and should not be called on-chain.
interface IMixedRouteQuoter {
    /// @notice Returns the amount out received for a given exact input swap without executing the swap
    /// @param path The path of the swap, i.e. each token pair and the grid payload
    /// @param amountIn The amount of the first token to swap
    /// @return amountOut The amount of the last token that would be received
    /// @return priceX96AfterList List of the price after the swap for each grid in the path
    /// @return initializedBoundariesCrossedList List of the initialized boundaries that the swap crossed for each grid in the path
    /// @return gasEstimate That the swap may consume
    function quoteExactInput(
        bytes memory path,
        uint256 amountIn
    )
        external
        returns (
            uint256 amountOut,
            uint160[] memory priceX96AfterList,
            uint32[] memory initializedBoundariesCrossedList,
            uint256 gasEstimate
        );

    /// @notice Returns the amount in required for a given exact output swap without executing the swap
    /// @param path The path of the swap, i.e. each token pair and the grid payload.
    /// Path must be provided in reverse order
    /// @param amountOut The amount of the last token to receive
    /// @return amountIn The amount of first token required to be paid
    /// @return priceX96AfterList List of the price after the swap for each grid in the path
    /// @return initializedBoundariesCrossedList List of the initialized boundaries that the swap crossed for each grid in the path
    /// @return gasEstimate That the swap may consume
    function quoteExactOutput(
        bytes memory path,
        uint256 amountOut
    )
        external
        returns (
            uint256 amountIn,
            uint160[] memory priceX96AfterList,
            uint32[] memory initializedBoundariesCrossedList,
            uint256 gasEstimate
        );
}
