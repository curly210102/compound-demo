import cTokenAbi from "../../abis/BfErc20.json";
import compAbi from "../../abis/BfComptroller.json";
import erc20Abi from "../../abis/erc20.json";
import priceOracleAbi from "../../abis/BfPriceOracle.json";

export default {
  abi: {
    token: cTokenAbi,
    comp: compAbi,
    erc20: erc20Abi,
    priceOracle: priceOracleAbi,
  },
  contractAddress: {
    comp: "0xADdC4b0d9A113D6295D95c9717D1b32b6b689FAE",
  },
  rewardTokenAddress: "0x153478A3898852B29C5adaA85a2619E8C6832917",
  assets: {
    BTC: {
      underlyingAddress: "0x9c4b3321B7150b231cAaA7c6Ba8C1cDc2BDb2F83",
      address: "0x153478A3898852B29C5adaA85a2619E8C6832917",
      decimals: 8,
      underlyingDecimals: 18,
      native: false,
    },
    MATIC: {
      underlyingAddress: "",
      address: "0xf5c9Dbf75A3DB8e67F83B6F8F0aab70f3094A736",
      decimals: 8,
      underlyingDecimals: 18,
      native: true,
    },
    BON: {
      underlyingAddress: "0x9c4b3321B7150b231cAaA7c6Ba8C1cDc2BDb2F83",
      address: "0x153478A3898852B29C5adaA85a2619E8C6832917",
      decimals: 8,
      underlyingDecimals: 18,
      native: false,
    },
  } as const,
  markets: ["BTC", "MATIC"] as const,
  provider: "https://matic-mumbai.chainstacklabs.com",
  privateKey:
    "abdbe6420ebba257b82c2fa7272a8f02c05033d285576b5e8edd34316fae07af",
  rewards: ["BON"] as const,
  testToken: "BTC" as const,
};
