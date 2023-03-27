// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../libraries/GridBoundariesCounter.sol";

contract GridBoundariesCounterTest {
    function countInitializedBoundariesCrossed(
        IGrid grid,
        bool zeroForOne,
        uint160 priceX96Before,
        int24 boundaryBefore,
        int24 boundaryLowerBefore,
        uint160 priceX96After,
        int24 boundaryAfter,
        int24 boundaryLowerAfter
    ) external view returns (uint32 initializedBoundariesCrossed) {
        return
            GridBoundariesCounter.countInitializedBoundariesCrossed(
                GridBoundariesCounter.CountInitializedBoundariesCrossedParameters({
                    grid: grid,
                    zeroForOne: zeroForOne,
                    priceX96Before: priceX96Before,
                    boundaryBefore: boundaryBefore,
                    boundaryLowerBefore: boundaryLowerBefore,
                    priceX96After: priceX96After,
                    boundaryAfter: boundaryAfter,
                    boundaryLowerAfter: boundaryLowerAfter
                })
            );
    }
}
