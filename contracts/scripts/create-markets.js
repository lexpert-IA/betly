const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const betly = await hre.ethers.getContractAt("BetlyLite", "0x8bf84fd7efE6619545aB503d8e4f7018a61a6f16");

  // Market #0 already exists (Bitcoin > 150k)
  // Create markets #1-#5
  const markets = [
    { title: "France Euro 2026", days: 90 },
    { title: "ChatGPT-5 avant septembre 2025", days: 60 },
    { title: "Macron finit son mandat", days: 365 },
    { title: "Severance S3 avant 2026", days: 180 },
    { title: "ETH/BTC ratio > 0.05", days: 30 },
  ];

  for (let i = 0; i < markets.length; i++) {
    const deadline = Math.floor(Date.now() / 1000) + markets[i].days * 24 * 3600;
    const tx = await betly.create(deadline);
    await tx.wait();
    console.log(`Market #${i + 1} created: ${markets[i].title} (deadline: ${new Date(deadline * 1000).toISOString().slice(0, 10)})`);
  }

  const total = await betly.mid();
  console.log(`\nTotal markets on-chain: ${total}`);

  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Remaining POL: ${hre.ethers.formatEther(bal)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
