import { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { getAddresses, BETLY_MARKET_ABI } from '../lib/contracts';

/**
 * Read on-chain market state (totalYes, totalNo, status, outcome, deadline).
 */
export function useMarketOnChain(onChainMarketId) {
  const { chainId } = useAccount();
  const publicClient = usePublicClient();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (onChainMarketId == null || !publicClient) return;

    const addrs = getAddresses(chainId);
    if (!addrs) { setLoading(false); return; }

    let cancelled = false;

    async function fetch() {
      try {
        const raw = await publicClient.readContract({
          address: addrs.betlyMarket,
          abi: BETLY_MARKET_ABI,
          functionName: 'getMarket',
          args: [BigInt(onChainMarketId)],
        });
        if (cancelled) return;
        setData({
          deadline: Number(raw.deadline),
          status:   ['OPEN', 'RESOLVED', 'CANCELLED'][Number(raw.status)],
          outcome:  ['NONE', 'YES', 'NO'][Number(raw.outcome)],
          totalYes: parseFloat(formatUnits(raw.tYes, 6)),
          totalNo:  parseFloat(formatUnits(raw.tNo, 6)),
        });
      } catch {
        // contract not deployed or wrong chain
      }
      setLoading(false);
    }

    fetch();
    const t = setInterval(fetch, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, [onChainMarketId, chainId, publicClient]);

  return { data, loading };
}
