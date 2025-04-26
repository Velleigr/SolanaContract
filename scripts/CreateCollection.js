import {
  createNft,
  fetchDigitalAsset,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";

import {
  generateSigner,
  percentAmount,
  PublicKey,
  createUmi,
} from "@metaplex-foundation/umi";

import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";

import {
  Connection,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";

async function waitForDigitalAsset(umi, mintAddress, retries = 5, delayMs = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const asset = await fetchDigitalAsset(umi, mintAddress);
      return asset;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`⏳ Waiting for mint account to appear... retry ${i + 1}/${retries}`);
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
}

async function createCollection(wallet, params) {
  try {
    if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
      throw new Error("Wallet not connected or missing required capabilities.");
    }

    const connection = new Connection(clusterApiUrl("devnet"));
    console.log("Using wallet address:", wallet.publicKey.toBase58());

    const balance = await connection.getBalance(wallet.publicKey);
    if (balance < 0.5 * LAMPORTS_PER_SOL) {
      console.log("Airdropping 1 SOL...");
      const signature = await connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL);
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      });
    }

    const umi = createUmi(connection.rpcEndpoint);
    umi.use(walletAdapterIdentity(wallet));
    umi.use(mplTokenMetadata());

    console.log("Creating collection...");
    const collectionMint = generateSigner(umi);

    const transaction = createNft(umi, {
      mint: collectionMint,
      name: params.name,
      symbol: params.symbol,
      uri: params.metadataUri,
      sellerFeeBasisPoints: percentAmount(0),
      isCollection: true,
    });

    const tx = await transaction.sendAndConfirm(umi);
    console.log("Transaction signature:", tx.signature);

    const createdCollection = await waitForDigitalAsset(umi, collectionMint.publicKey);

    if (!createdCollection) {
      throw new Error("Failed to fetch collection data");
    }

    const metadataUri = createdCollection.metadata.uri;
    const response = await fetch(metadataUri);
    const metadataJson = await response.json();

    const attributes = metadataJson.attributes;
    const properties = metadataJson.properties;

    return {
      collectionAddress: collectionMint.publicKey,
      name: params.name,
      symbol: params.symbol,
      mint: collectionMint,
      attributes,
      properties,
    };

  } catch (error) {
    console.error("Error creating collection:", error);
    throw error;
  }
}

export default createCollection;
