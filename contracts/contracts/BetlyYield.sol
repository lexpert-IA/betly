// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Minimal Aave V3 Pool interface (supply + withdraw only)
interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

/// @title BetlyYield — Binary prediction market with Aave V3 yield
/// @dev USDC deposited via bets is supplied to Aave V3. Yield accrues to the
///      contract and can be harvested by admin. Users always receive exactly
///      their entitled payout — yield is a platform-only revenue stream.
contract BetlyYield is ReentrancyGuard {
    IERC20  public immutable usdc;
    IERC20  public immutable aUsdc;
    IAavePool public immutable aavePool;
    address public admin;
    uint256 public mid; // next market id

    /// @dev Percentage of deposits kept as liquid USDC (not sent to Aave).
    ///      100 = 1%, 1000 = 10%. Basis points (max 10000).
    uint256 public reserveBps = 1000; // 10% default

    /// @dev Total USDC owed to users across all markets (mises + pending payouts).
    uint256 public totalOwed;

    struct Market {
        uint256 deadline;
        uint8 status;   // 0=open, 1=resolved, 2=cancelled
        uint8 outcome;  // 0=none, 1=yes, 2=no
        uint256 tYes;
        uint256 tNo;
    }

    struct UserBet {
        uint128 amount;
        uint8 side;
        bool claimed;
    }

    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => UserBet[])) public bets;

    event BetPlaced(uint256 indexed id, address indexed u, uint8 side, uint256 amt);
    event Resolved(uint256 indexed id, uint8 outcome);
    event YieldHarvested(uint256 amount);

    modifier onlyAdmin() { require(msg.sender == admin, "!admin"); _; }

    constructor(address _usdc, address _aUsdc, address _aavePool) {
        admin = msg.sender;
        usdc = IERC20(_usdc);
        aUsdc = IERC20(_aUsdc);
        aavePool = IAavePool(_aavePool);

        // Approve Aave pool to spend our USDC and aUSDC (infinite approval, standard pattern)
        IERC20(_usdc).approve(_aavePool, type(uint256).max);
        IERC20(_aUsdc).approve(_aavePool, type(uint256).max);
    }

    // ─── Markets ────────────────────────────────────────────────────

    function create(uint256 _dl) external onlyAdmin returns (uint256) {
        markets[mid] = Market(_dl, 0, 0, 0, 0);
        return mid++;
    }

    // ─── Betting ────────────────────────────────────────────────────

    function bet(uint256 _id, uint8 _side, uint256 _amt) external {
        Market storage m = markets[_id];
        require(m.deadline > 0, "!exists");
        require(m.status == 0 && block.timestamp < m.deadline && _amt > 0, "!open");
        require(_side == 1 || _side == 2, "!side");

        usdc.transferFrom(msg.sender, address(this), _amt);
        totalOwed += _amt;

        // Supply to Aave (keep reserve liquid)
        uint256 toSupply = _amt * (10000 - reserveBps) / 10000;
        if (toSupply > 0) {
            aavePool.supply(address(usdc), toSupply, address(this), 0);
        }

        bets[_id][msg.sender].push(UserBet(uint128(_amt), _side, false));
        if (_side == 1) m.tYes += _amt; else m.tNo += _amt;
        emit BetPlaced(_id, msg.sender, _side, _amt);
    }

    // ─── Resolution ─────────────────────────────────────────────────

    function resolve(uint256 _id, uint8 _out) external onlyAdmin {
        Market storage m = markets[_id];
        require(m.deadline > 0, "!exists");
        require(m.status == 0 && (_out == 1 || _out == 2), "!resolve");
        m.status = 1;
        m.outcome = _out;

        // Winners will claim pool * 98/100 total. The 2% fee stays as revenue.
        // Losers can't claim but their deposits fund winners — still "owed".
        // So only subtract the fee portion from totalOwed.
        uint256 pool = m.tYes + m.tNo;
        uint256 fees = pool * 2 / 100;
        totalOwed -= fees;

        emit Resolved(_id, _out);
    }

    function cancel(uint256 _id) external onlyAdmin {
        require(markets[_id].deadline > 0, "!exists");
        require(markets[_id].status == 0, "!cancel");
        markets[_id].status = 2;
    }

    // ─── Claim ──────────────────────────────────────────────────────

    function claim(uint256 _id) external nonReentrant {
        Market storage m = markets[_id];
        require(m.deadline > 0, "!exists");
        require(m.status == 1 || m.status == 2, "!claimable");

        UserBet[] storage ub = bets[_id][msg.sender];
        uint256 pay;

        for (uint i; i < ub.length; i++) {
            if (ub[i].claimed) continue;
            ub[i].claimed = true;

            if (m.status == 2) {
                // Cancelled → full refund
                pay += ub[i].amount;
                continue;
            }
            if (ub[i].side == m.outcome) {
                uint256 pool = m.tYes + m.tNo;
                uint256 win = m.outcome == 1 ? m.tYes : m.tNo;
                uint256 gross = (ub[i].amount * pool) / win;
                pay += gross * 98 / 100; // 2% fee
            }
            // Losers: claimed=true but pay+=0, they just can't call again
        }
        require(pay > 0, "!pay");
        totalOwed -= pay; // reduce by actual payout (resolve already cleaned losers+fees)

        // Ensure we have enough liquid USDC; withdraw from Aave if needed
        uint256 liquid = usdc.balanceOf(address(this));
        if (liquid < pay) {
            aavePool.withdraw(address(usdc), pay - liquid, address(this));
        }
        usdc.transfer(msg.sender, pay);
    }

    // ─── Yield Management ───────────────────────────────────────────

    /// @notice Returns the current yield accumulated (aToken balance minus owed)
    function pendingYield() external view returns (uint256) {
        uint256 total = aUsdc.balanceOf(address(this)) + usdc.balanceOf(address(this));
        if (total <= totalOwed) return 0;
        return total - totalOwed;
    }

    /// @notice Admin harvests accumulated yield to the admin wallet
    function harvestYield() external onlyAdmin nonReentrant {
        uint256 total = aUsdc.balanceOf(address(this)) + usdc.balanceOf(address(this));
        require(total > totalOwed, "!yield");
        uint256 yieldAmt = total - totalOwed;

        // Withdraw yield from Aave as USDC to admin
        uint256 liquid = usdc.balanceOf(address(this));
        if (liquid < yieldAmt) {
            aavePool.withdraw(address(usdc), yieldAmt - liquid, address(this));
        }
        usdc.transfer(admin, yieldAmt);
        emit YieldHarvested(yieldAmt);
    }

    /// @notice Update reserve ratio (basis points, max 5000 = 50%)
    function setReserveBps(uint256 _bps) external onlyAdmin {
        require(_bps <= 5000, "!bps");
        reserveBps = _bps;
    }

    /// @notice Transfer admin role
    function setAdmin(address _new) external onlyAdmin {
        require(_new != address(0), "!zero");
        admin = _new;
    }

    // ─── Views ──────────────────────────────────────────────────────

    function getUserBets(uint256 _id, address _u) external view returns (UserBet[] memory) {
        return bets[_id][_u];
    }

    function getMarket(uint256 _id) external view returns (Market memory) {
        return markets[_id];
    }
}
