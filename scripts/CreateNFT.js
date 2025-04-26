import {
    createNft,
    fetchDigitalAsset,
    mplTokenMetadata,
  } from "@metaplex-foundation/mpl-token-metadata";
  
  import {
    generateSigner,
    percentAmount,
  } from "@metaplex-foundation/umi";
  
  import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
  import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
  import {
    Connection,
    LAMPORTS_PER_SOL,
    clusterApiUrl,
  } from "@solana/web3.js";
  
  /**
   * Helper function to wait until the digital asset appears on-chain
   */
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
  
  /**
   * Main function to create an NFT
   * 
   * @param {object} wallet - Wallet adapter object (must be connected)
   * @param {object} params - NFT params: { name, symbol, metadataUri, collectionMint }
   */
  const createNFT = async (wallet, params) => {
    if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
      throw new Error("Wallet not connected or missing required capabilities.");
    }
  
    const connection = new Connection(clusterApiUrl("devnet"));
    console.log("Using wallet address:", wallet.publicKey.toBase58());
  
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    if (balance < 0.5 * LAMPORTS_PER_SOL) {
      console.log('Airdropping SOL to wallet...');
      const signature = await connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL);
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });
    }
  
    const umi = createUmi(connection.rpcEndpoint)
      .use(walletAdapterIdentity(wallet))
      .use(mplTokenMetadata());
  
    const NFTMint = generateSigner(umi);
  
    try {
      const transaction = createNft(umi, {
        mint: NFTMint,
        name: params.name,
        symbol: params.symbol,
        uri: params.metadataUri,
        sellerFeeBasisPoints: percentAmount(0),
        collection: {
          key: params.collectionMint,
          verified: false,
        },
      });
  
      const tx = await transaction.sendAndConfirm(umi);
      console.log("Transaction signature:", tx.signature);
  
      const createdNFT = await waitForDigitalAsset(umi, NFTMint.publicKey);
      if (!createdNFT) {
        throw new Error('Failed to fetch NFT data');
      }
  
      console.log(
        `🖼️ Created NFT! View on Explorer: https://explorer.solana.com/address/${createdNFT.mint.publicKey}?cluster=devnet`
      );
  
      const metadataUri = createdNFT.metadata.uri;
      const response = await fetch(metadataUri);
      const metadataJson = await response.json();
  
      const result = {
        nftAddress: NFTMint.publicKey,
        name: params.name,
        symbol: params.symbol,
        mint: NFTMint,
        creator: wallet.publicKey.toString(),
        attributes: metadataJson.attributes,
        properties: metadataJson.properties,
        transactionSignature: tx.signature,
      };
  
      return result;
    } catch (error) {
      console.error("Error creating NFT:", error);
      throw error;
    }
  };
  
  export default createNFT;
  