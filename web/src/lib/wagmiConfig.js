import { createConfig } from 'wagmi';
import { polygon } from 'viem/chains';
import { http } from 'viem';
import { QueryClient } from '@tanstack/react-query';

export const wagmiConfig = createConfig({
  chains: [polygon],
  transports: {
    [polygon.id]: http('https://polygon-bor-rpc.publicnode.com'),
  },
  multiInjectedProviderDiscovery: false,
});

export const queryClient = new QueryClient();
