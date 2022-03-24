import { Wallet, Contract, providers } from "ethers";
import config from "../configs";
const provider = new providers.JsonRpcProvider(config.provider);
// Just Test Account
const privateKey = config.privateKey;

const wallet = new Wallet(privateKey, provider);

export const myWalletAddress = wallet.address;

export default function getContract(address: string, abi: any) {
  return new Contract(address, abi, provider.getSigner(wallet.address));
}

export function getComptroller() {
  return getContract(config.contractAddress.comp, config.abi.comp);
}

export function getTokenContract(contractAddress: string) {
  return getContract(contractAddress, config.abi.token);
}
