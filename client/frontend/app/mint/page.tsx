/*eslint-disable*/
"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, Keypair } from "@solana/web3.js";
import { 
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createMintToInstruction,
  getAccount,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Coins, CheckCircle, AlertCircle, Wallet, Copy, ExternalLink, Plus, Minus } from "lucide-react";
import { useUser } from "@/components/user-context";
import { setCurrentTokenMint, getUserTokenBalance } from "@/lib/solana";
import { Navigation } from "@/components/navigation";

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

// Use the provided BIOX token mint address
const PREDEFINED_BIOX_MINT = "5v8NRPNxkiTd4HXbPNvGMpvAhffVMANYc8JB6wFccnMx";

export default function MintTokensPage() {
  const { publicKey, connected, wallet, connect, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { isSignedUp } = useUser();
  const [mintAmount, setMintAmount] = useState("100");
  const [quickMintAmount, setQuickMintAmount] = useState(10); // New state for quick mint in 10's
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [customMintAddress, setCustomMintAddress] = useState(PREDEFINED_BIOX_MINT);
  const [useCustomMint, setUseCustomMint] = useState(true);
  const [walletCapabilities, setWalletCapabilities] = useState<{
    canSign: boolean;
    canSend: boolean;
    walletName: string;
  } | null>(null);
  const [tokenMint, setTokenMint] = useState(PREDEFINED_BIOX_MINT);
  const [tokenAccount, setTokenAccount] = useState("");
  const [balance, setBalance] = useState("");
  const [operationType, setOperationType] = useState<"create-mint" | "mint-tokens" | "use-existing" | "quick-mint">("use-existing");
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);

  // Check wallet capabilities
  useEffect(() => {
    if (connected && wallet?.adapter) {
      try {
        const capabilities = {
          canSign: !!(wallet.adapter.sendTransaction || wallet.adapter.sendTransaction),
          canSend: !!(wallet.adapter.sendTransaction),
          walletName: wallet.adapter.name || "Unknown"
        };
        setWalletCapabilities(capabilities);
        
        console.log("Wallet capabilities:", capabilities);
      } catch (error) {
        console.error("Error checking wallet capabilities:", error);
        setWalletCapabilities({
          canSign: false,
          canSend: false,
          walletName: "Error"
        });
      }
    } else {
      setWalletCapabilities(null);
    }
  }, [connected, wallet]);

  // Set up the predefined BIOX token and check balance when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      const setupPredefinedToken = async () => {
        try {
          // Set the current token mint in the solana library
          const bioxMint = new PublicKey(PREDEFINED_BIOX_MINT);
          setCurrentTokenMint(bioxMint);
          
          // Get associated token account
          const associatedTokenAddress = await getAssociatedTokenAddress(
            bioxMint,
            publicKey
          );
          
          setTokenAccount(associatedTokenAddress.toString());
          setTokenMint(PREDEFINED_BIOX_MINT);
          
          // Check balance
          await checkBalance();
          
          console.log("Predefined BIOX token setup complete:", {
            mint: PREDEFINED_BIOX_MINT,
            tokenAccount: associatedTokenAddress.toString()
          });
          
        } catch (error) {
          console.error("Error setting up predefined BIOX token:", error);
        }
      };
      
      setupPredefinedToken();
    }
  }, [connected, publicKey]);

  // Check token balance
  const checkBalance = async () => {
    if (!connection || !publicKey) return;

    setIsCheckingBalance(true);
    try {
      // First try using the utility function
      const balanceResult = await getUserTokenBalance(
        { publicKey },
        new PublicKey(tokenMint || PREDEFINED_BIOX_MINT)
      );
      
      if (balanceResult.success) {
        setBalance(balanceResult.balance.toString());
      } else {
        // Fallback to direct method
        if (tokenAccount) {
          try {
            const tokenAccountPubkey = new PublicKey(tokenAccount);
            const accountInfo = await getAccount(connection, tokenAccountPubkey);
            const balanceAmount = Number(accountInfo.amount) / Math.pow(10, TOKEN_METADATA.decimals);
            setBalance(balanceAmount.toString());
          } catch (error) {
            console.log("Token account might not exist yet");
            setBalance("0");
          }
        }
      }
    } catch (error) {
      console.error('Error checking balance:', error);
      setBalance("0");
    } finally {
      setIsCheckingBalance(false);
    }
  };

  // New Quick Mint Function in 10's
  const quickMintBioxTokens = async (amount: number) => {
    if (!connection || !publicKey || !signTransaction) {
      setMessage({ type: "error", text: "Please connect your wallet first" });
      return;
    }

    if (amount <= 0 || amount % 10 !== 0) {
      setMessage({ type: "error", text: "Amount must be a positive multiple of 10" });
      return;
    }

    const mintAddress = new PublicKey(PREDEFINED_BIOX_MINT);

    try {
      setIsLoading(true);
      setMessage(null);

      // Get or create associated token account
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintAddress,
        publicKey
      );

      // Check if account exists, create if not
      const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
      
      if (!accountInfo) {
        const createATATransaction = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            associatedTokenAddress,
            publicKey,
            mintAddress
          )
        );

        const { blockhash: ataBlockhash } = await connection.getLatestBlockhash();
        createATATransaction.recentBlockhash = ataBlockhash;
        createATATransaction.feePayer = publicKey;

        const signedATATransaction = await signTransaction(createATATransaction);
        const ataSignature = await connection.sendRawTransaction(signedATATransaction.serialize());
        await connection.confirmTransaction(ataSignature);
        
        setTokenAccount(associatedTokenAddress.toString());
      }

      // Create mint transaction
      const transaction = new Transaction().add(
        createMintToInstruction(
          mintAddress, // mint
          associatedTokenAddress, // destination
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

      setMessage({
        type: "success",
        text: `Successfully minted ${amount.toLocaleString()} BIOX tokens! Transaction: ${signature.slice(0, 20)}...`
      });
      
      // Update balance
      await checkBalance();

    } catch (error) {
      console.error("Error minting tokens:", error);
      
      let errorMessage = "An unexpected error occurred";
      if (error instanceof Error) {
        if (error.message.includes("this.emit")) {
          errorMessage = "Wallet connection error. Please disconnect and reconnect your wallet.";
        } else if (error.message.includes("unauthorized") || error.message.includes("authority")) {
          errorMessage = "You don't have mint authority for this token. Only the token creator can mint new tokens.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setMessage({
        type: "error",
        text: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Create BIOX Token
  const createBioxToken = async () => {
    if (!connection || !publicKey || !signTransaction) {
      setMessage({ type: "error", text: "Please connect your wallet first" });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);

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
      const signedTransaction = await signTransaction(transaction);

      // Send transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature);

      const mintAddress = mintKeypair.publicKey;
      setTokenMint(mintAddress.toString());
      setCustomMintAddress(mintAddress.toString());
      setUseCustomMint(true);

      // Update the global token mint
      setCurrentTokenMint(mintAddress);

      // Create associated token account
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
      setMessage({
        type: "success",
        text: `BIOX Token created successfully! Mint address: ${mintAddress.toString()}`
      });

    } catch (error) {
      console.error("Error creating BIOX Token:", error);
      
      let errorMessage = "An unexpected error occurred";
      if (error instanceof Error) {
        if (error.message.includes("this.emit")) {
          errorMessage = "Wallet connection error. Please disconnect and reconnect your wallet.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setMessage({
        type: "error",
        text: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Setup existing BIOX token
  const setupExistingBioxToken = async () => {
    if (!connection || !publicKey || !signTransaction) {
      setMessage({ type: "error", text: "Please connect your wallet first" });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);

      const mintAddress = new PublicKey(PREDEFINED_BIOX_MINT);
      
      // Get associated token account
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
        
        setMessage({
          type: "success",
          text: "BIOX Token account created successfully! You can now receive BIOX tokens."
        });
      } else {
        setMessage({
          type: "success",
          text: "BIOX Token account already exists! You're ready to use BIOX tokens."
        });
      }

      setTokenAccount(associatedTokenAddress.toString());
      setTokenMint(PREDEFINED_BIOX_MINT);
      
      // Update the global token mint
      setCurrentTokenMint(mintAddress);
      
      // Check balance
      await checkBalance();

    } catch (error) {
      console.error("Error setting up BIOX Token:", error);
      
      let errorMessage = "An unexpected error occurred";
      if (error instanceof Error) {
        if (error.message.includes("this.emit")) {
          errorMessage = "Wallet connection error. Please disconnect and reconnect your wallet.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setMessage({
        type: "error",
        text: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mint BIOX tokens (only works if you're the mint authority)
  const mintBioxTokens = async () => {
    if (!connection || !publicKey || !signTransaction) {
      setMessage({ type: "error", text: "Please connect your wallet first" });
      return;
    }

    const amount = parseFloat(mintAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: "error", text: "Please enter a valid amount" });
      return;
    }

    let mintAddress: PublicKey;
    
    // Use custom mint if provided, otherwise use the created token mint
    if (useCustomMint && customMintAddress) {
      try {
        mintAddress = new PublicKey(customMintAddress);
      } catch (error) {
        setMessage({ type: "error", text: "Invalid mint address format" });
        return;
      }
    } else if (tokenMint) {
      mintAddress = new PublicKey(tokenMint);
    } else {
      setMessage({ type: "error", text: "Please create a token mint first" });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);

      // Get or create associated token account
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintAddress,
        publicKey
      );

      // Check if account exists, create if not
      const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
      
      if (!accountInfo) {
        const createATATransaction = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            associatedTokenAddress,
            publicKey,
            mintAddress
          )
        );

        const { blockhash: ataBlockhash } = await connection.getLatestBlockhash();
        createATATransaction.recentBlockhash = ataBlockhash;
        createATATransaction.feePayer = publicKey;

        const signedATATransaction = await signTransaction(createATATransaction);
        const ataSignature = await connection.sendRawTransaction(signedATATransaction.serialize());
        await connection.confirmTransaction(ataSignature);
        
        setTokenAccount(associatedTokenAddress.toString());
      }

      // Create mint transaction
      const transaction = new Transaction().add(
        createMintToInstruction(
          mintAddress, // mint
          associatedTokenAddress, // destination
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

      setMessage({
        type: "success",
        text: `Successfully minted ${amount.toLocaleString()} BIOX tokens! Transaction: ${signature}`
      });
      setMintAmount("100"); // Reset form
      
      // Update balance
      await checkBalance();

    } catch (error) {
      console.error("Error minting tokens:", error);
      
      let errorMessage = "An unexpected error occurred";
      if (error instanceof Error) {
        if (error.message.includes("this.emit")) {
          errorMessage = "Wallet connection error. Please disconnect and reconnect your wallet.";
        } else if (error.message.includes("unauthorized") || error.message.includes("authority")) {
          errorMessage = "You don't have mint authority for this token. Only the token creator can mint new tokens.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setMessage({
        type: "error",
        text: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenOperation = async () => {
    if (!connected || !publicKey) {
      setMessage({ type: "error", text: "Please connect your wallet first" });
      return;
    }

    if (!isSignedUp) {
      setMessage({ type: "error", text: "Please sign up first" });
      return;
    }

    // Check wallet capabilities
    if (!walletCapabilities?.canSign && !walletCapabilities?.canSend) {
      setMessage({ 
        type: "error", 
        text: `Your wallet (${walletCapabilities?.walletName || "Unknown"}) doesn't support transaction signing. Please try using Phantom or Solflare wallet.` 
      });
      return;
    }

    if (operationType === "create-mint") {
      await createBioxToken();
    } else if (operationType === "mint-tokens") {
      await mintBioxTokens();
    } else if (operationType === "use-existing") {
      await setupExistingBioxToken();
    } else if (operationType === "quick-mint") {
      await quickMintBioxTokens(quickMintAmount);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: "success", text: "Copied to clipboard!" });
  };

  // Quick mint amount controls
  const increaseQuickMintAmount = () => {
    setQuickMintAmount(prev => prev + 10);
  };

  const decreaseQuickMintAmount = () => {
    setQuickMintAmount(prev => Math.max(10, prev - 10));
  };

  if (!connected) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-6 w-6 text-emerald-500" />
                Mint BioxTokens
              </CardTitle>
              <CardDescription>
                Connect your wallet to create and mint BioxTokens for platform usage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Wallet className="h-4 w-4" />
                <AlertDescription>
                  Please connect a compatible wallet (Phantom or Solflare recommended) to mint tokens.
                </AlertDescription>
              </Alert>
              
              <Button onClick={connect} className="w-full">
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isSignedUp) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-6 w-6 text-emerald-500" />
                Mint BioxTokens
              </CardTitle>
              <CardDescription>
                Sign up to the platform to access token minting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please complete the sign-up process first to mint tokens.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Navigation />
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Wallet Compatibility Info */}
        {walletCapabilities && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wallet className="h-4 w-4" />
                Wallet Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Wallet:</span>
                  <span className="font-medium">{walletCapabilities.walletName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transaction Signing:</span>
                  <span className={walletCapabilities.canSign || walletCapabilities.canSend ? "text-green-600" : "text-red-600"}>
                    {walletCapabilities.canSign || walletCapabilities.canSend ? "✓ Supported" : "✗ Not Supported"}
                  </span>
                </div>
              </div>
              
              {!walletCapabilities.canSign && !walletCapabilities.canSend && (
                <Alert className="mt-4" variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your current wallet doesn't support transaction signing. Please switch to Phantom or Solflare wallet for full functionality.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Mint Card */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Coins className="h-5 w-5" />
              Quick Mint BIOX Tokens
            </CardTitle>
            <CardDescription>
              Mint BIOX tokens in multiples of 10 with one click
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium">Amount to mint:</span>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={decreaseQuickMintAmount}
                    disabled={quickMintAmount <= 10 || isLoading}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="font-bold text-lg text-blue-700 min-w-[60px] text-center">
                    {quickMintAmount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={increaseQuickMintAmount}
                    disabled={isLoading}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {[10, 50, 100, 500].map((amount) => (
                  <Button
                    key={amount}
                    variant={quickMintAmount === amount ? "default" : "outline"}
                    size="sm"
                    onClick={() => setQuickMintAmount(amount)}
                    disabled={isLoading}
                    className="text-xs"
                  >
                    {amount}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => quickMintBioxTokens(quickMintAmount)}
              disabled={isLoading || (!walletCapabilities?.canSign && !walletCapabilities?.canSend)}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Minting...
                </>
              ) : (
                <>
                  <Coins className="mr-2 h-4 w-4" />
                  Quick Mint {quickMintAmount} BIOX Tokens
                </>
              )}
            </Button>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Quick mint allows you to mint BIOX tokens in predefined amounts. Only works if you have mint authority for the token.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* BIOX Token Info Card */}
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <Coins className="h-5 w-5" />
              Official BIOX Token
            </CardTitle>
            <CardDescription>
              Use the official BIOX token for funding research papers on the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-emerald-50 p-4 rounded-lg">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Token Mint:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{PREDEFINED_BIOX_MINT.slice(0, 8)}...{PREDEFINED_BIOX_MINT.slice(-8)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(PREDEFINED_BIOX_MINT)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-6 w-6 p-0"
                    >
                      <a
                        href={`https://explorer.solana.com/address/${PREDEFINED_BIOX_MINT}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Symbol:</span>
                  <span>{TOKEN_METADATA.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Decimals:</span>
                  <span>{TOKEN_METADATA.decimals}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Token Balance Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Coins className="h-4 w-4" />
              Your BIOX Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>BIOX Balance:</span>
                <div className="flex items-center gap-2">
                  {isCheckingBalance ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Checking...</span>
                    </div>
                  ) : (
                    <span className="font-medium text-emerald-600 text-lg">
                      {balance ? Number(balance).toLocaleString() : "0"} BIOX
                    </span>
                  )}
                </div>
              </div>
              {tokenAccount && (
                <div className="text-xs text-muted-foreground">
                  Token Account: {tokenAccount.slice(0, 20)}...
                </div>
              )}
            </div>
            <Button
              onClick={checkBalance}
              disabled={isLoading || isCheckingBalance}
              variant="outline"
              size="sm"
              className="mt-3 w-full"
            >
              {isCheckingBalance ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking Balance...
                </>
              ) : (
                "Refresh Balance"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-6 w-6 text-emerald-500" />
              BIOX Token Operations
            </CardTitle>
            <CardDescription>
              Set up or create BIOX tokens for the BioX platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {message && (
              <Alert variant={message.type === "error" ? "destructive" : "default"}>
                {message.type === "success" ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            {/* Operation Type Selection */}
            <div className="space-y-3">
              <Label>Operation Type</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="use-existing"
                    name="operationType"
                    value="use-existing"
                    checked={operationType === "use-existing"}
                    onChange={(e) => setOperationType(e.target.value as any)}
                    className="rounded"
                  />
                  <Label htmlFor="use-existing" className="font-normal">
                    🌟 Use Official BIOX Token (Recommended)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="create-mint"
                    name="operationType"
                    value="create-mint"
                    checked={operationType === "create-mint"}
                    onChange={(e) => setOperationType(e.target.value as any)}
                    className="rounded"
                  />
                  <Label htmlFor="create-mint" className="font-normal">
                    Create New Custom Token Mint
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="mint-tokens"
                    name="operationType"
                    value="mint-tokens"
                    checked={operationType === "mint-tokens"}
                    onChange={(e) => setOperationType(e.target.value as any)}
                    className="rounded"
                  />
                  <Label htmlFor="mint-tokens" className="font-normal">
                    Custom Amount Mint (Requires Mint Authority)
                  </Label>
                </div>
              </div>
            </div>

            {/* Conditional Inputs based on operation type */}
            {operationType === "mint-tokens" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount to Mint</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    placeholder="Enter amount"
                    min="0"
                    step="0.000001"
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter the number of BIOX tokens you want to mint
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="customMint"
                      checked={useCustomMint}
                      onChange={(e) => setUseCustomMint(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="customMint">Use custom mint address</Label>
                  </div>
                  
                  {useCustomMint && (
                    <Input
                      type="text"
                      value={customMintAddress}
                      onChange={(e) => setCustomMintAddress(e.target.value)}
                      placeholder="Enter custom mint address"
                    />
                  )}
                  
                  {!useCustomMint && tokenMint && (
                    <p className="text-sm text-muted-foreground">
                      Will use created token mint: {tokenMint.slice(0, 20)}...
                    </p>
                  )}
                </div>
              </div>
            )}

            {operationType === "use-existing" && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  This will set up your wallet to use the official BIOX token. You'll be able to receive and use BIOX tokens for funding research papers.
                </AlertDescription>
              </Alert>
            )}

            {/* Action Button */}
            <Button
              onClick={handleTokenOperation}
              disabled={isLoading || (!walletCapabilities?.canSign && !walletCapabilities?.canSend)}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Coins className="mr-2 h-4 w-4" />
                  {operationType === "create-mint" ? "Create Custom Token" : 
                   operationType === "mint-tokens" ? "Mint BIOX Tokens" : 
                   "Setup BIOX Token Account"}
                </>
              )}
            </Button>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">Token Information</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>Name:</strong> {TOKEN_METADATA.name}</p>
                <p><strong>Symbol:</strong> {TOKEN_METADATA.symbol}</p>
                <p><strong>Decimals:</strong> {TOKEN_METADATA.decimals}</p>
                <p><strong>Description:</strong> {TOKEN_METADATA.description}</p>
                <p><strong>Current Mint:</strong> {tokenMint || PREDEFINED_BIOX_MINT}</p>
                <p><strong>Your Wallet:</strong> {publicKey?.toString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to Get BIOX Tokens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                <div>
                  <h4 className="font-medium">Set up your BIOX token account</h4>
                  <p className="text-sm text-muted-foreground">
                    Use the "Setup BIOX Token Account" option above to create your token account.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <h4 className="font-medium">Use Quick Mint for fast token creation</h4>
                  <p className="text-sm text-muted-foreground">
                    Use the Quick Mint feature above to mint tokens in multiples of 10 with preset amounts.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <h4 className="font-medium">Request tokens from team or faucet</h4>
                  <p className="text-sm text-muted-foreground">
                    Contact the BioX team or use a devnet faucet to receive test BIOX tokens.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                <div>
                  <h4 className="font-medium">Start funding research</h4>
                  <p className="text-sm text-muted-foreground">
                    Once you have BIOX tokens, you can fund research papers on the platform.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Network:</span>
                <span className="font-medium">Solana Devnet</span>
              </div>
              <div className="flex justify-between">
                <span>Environment:</span>
                <span className="font-medium">Development/Testing</span>
              </div>
              <div className="flex justify-between">
                <span>Supported Wallets:</span>
                <span className="font-medium">Phantom, Solflare, Torus, Ledger</span>
              </div>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This token is deployed on Devnet for testing purposes. 
                To deploy on Mainnet, change the network configuration and ensure you have real SOL for transaction fees.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
