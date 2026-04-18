// Usage: MARKET_ID=0 OUTCOME=1 npx hardhat run scripts/resolve-market.js --network polygon
// OUTCOME: 1 = YES wins, 2 = NO wins
const hre = require("hardhat");

async function main() {
  const marketId = parseInt(process.env.MARKET_ID || "0");
  const outcome = parseInt(process.env.OUTCOME || "1");
  
  console.log(`Resolving market #${marketId} with outcome ${outcome === 1 ? 'YES' : 'NO'}...`);

  const betlyAddr = "0xcCD35b36845371299C34A66AB9548857c10317e4";
  const betly = await hre.ethers.getContractAt("BetlyYield", betlyAddr);

  // Check current state
  const m = await betly.getMarket(marketId);
  console.log("Current status:", m.status, "tYes:", m.tYes.toString(), "tNo:", m.tNo.toString());
  
  if (m.status !== 0n) {
    console.log("Market already resolved/cancelled!");
    return;
  }

  const tx = await betly.resolve(marketId, outcome);
  const receipt = await tx.wait();
  console.log("Resolved! tx:", receipt.hash);
  
  // Verify
  const after = await betly.getMarket(marketId);
  console.log("New status:", after.status, "outcome:", after.outcome);
}

main().catch(e => { console.error(e); process.exitCode = 1; });
