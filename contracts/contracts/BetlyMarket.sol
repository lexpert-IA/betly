// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title BetlyMarket — Binary prediction market with USDC
/// @notice Each market has YES/NO outcomes. Users bet USDC. Admin resolves. Winners claim proportional payout minus 2% fee.
contract BetlyMarket {
    using SafeERC20 for IERC20;

    // ── Types ────────────────────────────────────────────────────────────────
    enum Outcome { NONE, YES, NO }
    enum Status  { OPEN, RESOLVED, CANCELLED }

    struct Market {
        string   title;
        uint256  deadline;       // after this, no new bets
        Status   status;
        Outcome  outcome;
        uint256  totalYes;       // total USDC on YES
        uint256  totalNo;        // total USDC on NO
    }

    struct Bet {
        uint256 amount;
        Outcome side;
        bool    claimed;
    }

    // ── State ────────────────────────────────────────────────────────────────
    address public admin;
    IERC20  public usdc;
    uint256 public feeBps = 200; // 2%
    uint256 public nextMarketId;

    mapping(uint256 => Market) public markets;
    // marketId => user => Bet[]
    mapping(uint256 => mapping(address => Bet[])) public bets;

    // ── Events ───────────────────────────────────────────────────────────────
    event MarketCreated(uint256 indexed id, string title, uint256 deadline);
    event BetPlaced(uint256 indexed marketId, address indexed user, Outcome side, uint256 amount);
    event MarketResolved(uint256 indexed marketId, Outcome outcome);
    event MarketCancelled(uint256 indexed marketId);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 payout);
    event Refunded(uint256 indexed marketId, address indexed user, uint256 amount);

    // ── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor(address _usdc) {
        admin = msg.sender;
        usdc  = IERC20(_usdc);
    }

    // ── Create market ────────────────────────────────────────────────────────
    function createMarket(string calldata _title, uint256 _deadline) external onlyAdmin returns (uint256 id) {
        require(_deadline > block.timestamp, "Deadline in past");
        id = nextMarketId++;
        markets[id] = Market({
            title:    _title,
            deadline: _deadline,
            status:   Status.OPEN,
            outcome:  Outcome.NONE,
            totalYes: 0,
            totalNo:  0
        });
        emit MarketCreated(id, _title, _deadline);
    }

    // ── Place bet ────────────────────────────────────────────────────────────
    function placeBet(uint256 _marketId, Outcome _side, uint256 _amount) external {
        Market storage m = markets[_marketId];
        require(m.status == Status.OPEN, "Market not open");
        require(block.timestamp < m.deadline, "Market expired");
        require(_side == Outcome.YES || _side == Outcome.NO, "Invalid side");
        require(_amount > 0, "Zero amount");

        usdc.safeTransferFrom(msg.sender, address(this), _amount);

        bets[_marketId][msg.sender].push(Bet({
            amount:  _amount,
            side:    _side,
            claimed: false
        }));

        if (_side == Outcome.YES) {
            m.totalYes += _amount;
        } else {
            m.totalNo += _amount;
        }

        emit BetPlaced(_marketId, msg.sender, _side, _amount);
    }

    // ── Resolve market ───────────────────────────────────────────────────────
    function resolveMarket(uint256 _marketId, Outcome _outcome) external onlyAdmin {
        Market storage m = markets[_marketId];
        require(m.status == Status.OPEN, "Not open");
        require(_outcome == Outcome.YES || _outcome == Outcome.NO, "Invalid outcome");
        m.status  = Status.RESOLVED;
        m.outcome = _outcome;
        emit MarketResolved(_marketId, _outcome);
    }

    // ── Cancel market (full refund) ──────────────────────────────────────────
    function cancelMarket(uint256 _marketId) external onlyAdmin {
        Market storage m = markets[_marketId];
        require(m.status == Status.OPEN, "Not open");
        m.status = Status.CANCELLED;
        emit MarketCancelled(_marketId);
    }

    // ── Claim winnings ───────────────────────────────────────────────────────
    function claimWinnings(uint256 _marketId) external {
        Market storage m = markets[_marketId];
        require(m.status == Status.RESOLVED, "Not resolved");

        Bet[] storage userBets = bets[_marketId][msg.sender];
        uint256 totalPayout = 0;
        uint256 totalPool = m.totalYes + m.totalNo;
        uint256 winPool   = m.outcome == Outcome.YES ? m.totalYes : m.totalNo;

        for (uint256 i = 0; i < userBets.length; i++) {
            if (userBets[i].claimed) continue;
            userBets[i].claimed = true;

            if (userBets[i].side == m.outcome) {
                // Winner: proportional share of total pool minus fee
                uint256 gross = (userBets[i].amount * totalPool) / winPool;
                uint256 fee   = (gross * feeBps) / 10000;
                totalPayout  += gross - fee;
            }
            // Losers get nothing
        }

        require(totalPayout > 0, "Nothing to claim");
        usdc.safeTransfer(msg.sender, totalPayout);
        emit WinningsClaimed(_marketId, msg.sender, totalPayout);
    }

    // ── Claim refund (cancelled market) ──────────────────────────────────────
    function claimRefund(uint256 _marketId) external {
        Market storage m = markets[_marketId];
        require(m.status == Status.CANCELLED, "Not cancelled");

        Bet[] storage userBets = bets[_marketId][msg.sender];
        uint256 totalRefund = 0;

        for (uint256 i = 0; i < userBets.length; i++) {
            if (userBets[i].claimed) continue;
            userBets[i].claimed = true;
            totalRefund += userBets[i].amount;
        }

        require(totalRefund > 0, "Nothing to refund");
        usdc.safeTransfer(msg.sender, totalRefund);
        emit Refunded(_marketId, msg.sender, totalRefund);
    }

    // ── View helpers ─────────────────────────────────────────────────────────
    function getMarket(uint256 _id) external view returns (Market memory) {
        return markets[_id];
    }

    function getUserBets(uint256 _marketId, address _user) external view returns (Bet[] memory) {
        return bets[_marketId][_user];
    }

    function getBetCount(uint256 _marketId, address _user) external view returns (uint256) {
        return bets[_marketId][_user].length;
    }

    // ── Admin ────────────────────────────────────────────────────────────────
    function setFeeBps(uint256 _feeBps) external onlyAdmin {
        require(_feeBps <= 1000, "Fee too high"); // max 10%
        feeBps = _feeBps;
    }

    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Zero address");
        admin = _newAdmin;
    }

    function withdrawFees(address _to, uint256 _amount) external onlyAdmin {
        usdc.safeTransfer(_to, _amount);
    }
}
