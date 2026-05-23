// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ERC-20 interface — just the functions we need
interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract SentraVault {

    // ── Owner ──
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    // ── Supported assets ──
    // We store the four asset addresses here
    // On testnet these will be placeholder ERC-20 addresses
    address public mETH;
    address public USDY;
    address public USDC;
    address public mUSD;

    // ── Allocation percentages (must add up to 100) ──
    uint256 public allocMETH;
    uint256 public allocUSDY;
    uint256 public allocUSDC;
    uint256 public allocMUSD;

    // ── User balances per asset ──
    // userBalance[userAddress][assetAddress] = amount
    mapping(address => mapping(address => uint256)) public userBalance;

    // ── Total deposited per asset ──
    mapping(address => uint256) public totalDeposited;

    // ── Events ──
    event Deposited(address indexed user, address indexed asset, uint256 amount);
    event Withdrawn(address indexed user, address indexed asset, uint256 amount);
    event Rebalanced(uint256 allocMETH, uint256 allocUSDY, uint256 allocUSDC, uint256 allocMUSD);

    // ── Constructor ──
    constructor(
        address _mETH,
        address _USDY,
        address _USDC,
        address _mUSD
    ) {
        owner = msg.sender;

        // Set asset addresses
        mETH = _mETH;
        USDY = _USDY;
        USDC = _USDC;
        mUSD = _mUSD;

        // Set default allocation: 38 / 26 / 20 / 16
        allocMETH = 38;
        allocUSDY = 26;
        allocUSDC = 20;
        allocMUSD = 16;
    }

    // ── Check if asset is supported ──
    function isSupportedAsset(address asset) internal view returns (bool) {
        return asset == mETH || asset == USDY || asset == USDC || asset == mUSD;
    }

    // ── Deposit ──
    // User calls this to deposit an asset into the vault
    // They must approve the contract first in their wallet
    function deposit(address asset, uint256 amount) external {
        require(isSupportedAsset(asset), "Asset not supported");
        require(amount > 0, "Amount must be greater than zero");

        // Pull tokens from user wallet into the vault
        bool success = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        // Record the user's balance
        userBalance[msg.sender][asset] += amount;
        totalDeposited[asset] += amount;

        emit Deposited(msg.sender, asset, amount);
    }

    // ── Withdraw ──
    // User calls this to withdraw their deposited asset
    function withdraw(address asset, uint256 amount) external {
        require(isSupportedAsset(asset), "Asset not supported");
        require(amount > 0, "Amount must be greater than zero");
        require(userBalance[msg.sender][asset] >= amount, "Insufficient balance");

        // Update balance before transfer to prevent reentrancy
        userBalance[msg.sender][asset] -= amount;
        totalDeposited[asset] -= amount;

        // Send tokens back to user
        bool success = IERC20(asset).transfer(msg.sender, amount);
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, asset, amount);
    }

    // ── Rebalance ──
    // Only the owner (AI agent later) can call this
    // Updates the target allocation percentages
    function rebalance(
        uint256 _allocMETH,
        uint256 _allocUSDY,
        uint256 _allocUSDC,
        uint256 _allocMUSD
    ) external onlyOwner {
        // Allocations must add up to exactly 100
        require(
            _allocMETH + _allocUSDY + _allocUSDC + _allocMUSD == 100,
            "Allocations must sum to 100"
        );

        allocMETH = _allocMETH;
        allocUSDY = _allocUSDY;
        allocUSDC = _allocUSDC;
        allocMUSD = _allocMUSD;

        emit Rebalanced(_allocMETH, _allocUSDY, _allocUSDC, _allocMUSD);
    }

    // ── Read user balance ──
    function getBalance(address user, address asset) external view returns (uint256) {
        return userBalance[user][asset];
    }

    // ── Read current allocation ──
    function getAllocation() external view returns (uint256, uint256, uint256, uint256) {
        return (allocMETH, allocUSDY, allocUSDC, allocMUSD);
    }

    // ── Read total vault balance per asset ──
    function getTotalDeposited(address asset) external view returns (uint256) {
        return totalDeposited[asset];
    }
}