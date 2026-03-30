const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const betlyAddr = "0xcCD35b36845371299C34A66AB9548857c10317e4";
  const betly = await hre.ethers.getContractAt("BetlyYield", betlyAddr);

  const admin = await betly.admin();
  console.log("Admin:", admin);
  const usdc = await betly.usdc();
  console.log("USDC:", usdc);

  const markets = [
    { days: 30 },
    { days: 90 },
    { days: 60 },
    { days: 365 },
    { days: 180 },
    { days: 30 },
  ];

  for (let i = 0; i < markets.length; i++) {
    const dl = Math.floor(Date.now() / 1000) + markets[i].days * 86400;
    console.log("Creating market #" + i + "...");
    const tx = await betly.create(dl, { gasLimit: 100000 });
    const receipt = await tx.wait();
    console.log("Market #" + i + " created — gas: " + receipt.gasUsed);
  }

  const currentMid = await betly.mid();
  console.log("\nTotal markets: " + currentMid);

  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Remaining: " + hre.ethers.formatEther(bal) + " POL");
}

main().catch(e => { console.error(e); process.exitCode = 1; });
