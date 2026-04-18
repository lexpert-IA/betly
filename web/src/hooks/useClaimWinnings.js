import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { getAddresses, BETLY_MARKET_ABI } from '../lib/contracts';

/**
 * Claim winnings (or refund if cancelled) from a resolved on-chain market.
 */
export function useClaimWinnings() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [status, setStatus] = useState('idle');
  const [error, setError]   = useState(null);

  async function claim(onChainMarketId, isCancelled = false) {
    setStatus('claiming');
    setError(null);

    try {
      if (!address || !walletClient) throw new Error('Connecte ton wallet');
      const addrs = getAddresses(chainId);
      if (!addrs) throw new Error('Réseau non supporté');

      const tx = await walletClient.writeContract({
        address: addrs.betlyMarket,
        abi: BETLY_MARKET_ABI,
        functionName: 'claim',
        args: [BigInt(onChainMarketId)],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });

      setStatus('success');
      return tx;
    } catch (err) {
      setError(err.shortMessage || err.message);
      setStatus('error');
      throw err;
    }
  }

  return { claim, status, error };
}
