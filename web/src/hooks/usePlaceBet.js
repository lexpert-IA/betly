import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits } from 'viem';
import { getAddresses, BETLY_MARKET_ABI, ERC20_ABI, Outcome } from '../lib/contracts';

/**
 * Hook to place an on-chain bet.
 * Flow: check allowance → approve USDC if needed → call placeBet on BetlyMarket
 *
 * @returns { placeBet, status, error, txHash }
 *   status: 'idle' | 'approving' | 'betting' | 'success' | 'error'
 */
export function usePlaceBet() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [status, setStatus] = useState('idle');
  const [error, setError]   = useState(null);
  const [txHash, setTxHash] = useState(null);

  async function placeBet(onChainMarketId, side, amountUsdc) {
    setStatus('idle');
    setError(null);
    setTxHash(null);

    try {
      if (!address || !walletClient) throw new Error('Connecte ton wallet');
      const addrs = getAddresses(chainId);
      if (!addrs) throw new Error('Réseau non supporté. Switch sur Polygon Amoy.');

      const amount = parseUnits(String(amountUsdc), 6); // USDC = 6 decimals
      const sideEnum = side === 'YES' ? Outcome.YES : Outcome.NO;

      // 1. Check allowance
      const allowance = await publicClient.readContract({
        address: addrs.usdc,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, addrs.betlyMarket],
      });

      // 2. Approve if needed
      if (allowance < amount) {
        setStatus('approving');
        const approveTx = await walletClient.writeContract({
          address: addrs.usdc,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [addrs.betlyMarket, amount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      // 3. Place bet
      setStatus('betting');
      const betTx = await walletClient.writeContract({
        address: addrs.betlyMarket,
        abi: BETLY_MARKET_ABI,
        functionName: 'bet',
        args: [BigInt(onChainMarketId), sideEnum, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: betTx });

      setTxHash(betTx);
      setStatus('success');
      return betTx;
    } catch (err) {
      setError(err.shortMessage || err.message || 'Transaction échouée');
      setStatus('error');
      throw err;
    }
  }

  return { placeBet, status, error, txHash };
}
