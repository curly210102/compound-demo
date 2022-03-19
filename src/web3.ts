import { BigNumber, Wallet, Contract, providers } from "ethers";
import cEthAbi from "./abis/cEth.json";
import cTokenAbi from "./abis/cToken.json";
import Web3 from "web3";
const web3 = new Web3("https://kovan.infura.io/v3/2b17a18942384c25ad91e8636764a89f");
const privateKey =
  "4f4b5c6ddc896de134f2a8e3d0cc5925a15e2b20656eab74f423b31eaf14d69c";
// Mainnet Contract for cUSDT (https://compound.finance/docs#networks)
const cTokenContractAddress = "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9";
const cEthContractAddress = "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5";

const main = async function () {
  const ethMantissa = 1e18;
const blocksPerDay = 6570; // 13.15 seconds per block
const daysPerYear = 365;

const cToken = new web3.eth.Contract(cEthAbi, cEthContractAddress);
const supplyRatePerBlock = await cToken.methods.supplyRatePerBlock().call();
const borrowRatePerBlock = await cToken.methods.borrowRatePerBlock().call();
const supplyApy = (((Math.pow((supplyRatePerBlock / ethMantissa * blocksPerDay) + 1, daysPerYear))) - 1) * 100;
const borrowApy = (((Math.pow((borrowRatePerBlock / ethMantissa * blocksPerDay) + 1, daysPerYear))) - 1) * 100;
console.log(`Supply APY for ETH ${supplyApy} %`);
console.log(`Borrow APY for ETH ${borrowApy} %`);
};

main().catch((err) => {
  console.error(err);
});

function calculateAPY(ratePerBlock: BigNumber) {
  const ethMantissa = 1e18;
  const blocksPerDay = 6570; // 13.15 seconds per block
  const daysPerYear = 365;

  return ratePerBlock
    .div(ethMantissa)
    .mul(blocksPerDay)
    .add(1)
    .pow(daysPerYear)
    .sub(1)
    .mul(100)
    .toString();
}
