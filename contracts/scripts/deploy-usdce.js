const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // USDC.e (bridged PoS) — what users actually have
  const usdcAddr = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

  const BetlyLite = await hre.ethers.getContractFactory("BetlyLite");
  const betly = await BetlyLite.deploy(usdcAddr);
  await betly.waitForDeployment();
  const betlyAddr = await betly.getAddress();
  console.log("BetlyLite (USDC.e) deployed:", betlyAddr);

  // Create 6 markets
  const markets = [
    { days: 30 },  // #0 Bitcoin
    { days: 90 },  // #1 Euro 2026
    { days: 60 },  // #2 ChatGPT-5
    { days: 365 }, // #3 Macron
    { days: 180 }, // #4 Severance
    { days: 30 },  // #5 ETH/BTC
  ];
  for (let i = 0; i < markets.length; i++) {
    const dl = Math.floor(Date.now() / 1000) + markets[i].days * 86400;
    const tx = await betly.create(dl);
    await tx.wait();
    console.log(`Market #${i} created`);
  }

  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("\n=== DONE ===");
  console.log(`BetlyLite:  ${betlyAddr}`);
  console.log(`USDC.e:     ${usdcAddr}`);
  console.log(`Remaining:  ${hre.ethers.formatEther(bal)} POL`);
}

main().catch(e => { console.error(e); process.exitCode = 1; });
