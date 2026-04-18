const { ethers } = require('hardhat');
async function main() {
  const contract = await ethers.getContractAt('BetlyYield', '0xcCD35b36845371299C34A66AB9548857c10317e4');
  const m = await contract.getMarket(3);
  console.log('On-chain Market 3 raw:', m);
}
main();
