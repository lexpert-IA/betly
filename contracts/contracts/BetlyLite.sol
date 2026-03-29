// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title BetlyLite — Minimal binary prediction market
contract BetlyLite {
    IERC20 public usdc;
    address public admin;
    uint256 public mid; // next market id

    struct Market {
        uint256 deadline;
        uint8 status;   // 0=open, 1=resolved, 2=cancelled
        uint8 outcome;  // 0=none, 1=yes, 2=no
        uint256 tYes;
        uint256 tNo;
    }

    struct Bet {
        uint128 amount;
        uint8 side;
        bool claimed;
    }

    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Bet[])) public bets;

    event BetPlaced(uint256 indexed id, address indexed u, uint8 side, uint256 amt);
    event Resolved(uint256 indexed id, uint8 outcome);

    modifier onlyAdmin() { require(msg.sender == admin); _; }

    constructor(address _usdc) { admin = msg.sender; usdc = IERC20(_usdc); }

    function create(uint256 _dl) external onlyAdmin returns (uint256) {
        markets[mid] = Market(_dl, 0, 0, 0, 0);
        return mid++;
    }

    function bet(uint256 _id, uint8 _side, uint256 _amt) external {
        Market storage m = markets[_id];
        require(m.status == 0 && block.timestamp < m.deadline && _amt > 0);
        require(_side == 1 || _side == 2);
        usdc.transferFrom(msg.sender, address(this), _amt);
        bets[_id][msg.sender].push(Bet(uint128(_amt), _side, false));
        if (_side == 1) m.tYes += _amt; else m.tNo += _amt;
        emit BetPlaced(_id, msg.sender, _side, _amt);
    }

    function resolve(uint256 _id, uint8 _out) external onlyAdmin {
        Market storage m = markets[_id];
        require(m.status == 0 && (_out == 1 || _out == 2));
        m.status = 1; m.outcome = _out;
        emit Resolved(_id, _out);
    }

    function cancel(uint256 _id) external onlyAdmin {
        require(markets[_id].status == 0);
        markets[_id].status = 2;
    }

    function claim(uint256 _id) external {
        Market storage m = markets[_id];
        require(m.status == 1 || m.status == 2);
        Bet[] storage ub = bets[_id][msg.sender];
        uint256 pay;
        for (uint i; i < ub.length; i++) {
            if (ub[i].claimed) continue;
            ub[i].claimed = true;
            if (m.status == 2) { pay += ub[i].amount; continue; } // refund
            if (ub[i].side == m.outcome) {
                uint256 pool = m.tYes + m.tNo;
                uint256 win = m.outcome == 1 ? m.tYes : m.tNo;
                uint256 gross = (ub[i].amount * pool) / win;
                pay += gross * 98 / 100; // 2% fee
            }
        }
        require(pay > 0);
        usdc.transfer(msg.sender, pay);
    }

    function getUserBets(uint256 _id, address _u) external view returns (Bet[] memory) {
        return bets[_id][_u];
    }

    function getMarket(uint256 _id) external view returns (Market memory) {
        return markets[_id];
    }
}
