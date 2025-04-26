import {
  createNft, //function to create the NFT using the metapletex library
  fetchDigitalAsset, // Function to fetch NFT data after creation
  mplTokenMetadata, // The main Metaplex Token Metadata program 
   
} from "@metaplex-foundation/mpl-token-metadata";

// Importing necessary modules from Umi to interact with Solana
import {
  generateSigner, // Function to generate a new signer for the collection mint (unique identifiers for NFTs) 
  percentAmount,
  PublicKey as UmiPublicKey,
  Umi, 
} from "@metaplex-foundation/umi";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"; // Creates a Umi instance for Solana
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';

import {
  Connection, // Establishes connection to Solana network
  LAMPORTS_PER_SOL, // Represents the smallest unit of SOL (1 SOL = 1e9 lamports)
  clusterApiUrl
} from "@solana/web3.js"; // Provides access to Solana's API and network clusters

import { WalletContextState, useWallet } from '@solana/wallet-adapter-react';

// Interface for collection creation parameters 
export interface CreateCollectionParams {
  name: string;
  symbol: string;
  metadataUri: string;
}

async function waitForDigitalAsset(umi: Umi , mintAddress: UmiPublicKey, retries = 5, delayMs = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const asset = await fetchDigitalAsset(umi, mintAddress);
      return asset;
    } catch (err: any) {
      if (i === retries - 1) throw err;
      console.log(`⏳ Waiting for mint account to appear... retry ${i + 1}/${retries}`);
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
}


async function createCollection(wallet: WalletContextState, params: CreateCollectionParams) {
  try {

    if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
      throw new Error("Wallet not connected  or missing required capabilities !!!.");
    }

  
    // Set up connection to Solana devnet
    const connection = new Connection(clusterApiUrl("devnet"));
    console.log("Using wallet address:", wallet.publicKey.toBase58());

    /*
    Check and airdrop SOL (for devnet testing) 
    Get the current balance of the user's wallet 
    */

    const balance = await connection.getBalance(wallet.publicKey);
    // Compare the balance with the required amount (0.5 SOL)
    if (balance < 0.5 * LAMPORTS_PER_SOL) {
      console.log("Airdropping 1 SOL...");
      // Request 1 SOL from devnet faucet
      const signature = await connection.requestAirdrop(
        wallet.publicKey,
        LAMPORTS_PER_SOL
      );
      //wait for the transaction to be confirmed
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature: signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      });
    }


    /*
    Set up Umi instance to interact with Solana blockchain
    Umi is Metaplex's framework that makes it easier to interact with Solana 
    -> this set up allow the Umi know who I am and what program should use*/

    //create the new umi instance which will comunicate with the Solana blockchain
    const umi = createUmi(connection.rpcEndpoint);
    umi.use(walletAdapterIdentity(wallet));
    // This adds NFT-specific functionality to Umi
    umi.use(mplTokenMetadata());

    console.log("Creating collection...");


    // Generate a new signer (new unique identifier) for the collection
    const collectionMint = generateSigner(umi);

    
    // Create the collection NFT
    
    const transaction = createNft(umi, {
      mint: collectionMint,
      name: params.name,
      symbol: params.symbol,
      uri: params.metadataUri,
      sellerFeeBasisPoints: percentAmount(0), // 0% royalties
      isCollection: true, // This marks it as a collection
    });

    //Send and confirm the transaction
    const tx = await transaction.sendAndConfirm(umi);
    console.log("Transaction signature:", tx.signature);


    // Fetch the created collection details
    //const createdCollection = await fetchDigitalAsset(umi, collectionMint.publicKey);
    const createdCollection = await waitForDigitalAsset(umi, collectionMint.publicKey);

    // Fetch metadata JSON from the URI
    if (!createdCollection) {
        throw new Error('Failed to fetch collection data');
    }
    const metadataUri = createdCollection.metadata.uri;
    const response = await fetch(metadataUri);
    const metadataJson = await response.json();
    // Extract custom properties and attributes from metadata
    const attributes = metadataJson.attributes;
    const properties = metadataJson.properties;
  

    // // Log the collection details
    // console.log("✅ Collection created successfully!");
    // console.log("Collection Address:", collectionMint.publicKey);
    // console.log("Collection Name:", params.name);
    // console.log("Collection Symbol:", params.symbol);
    // console.log("Collecion: ", collectionMint);

    return {
      collectionAddress: collectionMint.publicKey,
      name: params.name,
      symbol: params.symbol,
      mint: collectionMint,
      attributes: attributes,
      properties: properties,
    };

  } catch (error) {
    console.error("Error creating collection:", error);
    throw error;
  }
}

export default  createCollection ;

// // Example usage
// async function main() {

//   const collectionParams: CreateCollectionParams = {
//     name: "Coca",
//     symbol: "Coa",
//     metadataUri: "https://coffee-passive-spider-608.mypinata.cloud/ipfs/bafkreieufz64ltcshlhtfnxrddlfwckl4gna2lwvhkrd2plgxaocyzp7lm", // Replace with your actual metadata URI
//   };

//   try {
//     const result = await createCollection(collectionParams);
//     console.log("Collection created with address:", result.collectionAddress);
  
//     result.attributes.forEach((attr: { trait_type: any; value: any; }) => {
//       console.log(`${attr.trait_type}: ${attr.value}`);
//     });

//   } catch (error) {
//     console.error("Failed to create collection:", error);
//   }
// }

// // Run the main function
// main();