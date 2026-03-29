import { useState, useEffect } from 'react';
import { createPublicClient, http, formatUnits } from 'viem';
import { polygon } from 'viem/chains';

const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const USDC_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const publicClient = createPublicClient({
  chain: polygon,
  transport: http(),
});

export function useUsdcBalance(address, pollInterval = 10000) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchBalance() {
    if (!address) return;
    setLoading(true);
    try {
      const raw = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [address],
      });
      setBalance(formatUnits(raw, 6));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!address) return;
    fetchBalance();
    const t = setInterval(fetchBalance, pollInterval);
    return () => clearInterval(t);
  }, [address, pollInterval]);

  return { balance, loading, refetch: fetchBalance };
}
