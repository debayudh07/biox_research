"use client";
import React, { useState, useCallback, useMemo } from 'react';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { 
  ConnectionProvider, 
  WalletProvider, 
  useConnection, 
  useWallet 
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import {
  WalletModalProvider,
  WalletMultiButton,
  WalletDisconnectButton,
} from '@solana/wallet-adapter-react-ui';

// Token metadata for BIOX Token
const TOKEN_METADATA = {
  name: "BIOX Token",
  symbol: "BIOX",
  description: "BIOX Token - A revolutionary biotechnology token for the future of healthcare and life sciences",
  image: "https://via.placeholder.com/200x200/4F46E5/FFFFFF?text=BIOX",
  decimals: 9,
  website: "https://biox-token.com",
  twitter: "https://twitter.com/biox_token"
};

// Main token minter component
const TokenMinter = () => {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  
  const [status, setStatus] = useState('');
  const [tokenMint, setTokenMint] = useState('');
  const [tokenAccount, setTokenAccount] = useState('');
  const [balance, setBalance] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mintAuthority, setMintAuthority] = useState('');

  // Create token with metadata
  const createBioxToken = useCallback(async () => {
    if (!connection || !publicKey || !signTransaction) {
      setStatus('Please connect your wallet first');
      return;
    }

    try {
      setIsLoading(true);
      setStatus('Creating BIOX Token...');

      // Import required functions for manual transaction creation
      const { 
        SystemProgram, 
        Transaction, 
        Keypair,
        sendAndConfirmTransaction
      } = await import('@solana/web3.js');
      
      const { 
        createInitializeMintInstruction,
        createAssociatedTokenAccountInstruction,
        getAssociatedTokenAddress,
        MINT_SIZE,
        getMinimumBalanceForRentExemptMint
      } = await import('@solana/spl-token');

      // Generate a new keypair for the mint
      const mintKeypair = Keypair.generate();
      
      // Get minimum balance for rent exemption
      const rentExemption = await getMinimumBalanceForRentExemptMint(connection);

      // Create transaction
      const transaction = new Transaction();

      // Add instruction to create account for mint
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports: rentExemption,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      // Add instruction to initialize mint
      transaction.add(
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          TOKEN_METADATA.decimals,
          publicKey, // mint authority
          publicKey  // freeze authority
        )
      );

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign with mint keypair
      transaction.partialSign(mintKeypair);

      // Sign with wallet
      if (!signTransaction) {
        throw new Error('Wallet does not support transaction signing');
      }
      const signedTransaction = await signTransaction(transaction);

      // Send transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature);

      const mintAddress = mintKeypair.publicKey;
      setTokenMint(mintAddress.toString());
      setMintAuthority(publicKey.toString());
      setStatus(`BIOX Token created! Mint address: ${mintAddress.toString()}`);

      // Create metadata account (simplified version)
      await createTokenMetadata(mintAddress);

      // Create associated token account
      setStatus('Creating token account...');
      
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintAddress,
        publicKey
      );

      // Check if account already exists
      const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
      
      if (!accountInfo) {
        // Create associated token account
        const createATATransaction = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            publicKey, // payer
            associatedTokenAddress, // associated token account
            publicKey, // owner
            mintAddress // mint
          )
        );

        const { blockhash: ataBlockhash } = await connection.getLatestBlockhash();
        createATATransaction.recentBlockhash = ataBlockhash;
        createATATransaction.feePayer = publicKey;

        const signedATATransaction = await signTransaction(createATATransaction);
        const ataSignature = await connection.sendRawTransaction(signedATATransaction.serialize());
        await connection.confirmTransaction(ataSignature);
      }

      setTokenAccount(associatedTokenAddress.toString());
      setStatus(`BIOX Token setup complete! Ready to mint tokens.`);

    } catch (error) {
      setStatus(`Error creating BIOX Token: ${error.message}`);
      console.error('Token creation error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [connection, publicKey, signTransaction]);

  // Create metadata for the token (simplified - in production use Metaplex)
  const createTokenMetadata = async (mint) => {
    try {
      setStatus('Adding token metadata for wallet display...');
      
      // In a real implementation, you would use Metaplex Token Metadata
      // For this demo, we'll just store the metadata info
      const metadata = {
        mint: mint.toString(),
        ...TOKEN_METADATA,
        updateAuthority: publicKey?.toString(),
        mintAuthority: publicKey?.toString(),
      };

      // Store metadata (in production, this would be on-chain via Metaplex)
      console.log('Token Metadata:', metadata);
      setStatus('Token metadata prepared for wallet display');
      
    } catch (error) {
      console.error('Metadata creation error:', error);
    }
  };

  // Mint BIOX tokens
  const mintBioxTokens = useCallback(async (amount) => {
    if (!connection || !publicKey || !tokenMint || !tokenAccount) {
      setStatus('Please create BIOX Token first');
      return;
    }

    try {
      setIsLoading(true);
      setStatus(`Minting ${amount.toLocaleString()} BIOX tokens...`);

      const { Transaction } = await import('@solana/web3.js');
      const { createMintToInstruction } = await import('@solana/spl-token');

      const mintPubkey = new PublicKey(tokenMint);
      const tokenAccountPubkey = new PublicKey(tokenAccount);

      // Create mint transaction
      const transaction = new Transaction().add(
        createMintToInstruction(
          mintPubkey, // mint
          tokenAccountPubkey, // destination
          publicKey, // authority
          amount * Math.pow(10, TOKEN_METADATA.decimals) // amount
        )
      );

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature);

      setStatus(`Successfully minted ${amount.toLocaleString()} BIOX tokens!`);
      await checkBalance();

    } catch (error) {
      setStatus(`Error minting BIOX tokens: ${error.message}`);
      console.error('Minting error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [connection, publicKey, tokenMint, tokenAccount, signTransaction]);

  // Check token balance
  const checkBalance = useCallback(async () => {
    if (!connection || !tokenAccount) return;

    try {
      const tokenAccountPubkey = new PublicKey(tokenAccount);
      const accountInfo = await getAccount(connection, tokenAccountPubkey);
      const balanceAmount = Number(accountInfo.amount) / Math.pow(10, TOKEN_METADATA.decimals);
      setBalance(balanceAmount.toString());
    } catch (error) {
      console.error('Error checking balance:', error);
    }
  }, [connection, tokenAccount]);

  // Add token to wallet (for supported wallets)
  const addTokenToWallet = useCallback(async () => {
    if (!tokenMint || !window.solana) {
      setStatus('Wallet not detected or token not created');
      return;
    }

    try {
      // This works with Phantom wallet
      if (window.solana.isPhantom) {
        await window.solana.request({
          method: 'wallet_watchAsset',
          params: {
            type: 'SPL',
            options: {
              address: tokenMint,
              symbol: TOKEN_METADATA.symbol,
              decimals: TOKEN_METADATA.decimals,
              image: TOKEN_METADATA.image,
            },
          },
        });
        setStatus('BIOX Token added to wallet!');
      } else {
        setStatus('Please manually add the token using the mint address');
      }
    } catch (error) {
      setStatus(`Error adding token to wallet: ${error.message}`);
    }
  }, [tokenMint]);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gradient-to-br from-indigo-50 to-purple-50 min-h-screen">
      <div className="bg-white rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
              BIOX
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            BIOX Token Deployer
          </h1>
          <p className="text-gray-600 mt-2">Deploy your BIOX Token on Solana Devnet</p>
        </div>

        {/* Wallet Connection */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center text-sm mr-3">1</span>
            Connect Wallet
          </h2>
          <div className="flex gap-4 items-center flex-wrap">
            <WalletMultiButton className="!bg-indigo-500 hover:!bg-indigo-600" />
            {connected && <WalletDisconnectButton className="!bg-red-500 hover:!bg-red-600" />}
          </div>
          {connected && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-800">Wallet Connected:</p>
              <p className="text-xs font-mono text-green-600 break-all">{publicKey?.toString()}</p>
            </div>
          )}
        </div>

        {/* Token Information */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">BIOX Token Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div><span className="font-medium">Name:</span> {TOKEN_METADATA.name}</div>
              <div><span className="font-medium">Symbol:</span> {TOKEN_METADATA.symbol}</div>
              <div><span className="font-medium">Decimals:</span> {TOKEN_METADATA.decimals}</div>
            </div>
            <div className="space-y-2">
              <div><span className="font-medium">Description:</span></div>
              <p className="text-sm text-gray-600">{TOKEN_METADATA.description}</p>
            </div>
          </div>
        </div>

        {/* Create Token */}
        <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm mr-3">2</span>
            Deploy BIOX Token
          </h2>
          <button
            onClick={createBioxToken}
            disabled={isLoading || !connected || tokenMint}
            className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 disabled:from-gray-300 disabled:to-gray-300 text-white px-8 py-3 rounded-lg font-medium transition-all transform hover:scale-105"
          >
            {tokenMint ? 'BIOX Token Deployed ✓' : 'Deploy BIOX Token'}
          </button>
          
          {tokenMint && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-800">BIOX Token Mint Address:</p>
              <p className="text-xs font-mono text-green-600 break-all">{tokenMint}</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(tokenMint)}
                  className="text-xs bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded"
                >
                  Copy Address
                </button>
                <a
                  href={`https://explorer.solana.com/address/${tokenMint}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded"
                >
                  View on Explorer
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Mint Tokens */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm mr-3">3</span>
            Mint BIOX Tokens
          </h2>
          <div className="flex gap-3 flex-wrap mb-4">
            {[1000, 10000, 100000, 1000000].map((amount) => (
              <button
                key={amount}
                onClick={() => mintBioxTokens(amount)}
                disabled={isLoading || !tokenMint || !connected}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:from-gray-300 disabled:to-gray-300 text-white px-6 py-2 rounded-lg font-medium transition-all transform hover:scale-105"
              >
                Mint {amount.toLocaleString()}
              </button>
            ))}
          </div>
          
          {balance && (
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm font-medium text-purple-800">Your BIOX Balance:</p>
              <p className="text-2xl font-bold text-purple-600">{Number(balance).toLocaleString()} BIOX</p>
              <button
                onClick={checkBalance}
                disabled={isLoading}
                className="mt-2 bg-purple-100 hover:bg-purple-200 text-purple-800 px-4 py-1 rounded text-sm"
              >
                Refresh Balance
              </button>
            </div>
          )}
        </div>

        {/* Add to Wallet */}
        {tokenMint && (
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm mr-3">4</span>
              Add to Wallet
            </h2>
            <p className="text-gray-600 mb-4">
              Add BIOX Token to your wallet so it appears in your token list
            </p>
            <button
              onClick={addTokenToWallet}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-2 rounded-lg font-medium transition-all transform hover:scale-105"
            >
              Add BIOX to Wallet
            </button>
            
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-800 mb-2">Manual Addition:</p>
              <p className="text-xs text-blue-600">
                If automatic addition doesn't work, manually add the token using:
              </p>
              <div className="mt-2 space-y-1 text-xs">
                <div><span className="font-medium">Address:</span> {tokenMint}</div>
                <div><span className="font-medium">Symbol:</span> {TOKEN_METADATA.symbol}</div>
                <div><span className="font-medium">Decimals:</span> {TOKEN_METADATA.decimals}</div>
              </div>
            </div>
          </div>
        )}

        {/* Status */}
        {status && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-2">Status:</h3>
            <p className="text-gray-700 text-sm">{status}</p>
            {isLoading && (
              <div className="mt-2 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                <span className="text-sm text-gray-600">Processing...</span>
              </div>
            )}
          </div>
        )}

        {/* Network Info */}
        <div className="bg-yellow-50 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-800 mb-2">Network Information:</h3>
          <div className="text-yellow-700 text-sm space-y-1">
            <div><span className="font-medium">Network:</span> Solana Devnet</div>
            <div><span className="font-medium">Environment:</span> Development/Testing</div>
            <div><span className="font-medium">Supported Wallets:</span> Phantom, Solflare, Torus, Ledger</div>
            <p className="mt-2 text-xs">
              This token is deployed on Devnet for testing purposes. 
              To deploy on Mainnet, change the network configuration and ensure you have real SOL for fees.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wallet provider wrapper
const BioxTokenApp = () => {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <TokenMinter />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default BioxTokenApp;