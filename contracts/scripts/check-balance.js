const { ethers } = require("hardhat");
async function main() {
  const [d] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(d.address);
  console.log("Deployer:", d.address);
  console.log("MATIC:", ethers.formatEther(bal));
}
main().catch(console.error);
