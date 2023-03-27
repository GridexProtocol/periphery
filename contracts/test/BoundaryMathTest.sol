// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@gridexprotocol/core/contracts/libraries/BoundaryMath.sol";

contract BoundaryMathTest {
    function isValidBoundary(int24 Boundary, int24 resolution) external pure returns (bool) {
        return BoundaryMath.isValidBoundary(Boundary, resolution);
    }

    function isInRange(int24 Boundary) external pure returns (bool) {
        return BoundaryMath.isInRange(Boundary);
    }

    function isPriceX96InRange(uint160 priceX96) external pure returns (bool inRange) {
        return BoundaryMath.isPriceX96InRange(priceX96);
    }

    function getPriceX96AtBoundary(int24 Boundary) external pure returns (uint256 priceX96) {
        return BoundaryMath.getPriceX96AtBoundary(Boundary);
    }

    function getBoundaryAtPriceX96(uint160 priceX96) external pure returns (int24 Boundary) {
        return BoundaryMath.getBoundaryAtPriceX96(priceX96);
    }

    function getBoundaryLowerAtBoundary(int24 Boundary, int24 resolution) external pure returns (int24 BoundaryLower) {
        return BoundaryMath.getBoundaryLowerAtBoundary(Boundary, resolution);
    }

    function rewriteToValidBoundaryLower(
        int24 BoundaryLower,
        int24 resolution
    ) external pure returns (int24 validBoundaryLower) {
        return BoundaryMath.rewriteToValidBoundaryLower(BoundaryLower, resolution);
    }
}
