// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../libraries/SwapPath.sol";

contract SwapPathTest {
    function hasMultipleGrids(bytes memory path) public pure returns (bool) {
        return SwapPath.hasMultipleGrids(path);
    }

    function decodeFirstGrid(bytes memory path) public pure returns (address tokenA, address tokenB, int24 resolution) {
        return SwapPath.decodeFirstGrid(path);
    }

    function getFirstGrid(bytes memory path) public pure returns (bytes memory) {
        return SwapPath.getFirstGrid(path);
    }

    function skipToken(bytes memory path) public pure returns (bytes memory) {
        return SwapPath.skipToken(path);
    }
}
