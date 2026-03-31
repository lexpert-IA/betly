import { useState, useEffect } from 'react';
import { createPublicClient, http, formatUnits } from 'viem';
import { polygon } from 'viem/chains';

const USDC_NATIVE  = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // USDC native Polygon
const USDC_BRIDGED = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e bridged

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
  const [nativeBalance, setNativeBalance] = useState(null);
  const [bridgedBalance, setBridgedBalance] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchBalance() {
    if (!address) return;
    setLoading(true);
    try {
      const [rawNative, rawBridged] = await Promise.all([
        publicClient.readContract({
          address: USDC_NATIVE,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [address],
        }),
        publicClient.readContract({
          address: USDC_BRIDGED,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [address],
        }),
      ]);
      const native = parseFloat(formatUnits(rawNative, 6));
      const bridged = parseFloat(formatUnits(rawBridged, 6));
      setNativeBalance(native);
      setBridgedBalance(bridged);
      setBalance((native + bridged).toFixed(6));
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

  return { balance, nativeBalance, bridgedBalance, loading, refetch: fetchBalance };
}
