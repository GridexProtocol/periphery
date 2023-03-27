// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@gridexprotocol/core/contracts/interfaces/IGrid.sol";
import "@gridexprotocol/core/contracts/interfaces/IGridStructs.sol";
import "@gridexprotocol/core/contracts/interfaces/IGridParameters.sol";

contract MockGrid is IGrid, IGridStructs, IGridParameters {
    address public override token0;
    address public override token1;
    int24 public override resolution;

    int24 public override takerFee;

    Slot0 public override slot0;

    mapping(int24 => Boundary) public override boundaries0;
    mapping(int24 => Boundary) public override boundaries1;
    mapping(int16 => uint256) public override boundaryBitmaps0;
    mapping(int16 => uint256) public override boundaryBitmaps1;

    mapping(uint256 => Order) public override orders;

    mapping(uint64 => Bundle) public override bundles;

    mapping(address => TokensOwed) public override tokensOweds;

    /// ========================================================================

    /// @inheritdoc IGrid
    function collect(
        address recipient,
        uint128 amount0Requested,
        uint128 amount1Requested
    ) external override returns (uint128 amount0, uint128 amount1) {}

    /// @inheritdoc IGrid
    function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external override {}

    /// @inheritdoc IGrid
    function initialize(
        InitializeParameters memory parameters,
        bytes calldata data
    ) external override returns (uint256[] memory orderIds0, uint256[] memory orderIds1) {}

    function syncFee() external returns (int24 _takerFee, int24 _makerFee) {}

    /// @inheritdoc IGrid
    function placeMakerOrder(
        IGridParameters.PlaceOrderParameters memory parameters,
        bytes calldata data
    ) external override returns (uint256 orderId) {}

    /// @inheritdoc IGrid
    function placeMakerOrderInBatch(
        IGridParameters.PlaceOrderInBatchParameters memory parameters,
        bytes calldata data
    ) external override returns (uint256[] memory orderIds) {}

    /// @inheritdoc IGrid
    function settleMakerOrder(uint256 orderId) external override returns (uint128 amount0, uint128 amount1) {}

    /// @inheritdoc IGrid
    function settleMakerOrderAndCollect(
        address recipient,
        uint256 orderId,
        bool unwrapWETH9
    ) external override returns (uint128 amount0, uint128 amount1) {}

    /// @inheritdoc IGrid
    function settleMakerOrderAndCollectInBatch(
        address recipient,
        uint256[] memory orderIds,
        bool unwrapWETH9
    ) external override returns (uint128 amount0Total, uint128 amount1Total) {}

    /// @inheritdoc IGrid
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 priceLimitX96,
        bytes calldata data
    ) external override returns (int256 amount0, int256 amount1) {}

    /// =======================================================================

    function setToken0(address _token0) external {
        token0 = _token0;
    }

    function setToken1(address _token1) external {
        token1 = _token1;
    }

    function setResolution(int24 _resolution) external {
        resolution = _resolution;
    }

    function setSlot0(uint160 _priceX96, int24 _boundary) external {
        slot0.priceX96 = _priceX96;
        slot0.boundary = _boundary;
    }

    function setBoundaries0(
        int24 _boundary,
        uint64 _bundle0Id,
        uint64 _bundle1Id,
        uint128 _makerAmountRemaining
    ) external {
        boundaries0[_boundary].bundle0Id = _bundle0Id;
        boundaries0[_boundary].bundle1Id = _bundle1Id;
        boundaries0[_boundary].makerAmountRemaining = _makerAmountRemaining;
    }

    function setBoundaries1(
        int24 _boundary,
        uint64 _bundle0Id,
        uint64 _bundle1Id,
        uint128 _makerAmountRemaining
    ) external {
        boundaries1[_boundary].bundle0Id = _bundle0Id;
        boundaries1[_boundary].bundle1Id = _bundle1Id;
        boundaries1[_boundary].makerAmountRemaining = _makerAmountRemaining;
    }

    function setBoundaryBitmaps0(int16 _wordPos, uint256 _bitPos) external {
        boundaryBitmaps0[_wordPos] = _bitPos;
    }

    function setBoundaryBitmaps1(int16 _wordPos, uint256 _bitPos) external {
        boundaryBitmaps1[_wordPos] = _bitPos;
    }

    function setBundles(uint64 _bundleId, Bundle memory _bundle) external {
        bundles[_bundleId] = _bundle;
    }

    function setTokensOweds(address _owner, uint128 _token0, uint128 _token1) external {
        tokensOweds[_owner].token0 = _token0;
        tokensOweds[_owner].token1 = _token1;
    }
}
