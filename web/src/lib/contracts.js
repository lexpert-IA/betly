// ── Contract addresses ───────────────────────────────────────────────────────
export const AMOY = {
  betlyMarket: '0x6A7C077B22D2bED9a0108Ff233c80D04E2DEBab9',
  mockUsdc:    '0x8bf84fd7efE6619545aB503d8e4f7018a61a6f16',
};

export const POLYGON = {
  betlyMarket: '0x8bf84fd7efE6619545aB503d8e4f7018a61a6f16',
  usdc:        '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
};

export function getAddresses(chainId) {
  if (chainId === 80002) return { betlyMarket: AMOY.betlyMarket, usdc: AMOY.mockUsdc };
  if (chainId === 137)   return { betlyMarket: POLYGON.betlyMarket, usdc: POLYGON.usdc };
  return null;
}

export const Outcome = { NONE: 0, YES: 1, NO: 2 };

// ── BetlyLite ABI (matches deployed contract) ───────────────────────────────
export const BETLY_MARKET_ABI = [
  // Read
  { inputs: [{ name: '_id', type: 'uint256' }], name: 'getMarket', outputs: [{ components: [{ name: 'deadline', type: 'uint256' }, { name: 'status', type: 'uint8' }, { name: 'outcome', type: 'uint8' }, { name: 'tYes', type: 'uint256' }, { name: 'tNo', type: 'uint256' }], name: '', type: 'tuple' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '_id', type: 'uint256' }, { name: '_u', type: 'address' }], name: 'getUserBets', outputs: [{ components: [{ name: 'amount', type: 'uint128' }, { name: 'side', type: 'uint8' }, { name: 'claimed', type: 'bool' }], name: '', type: 'tuple[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'mid', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  // Write
  { inputs: [{ name: '_id', type: 'uint256' }, { name: '_side', type: 'uint8' }, { name: '_amt', type: 'uint256' }], name: 'bet', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '_id', type: 'uint256' }], name: 'claim', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  // Events
  { anonymous: false, inputs: [{ indexed: true, name: 'id', type: 'uint256' }, { indexed: true, name: 'u', type: 'address' }, { indexed: false, name: 'side', type: 'uint8' }, { indexed: false, name: 'amt', type: 'uint256' }], name: 'BetPlaced', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'id', type: 'uint256' }, { indexed: false, name: 'outcome', type: 'uint8' }], name: 'Resolved', type: 'event' },
];

export const ERC20_ABI = [
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'mint', outputs: [], stateMutability: 'nonpayable', type: 'function' },
];
