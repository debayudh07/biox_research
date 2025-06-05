/*eslint-disable*/
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction, Keypair } from "@solana/web3.js";
import { 
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
  getMinimumBalanceForRentExemptMint,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress} from "@solana/spl-token";
import { BioxResearch } from "./biox_research";
import idl from "./biox_research.json";

// Program ID from the contract
export const PROGRAM_ID = new PublicKey("4TsLtFAfkbpcFjesanK4ojZNTK1bsQPfPuVxt5g19hhM");

// BioX Research Platform Token Mint (using USDC for testing)
// For production, this would be a custom token mint
export const BIOX_TOKEN_MINT = new PublicKey("5v8NRPNxkiTd4HXbPNvGMpvAhffVMANYc8JB6wFccnMx"); // Official BIOX token

// Replace the current token mint management with this
let CURRENT_TOKEN_MINT: PublicKey = BIOX_TOKEN_MINT; // Default to the official BIOX token

// Function to get the current working token mint
export function getCurrentTokenMint(): PublicKey {
  return CURRENT_TOKEN_MINT;
}

// Function to set the current token mint
export function setCurrentTokenMint(mintAddress: PublicKey) {
  CURRENT_TOKEN_MINT = mintAddress;
  console.log("Updated current token mint to:", mintAddress.toString());
}

// Create a working token mint for testing
export async function createWorkingTokenMint(wallet: any, connection: Connection) {
  try {
    const walletPublicKey = getWalletPublicKey(wallet);
    
    // Generate a new keypair for the mint
    const mintKeypair = Keypair.generate();
    
    console.log("Creating new token mint:", mintKeypair.publicKey.toString());
    
    // Calculate rent-exempt balance for mint account
    const rentExemptBalance = await getMinimumBalanceForRentExemptMint(connection);
    
    // Create mint account transaction
    const createMintAccountIx = SystemProgram.createAccount({
      fromPubkey: walletPublicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: getMintLen([]),
      lamports: rentExemptBalance,
      programId: TOKEN_PROGRAM_ID,
    });
    
    // Initialize mint instruction
    const initializeMintIx = createInitializeMintInstruction(
      mintKeypair.publicKey,
      6, // 6 decimals like USDC
      walletPublicKey, // mint authority
      walletPublicKey  // freeze authority
    );
    
    // Create transaction
    const transaction = new Transaction()
      .add(createMintAccountIx)
      .add(initializeMintIx);
    
    // Sign with mint keypair
    transaction.partialSign(mintKeypair);
    
    // Send transaction
    const signature = await sendTransactionWithWallet(wallet, transaction, connection);
    
    console.log("Token mint created successfully:", mintKeypair.publicKey.toString());
    
    // Set this as the current working mint
    setCurrentTokenMint(mintKeypair.publicKey);
    
    return {
      success: true,
      mintAddress: mintKeypair.publicKey,
      signature: signature
    };
  } catch (error: any) {
    console.error("Error creating token mint:", error);
    return {
      success: false,
      error: error.message || "Failed to create token mint"
    };
  }
}

// Helper function to extract public key from wallet
function getWalletPublicKey(wallet: any): PublicKey {
  if (!wallet) {
    throw new Error("Wallet is required");
  }
  
  if (wallet.publicKey) {
    return wallet.publicKey;
  }
  
  if (wallet.adapter?.publicKey) {
    return wallet.adapter.publicKey;
  }
  
  throw new Error("Unable to get public key from wallet");
}

// Helper function to create wallet adapter
function createWalletAdapter(wallet: any) {
  return {
    publicKey: getWalletPublicKey(wallet),
    signTransaction: wallet.signTransaction?.bind(wallet) || wallet.adapter?.signTransaction?.bind(wallet.adapter),
    signAllTransactions: wallet.signAllTransactions?.bind(wallet) || wallet.adapter?.signAllTransactions?.bind(wallet.adapter),
  };
}

// Initialize connection and program
export function initializeProgram(wallet: any) {
  const connection = new Connection(
    process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8899",
    "confirmed"
  );
  
  // Create a wallet adapter that matches Anchor's expected interface
  const walletAdapter = createWalletAdapter(wallet);
  
  const provider = new anchor.AnchorProvider(
    connection,
    walletAdapter,
    { 
      commitment: "confirmed",
      preflightCommitment: "confirmed"
    }
  );
  
  anchor.setProvider(provider);
  
  return new anchor.Program(
    idl as anchor.Idl,
    provider
  ) as anchor.Program<BioxResearch>;
}

// Get PDAs (Program Derived Addresses)
export function getProgramStatePda() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("program-state")],
    PROGRAM_ID
  );
}

export function getPaperPda(paperId: anchor.BN) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("paper"), paperId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
}

export function getPaperTokenAccountPda(paperId: anchor.BN) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("paper-token"), paperId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
}

export function getPlatformVaultPda() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("platform-vault")],
    PROGRAM_ID
  );
}

export function getFundingPda(paperId: anchor.BN, funder: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("funding"), paperId.toArrayLike(Buffer, "le", 8), funder.toBuffer()],
    PROGRAM_ID
  );
}

export function getVotePda(paperId: anchor.BN, voter: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vote"), paperId.toArrayLike(Buffer, "le", 8), voter.toBuffer()],
    PROGRAM_ID
  );
}

// OPTIMAL: Check and initialize program state if needed
export async function ensureProgramInitialized(
  program: anchor.Program<BioxResearch>,
  adminWallet: any
) {
  try {
    const [programStatePda] = getProgramStatePda();
    
    // Try to fetch the program state
    try {
      const programState = await program.account.programState.fetch(programStatePda);
      console.log("Program already initialized");
      return { 
        success: true, 
        alreadyInitialized: true,
        data: programState 
      };
    } catch (fetchError) {
      console.log("Program not initialized, initializing now...");      // Initialize the program
      const tx = await program.methods
        .initialize()
        .accounts({
          admin: getWalletPublicKey(adminWallet),
        })
        .rpc();
      
      console.log("Program initialized with tx:", tx);
      
      // Wait for confirmation and fetch the state
      await program.provider.connection.confirmTransaction(tx, "confirmed");
      const programState = await program.account.programState.fetch(programStatePda);
      
      return { 
        success: true, 
        alreadyInitialized: false,
        txHash: tx,
        data: programState 
      };
    }
  } catch (error) {
    console.error("Error ensuring program initialization:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// OPTIMAL: Submit paper with proper error handling and account resolution
export async function submitPaperOptimal(
  program: anchor.Program<BioxResearch>,
  wallet: any,
  paperData: {
    title: string;
    abstractText: string;
    ipfsHash: string;
    authors: string[];
    fundingGoal: number;
    fundingPeriodDays: number;
  }
) {
  try {
    // Step 1: Ensure program is initialized
    const initResult = await ensureProgramInitialized(program, wallet);
    if (!initResult.success) {
      return {
        success: false,
        error: `Failed to initialize program: ${initResult.error}`
      };
    }

    // Step 2: Get current program state
    const [programStatePda] = getProgramStatePda();
    const programState = await program.account.programState.fetch(programStatePda);
    const paperId = programState.paperCount;
      console.log("Current paper count:", paperId.toString());
    
    // Step 3: Convert values to BN (paper PDA will be auto-derived by Anchor)
    const fundingGoalBN = new anchor.BN(paperData.fundingGoal);
    const fundingPeriodBN = new anchor.BN(paperData.fundingPeriodDays);      // Step 4: Build transaction - let Anchor auto-derive all PDAs
    const txBuilder = program.methods
      .submitPaper(
        paperData.title,
        paperData.abstractText,
        paperData.ipfsHash,
        paperData.authors,
        fundingGoalBN,
        fundingPeriodBN
      )
      .accounts({
        author: getWalletPublicKey(wallet),
      });
    
    // Step 6: Get transaction for inspection (optional)
    const tx = await txBuilder.transaction();
    console.log("Transaction built successfully");
    
    // Step 7: Send transaction
    const signature = await txBuilder.rpc();
    console.log("Transaction sent:", signature);
    
    // Step 8: Wait for confirmation
    await program.provider.connection.confirmTransaction(signature, "confirmed");
    console.log("Transaction confirmed");    return {
      success: true,
      txHash: signature,
      paperId: paperId.toString()
    };
    
  } catch (error) {
    console.error("Error submitting paper:", error);
    
    // Enhanced error logging
    if (error instanceof anchor.AnchorError) {
      console.error("Anchor Error Code:", error.error.errorCode.number);
      console.error("Anchor Error Message:", error.error.errorMessage);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      errorDetails: error
    };
  }
}

// Helper function to get paper details
export async function getPaperDetails(
  program: anchor.Program<BioxResearch>,
  paperId: number
) {
  try {
    const paperIdBN = new anchor.BN(paperId);
    const [paperPda] = getPaperPda(paperIdBN);
    
    const paper = await program.account.researchPaper.fetch(paperPda);
    
    return {
      success: true,
      data: {
        id: paper.id.toString(),
        title: paper.title,
        abstractText: paper.abstractText,
        ipfsHash: paper.ipfsHash,
        authors: paper.authors,
        author: paper.author.toString(),
        fundingGoal: paper.fundingGoal.toString(),
        currentFunding: paper.fundingCurrent.toString(),
        fundingDeadline: paper.fundingDeadline.toString(),
        status: paper.status,
        pda: paperPda.toString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Helper function to get all papers
export async function getAllPapers(program: anchor.Program<BioxResearch>) {
  try {
    const programStateResult = await getProgramState(program);
    if (!programStateResult.success || !programStateResult.data) {
      return {
        success: false,
        error: programStateResult.error || "Failed to get program state"
      };
    }
    
    const paperCount = parseInt(programStateResult.data.paperCount);
    const papers = [];
    
    for (let i = 0; i < paperCount; i++) {
      const paperResult = await getPaperDetails(program, i);
      if (paperResult.success) {
        papers.push(paperResult.data);
      }
    }
    
    return {
      success: true,
      data: papers
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Get program state info
export async function getProgramState(program: anchor.Program<BioxResearch>) {
  try {
    const [programStatePda] = getProgramStatePda();
    const programState = await program.account.programState.fetch(programStatePda);
    return {
      success: true,
      data: {
        admin: programState.admin.toString(),
        paperCount: programState.paperCount.toString(),
        totalFunding: programState.totalFunding.toString(),
        platformFeeRate: programState.platformFeeRate,
        minFundingGoal: programState.minFundingGoal.toString(),
        isPaused: programState.isPaused,
        pda: programStatePda.toString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Program not initialized"
    };
  }
}

// OPTIMAL WORKFLOW FUNCTION
export async function submitPaperWorkflow(
  wallet: any,
  paperData: {
    title: string;
    abstractText: string;
    ipfsHash: string;
    authors: string[];
    fundingGoal: number;
    fundingPeriodDays: number;
  }
) {
  try {
    // Validate wallet first
    if (!wallet) {
      return {
        success: false,
        error: "Wallet is required"
      };
    }
    
    // Check if wallet is connected
    if (!isWalletConnected(wallet)) {
      return {
        success: false,
        error: "Wallet is not connected. Please connect your wallet and try again."
      };
    }
    
    // Validate paper data
    if (!paperData.title?.trim()) {
      return {
        success: false,
        error: "Paper title is required"
      };
    }
    
    if (!paperData.abstractText?.trim()) {
      return {
        success: false,
        error: "Paper abstract is required"
      };
    }
    
    if (!paperData.ipfsHash?.trim()) {
      return {
        success: false,
        error: "IPFS hash is required"
      };
    }
    
    if (!paperData.authors?.length || paperData.authors.some(author => !author.trim())) {
      return {
        success: false,
        error: "At least one valid author is required"
      };
    }
    
    if (paperData.fundingGoal <= 0) {
      return {
        success: false,
        error: "Funding goal must be greater than 0"
      };
    }
    
    if (paperData.fundingPeriodDays <= 0) {
      return {
        success: false,
        error: "Funding period must be greater than 0 days"
      };
    }
    
    console.log("Connection Info:", getConnectionInfo());
    console.log("Wallet Public Key:", getWalletPublicKey(wallet).toString());
    
    // Initialize program
    const program = initializeProgram(wallet);
    
    // Submit paper (this will auto-initialize if needed)
    const result = await submitPaperOptimal(program, wallet, paperData);
    
    return result;
  } catch (error) {
    console.error("submitPaperWorkflow error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred while submitting paper"
    };
  }
}

// Helper function to check if wallet is properly connected
export function isWalletConnected(wallet: any): boolean {
  try {
    return !!(wallet && getWalletPublicKey(wallet));
  } catch {
    return false;
  }
}

// Helper function to get connection info for debugging
export function getConnectionInfo() {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8899";
  return {
    rpcUrl,
    isLocal: rpcUrl.includes("localhost") || rpcUrl.includes("127.0.0.1"),
    programId: PROGRAM_ID.toString()
  };
}

// Fund a paper function
export async function fundPaper(
  program: anchor.Program<BioxResearch>,
  wallet: any,
  paperId: number,
  amount: number, // Amount in token units (will be converted to smallest units)
  funderTokenAccount: PublicKey
) {
  try {
    const paperIdBN = new anchor.BN(paperId);
    const amountBN = new anchor.BN(amount);
    
    // Get required PDAs
    const [paperPda] = getPaperPda(paperIdBN);
    const [paperTokenAccountPda] = getPaperTokenAccountPda(paperIdBN);
    const [platformVaultPda] = getPlatformVaultPda();
    const [fundingPda] = getFundingPda(paperIdBN, getWalletPublicKey(wallet));
    const [programStatePda] = getProgramStatePda();

    console.log("Funding paper with PDAs:", {
      paperPda: paperPda.toString(),
      paperTokenAccountPda: paperTokenAccountPda.toString(),
      platformVaultPda: platformVaultPda.toString(),
      fundingPda: fundingPda.toString(),
      funderTokenAccount: funderTokenAccount.toString()
    });    const txBuilder = program.methods
      .fundPaper(paperIdBN, amountBN)
      .accounts({
        funder: getWalletPublicKey(wallet),
        funderTokenAccount: funderTokenAccount,
      });

    const signature = await txBuilder.rpc();
    console.log("Fund paper transaction sent:", signature);

    // Wait for confirmation
    await program.provider.connection.confirmTransaction(signature, "confirmed");
    console.log("Fund paper transaction confirmed");

    return {
      success: true,
      txHash: signature
    };

  } catch (error) {
    console.error("Error funding paper:", error);
    
    if (error instanceof anchor.AnchorError) {
      console.error("Anchor Error Code:", error.error.errorCode.number);
      console.error("Anchor Error Message:", error.error.errorMessage);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Vote on a paper function
export async function votePaper(
  program: anchor.Program<BioxResearch>,
  wallet: any,
  paperId: number,
  isUpvote: boolean,
  voterTokenAccount: PublicKey
) {
  try {
    const walletPublicKey = getWalletPublicKey(wallet);
    
    // Check if user has already voted
    const hasVoted = await hasUserVoted(program, paperId, walletPublicKey);
    if (hasVoted) {
      return {
        success: false,
        error: `You have already voted on paper #${paperId}. Each user can only vote once per paper.`
      };
    }
    
    const paperIdBN = new anchor.BN(paperId);
    
    console.log("Voting on paper with details:", {
      paperId: paperId,
      isUpvote: isUpvote,
      voter: walletPublicKey.toString(),
      voterTokenAccount: voterTokenAccount.toString()
    });

    const txBuilder = program.methods
      .votePaper(paperIdBN, isUpvote)
      .accounts({
        voter: walletPublicKey,
        voterTokenAccount: voterTokenAccount,
      });

    const signature = await txBuilder.rpc();
    console.log("Vote paper transaction sent:", signature);

    // Wait for confirmation
    await program.provider.connection.confirmTransaction(signature, "confirmed");
    console.log("Vote paper transaction confirmed");

    return {
      success: true,
      txHash: signature
    };

  } catch (error) {
    console.error("Error voting on paper:", error);
    
    if (error instanceof anchor.AnchorError) {
      console.error("Anchor Error Code:", error.error.errorCode.number);
      console.error("Anchor Error Message:", error.error.errorMessage);
      
      // Check for specific error codes
      if (error.error.errorCode.number === 0) {
        return {
          success: false,
          error: "This vote account already exists. You may have already voted on this paper."
        };
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Check if user has already voted on a paper
export async function hasUserVoted(
  program: anchor.Program<BioxResearch>,
  paperId: number,
  voter: PublicKey
): Promise<boolean> {
  try {
    const paperIdBN = new anchor.BN(paperId);
    const [votePda] = getVotePda(paperIdBN, voter);
    
    console.log("Checking if user has voted:", {
      paperId,
      voter: voter.toString(),
      votePda: votePda.toString()
    });
    
    // Try to fetch the vote account
    await program.account.vote.fetch(votePda);
    console.log("User has already voted on this paper");
    return true; // Vote exists
  } catch (error: any) {
    // If account doesn't exist, user hasn't voted
    if (error.message && (
      error.message.includes("Account does not exist") ||
      error.message.includes("Invalid account discriminator") ||
      error.message.includes("AccountNotFound")
    )) {
      console.log("User has not voted on this paper yet");
      return false;
    }
    
    // Log unexpected errors but assume user hasn't voted
    console.warn("Unexpected error checking vote status:", error);
    return false;
  }
}

// Updated vote paper workflow function with better error handling
export async function votePaperWorkflow(
  wallet: any,
  paperId: number,
  isUpvote: boolean,
  voterTokenAccount?: PublicKey // Make optional, will create if needed
) {
  try {
    // Validate wallet first
    if (!wallet) {
      return {
        success: false,
        error: "Wallet is required"
      };
    }
    
    // Check if wallet is connected
    if (!isWalletConnected(wallet)) {
      return {
        success: false,
        error: "Wallet is not connected"
      };
    }
    
    // Validate inputs
    if (paperId < 0) {
      return {
        success: false,
        error: "Invalid paper ID"
      };
    }
    
    console.log("Connection Info:", getConnectionInfo());
    console.log("Wallet Public Key:", getWalletPublicKey(wallet).toString());
    
    // Initialize program
    const program = initializeProgram(wallet);
    
    // Get or create voter token account if not provided
    let finalVoterTokenAccount = voterTokenAccount;
    if (!finalVoterTokenAccount) {
      const userPublicKey = getWalletPublicKey(wallet);
      const currentMint = getCurrentTokenMint();
      
      try {
        finalVoterTokenAccount = await getAssociatedTokenAddress(
          currentMint,
          userPublicKey
        );
        
        // Ensure the account exists
        const connection = program.provider.connection;
        const accountInfo = await connection.getAccountInfo(finalVoterTokenAccount);
        
        if (!accountInfo) {
          // Create the token account
          const createATAIx = createAssociatedTokenAccountInstruction(
            userPublicKey, // payer
            finalVoterTokenAccount, // associatedToken
            userPublicKey, // owner
            currentMint // mint
          );
          
          const transaction = new Transaction().add(createATAIx);
          const signature = await sendTransactionWithWallet(wallet, transaction, connection);
          await connection.confirmTransaction(signature, "confirmed");
          
          console.log("Created voter token account:", finalVoterTokenAccount.toString());
        }
      } catch (error) {
        console.error("Error setting up voter token account:", error);
        return {
          success: false,
          error: "Failed to set up token account for voting"
        };
      }
    }
    
    // Check if paper exists and is published first
    const paperResult = await getPaperDetails(program, paperId);
    if (!paperResult.success) {
      return {
        success: false,
        error: `Paper #${paperId} not found. ${paperResult.error}`
      };
    }
    
    // Check paper status - only allow voting on published papers
    if (!paperResult.data) {
      return {
        success: false,
        error: `Paper #${paperId} data could not be loaded.`
      };
    }
    
    const statusKey = Object.keys(paperResult.data.status)[0];
    if (statusKey !== 'published' && statusKey !== 'fullyFunded') {
      return {
        success: false,
        error: `Cannot vote on paper with status '${statusKey}'. Paper must be published to receive votes.`
      };
    }
    
    // Vote on paper (this includes the hasUserVoted check)
    const result = await votePaper(program, wallet, paperId, isUpvote, finalVoterTokenAccount);
    
    return result;
  } catch (error) {
    console.error("votePaperWorkflow error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred while voting on paper"
    };
  }
}

// Enhanced getVoteDetails function with better error handling
export async function getVoteDetails(
  program: anchor.Program<BioxResearch>,
  paperId: number,
  voter: PublicKey
) {
  try {
    const paperIdBN = new anchor.BN(paperId);
    const [votePda] = getVotePda(paperIdBN, voter);
    
    console.log("Fetching vote details:", {
      paperId,
      voter: voter.toString(),
      votePda: votePda.toString()
    });
    
    const vote = await program.account.vote.fetch(votePda);
    
    return {
      success: true,
      data: {
        paperId: vote.paperId.toString(),
        voter: vote.voter.toString(),
        isUpvote: vote.isUpvote,
        weight: vote.weight.toString(),
        timestamp: vote.timestamp.toString(),
        pda: votePda.toString()
      }
    };
  } catch (error: any) {
    console.log("Vote details not found:", error.message);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Vote not found"
    };
  }
}

// Fund paper workflow function
export async function fundPaperWorkflow(
  wallet: any,
  paperId: number,
  amount: number,
  tokenMint: PublicKey = BIOX_TOKEN_MINT
) {
  try {
    console.log("Starting funding workflow...");
    console.log("Paper ID:", paperId);
    console.log("Amount:", amount);
    console.log("Token Mint:", tokenMint.toString());
    
    // Initialize program
    const program = initializeProgram(wallet);
    
    // Use the enhanced funding function
    const result = await fundPaperWithTokenAccountCreation(
      program,
      wallet,
      paperId,
      amount,
      tokenMint
    );
    
    return result;
    
  } catch (error: any) {
    console.error("Funding workflow error:", error);
    return {
      success: false,
      error: error.message || "Failed to complete funding workflow"
    };
  }
}

// Publish a paper function
export async function publishPaper(
  program: anchor.Program<BioxResearch>,
  wallet: any,
  paperId: number
) {
  try {
    const paperIdBN = new anchor.BN(paperId);
    
    // Get required PDAs
    const [paperPda] = getPaperPda(paperIdBN);
    const [programStatePda] = getProgramStatePda();

    console.log("Publishing paper with PDAs:", {
      paperPda: paperPda.toString(),
      programStatePda: programStatePda.toString(),
      authority: getWalletPublicKey(wallet).toString()
    });

    const txBuilder = program.methods
      .publishPaper(paperIdBN)
      .accounts({
        authority: getWalletPublicKey(wallet),
      });

    const signature = await txBuilder.rpc();
    console.log("Publish paper transaction sent:", signature);

    // Wait for confirmation
    await program.provider.connection.confirmTransaction(signature, "confirmed");
    console.log("Publish paper transaction confirmed");

    return {
      success: true,
      txHash: signature
    };

  } catch (error) {
    console.error("Error publishing paper:", error);
    
    if (error instanceof anchor.AnchorError) {
      console.error("Anchor Error Code:", error.error.errorCode.number);
      console.error("Anchor Error Message:", error.error.errorMessage);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Publish paper workflow function
export async function publishPaperWorkflow(
  wallet: any,
  paperId: number
) {
  try {
    // Validate wallet first
    if (!wallet) {
      return {
        success: false,
        error: "Wallet is required"
      };
    }
    
    // Check if wallet is connected
    if (!isWalletConnected(wallet)) {
      return {
        success: false,
        error: "Wallet is not connected"
      };
    }
    
    // Validate inputs
    if (paperId < 0) {
      return {
        success: false,
        error: "Invalid paper ID"
      };
    }
    
    console.log("Connection Info:", getConnectionInfo());
    console.log("Wallet Public Key:", getWalletPublicKey(wallet).toString());
    
    // Initialize program
    const program = initializeProgram(wallet);
    
    // Publish paper
    const result = await publishPaper(program, wallet, paperId);
    
    return result;
  } catch (error) {
    console.error("publishPaperWorkflow error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred while publishing paper"
    };
  }
}

// Token account utilities
export async function ensureTokenAccount(
  connection: Connection,
  wallet: any,
  tokenMint: PublicKey,
  owner: PublicKey
) {
  try {
    const associatedTokenAddress = getAssociatedTokenAddressSync(
      tokenMint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
    
    if (!accountInfo) {
      console.log("Token account doesn't exist, creating it...");      const transaction = new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          getWalletPublicKey(wallet), // payer
          associatedTokenAddress,     // associatedToken
          owner,                      // owner
          tokenMint,                  // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      const signature = await sendTransactionWithWallet(wallet, transaction, connection);
      
      console.log("Token account created:", associatedTokenAddress.toString());
    }

    return {
      success: true,
      tokenAccount: associatedTokenAddress
    };
  } catch (error) {
    console.error("Error ensuring token account:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create token account"
    };
  }
}

// Updated funding function with token account creation
export async function fundPaperWithTokenCreation(
  program: anchor.Program<BioxResearch>,
  wallet: any,
  paperId: number,
  amount: number,
  tokenMint: PublicKey
) {
  try {
    const userPublicKey = getWalletPublicKey(wallet);
    
    // Ensure token account exists
    const tokenAccountResult = await ensureTokenAccount(
      program.provider.connection,
      wallet,
      tokenMint,
      userPublicKey
    );    if (!tokenAccountResult.success || !tokenAccountResult.tokenAccount) {
      return {
        success: false,
        error: `Failed to create token account: ${tokenAccountResult.error || "Unknown error"}`
      };
    }

    // Now proceed with funding
    const result = await fundPaper(
      program,
      wallet,
      paperId,
      amount,
      tokenAccountResult.tokenAccount
    );

    return result;
  } catch (error) {
    console.error("Error funding paper with token creation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Alternative: Fund with native SOL (simpler approach)
export async function fundPaperWithSOL(
  program: anchor.Program<BioxResearch>,
  wallet: any,
  paperId: number,
  amountInSOL: number
) {
  try {
    const walletPublicKey = getWalletPublicKey(wallet);
    const paperIdBN = new anchor.BN(paperId);
    
    // Get paper PDA to check if it exists and is published
    const [paperPda] = getPaperPda(paperIdBN);
      try {
      console.log("Attempting to fetch paper:", {
        paperId: paperId,
        paperPda: paperPda.toString()
      });
      
      const paperAccount = await program.account.researchPaper.fetch(paperPda);
      
      console.log("Paper found:", {
        title: paperAccount.title,
        status: paperAccount.status,
        author: paperAccount.author.toString()
      });
      
      // Check if paper is published
      const statusKey = Object.keys(paperAccount.status)[0];
      if (statusKey !== 'published') {
        return {
          success: false,
          error: `Paper status is '${statusKey}' - paper must be published before it can be funded`
        };
      }
      
      // Convert SOL to lamports
      const amountInLamports = Math.floor(amountInSOL * LAMPORTS_PER_SOL);
      
      console.log("Funding paper with SOL:", {
        paperId: paperId,
        amountInSOL: amountInSOL,
        amountInLamports: amountInLamports,
        paperPda: paperPda.toString(),
        authorPubkey: paperAccount.author.toString()
      });      // For now, we'll do a simple SOL transfer to the paper author
      // In a production environment, you'd want the contract to handle this
      const authorPublicKey = paperAccount.author;
      
      const connection = program.provider.connection;
      
      console.log("Transferring SOL from:", walletPublicKey.toString());
      console.log("Transferring SOL to:", authorPublicKey.toString());
      console.log("Amount in lamports:", amountInLamports);
      
      // Use a simpler approach - let the wallet handle the transaction
      let signature: string;
      
      try {
        // Create the transfer instruction
        const transferInstruction = SystemProgram.transfer({
          fromPubkey: walletPublicKey,
          toPubkey: authorPublicKey,
          lamports: amountInLamports,
        });
          // Create transaction
        const transaction = new Transaction().add(transferInstruction);
        
        // Send transaction using helper function
        signature = await sendTransactionWithWallet(wallet, transaction, connection);
        
        console.log("SOL funding transaction completed:", signature);
      } catch (txError: any) {
        console.error("Transaction error:", txError);
        throw new Error(`Failed to send transaction: ${txError.message}`);
      }
      
      console.log("SOL funding transaction completed:", signature);
      
      return { 
        success: true, 
        txHash: signature,
        message: `Successfully funded ${amountInSOL} SOL to paper #${paperId}`
      };
    } catch (fetchError: any) {
      console.error("Error fetching paper:", fetchError);
      
      // Check if it's an account not found error
      if (fetchError.message && fetchError.message.includes("Account does not exist")) {
        return {
          success: false,
          error: `Paper #${paperId} does not exist on the blockchain. Make sure the paper has been submitted first.`
        };
      }
      
      return {
        success: false,
        error: `Failed to find paper #${paperId}: ${fetchError.message || "Unknown error"}`
      };
    }
  } catch (error: any) {
    console.error('Fund paper with SOL error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to fund paper with SOL',
      logs: error.logs 
    };
  }
}

// Updated SOL funding workflow
export async function fundPaperWorkflowSOL(
  wallet: any,
  paperId: number,
  amountInSOL: number
) {
  try {
    // Validate wallet first
    if (!wallet) {
      return {
        success: false,
        error: "Wallet is required"
      };
    }
    
    // Check if wallet is connected
    if (!isWalletConnected(wallet)) {
      return {
        success: false,
        error: "Wallet is not connected"
      };
    }
    
    // Validate inputs
    if (paperId < 0) {
      return {
        success: false,
        error: "Invalid paper ID"
      };
    }
    
    if (amountInSOL <= 0) {
      return {
        success: false,
        error: "Amount must be greater than 0 SOL"
      };
    }
    
    console.log("Connection Info:", getConnectionInfo());
    console.log("Wallet Public Key:", getWalletPublicKey(wallet).toString());
    
    // Initialize program
    const program = initializeProgram(wallet);
    
    // Fund paper with SOL
    const result = await fundPaperWithSOL(program, wallet, paperId, amountInSOL);
    
    return result;
  } catch (error) {
    console.error("fundPaperWorkflowSOL error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred while funding paper with SOL"
    };
  }
}

// SPL Token Management Functions

// Create a new SPL token mint for the BioX platform
export async function createBioXTokenMint(
  wallet: any,
  connection: Connection,
  decimals: number = 6
) {
  try {
    const walletPublicKey = getWalletPublicKey(wallet);
    
    // Generate a new keypair for the mint
    const mintKeypair = Keypair.generate();
    
    // Calculate rent-exempt balance for mint account
    const rentExemptBalance = await getMinimumBalanceForRentExemptMint(connection);
    
    // Create mint account transaction
    const createMintAccountIx = SystemProgram.createAccount({
      fromPubkey: walletPublicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: getMintLen([]),
      lamports: rentExemptBalance,
      programId: TOKEN_PROGRAM_ID,
    });
    
    // Initialize mint instruction
    const initializeMintIx = createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      walletPublicKey, // mint authority
      walletPublicKey  // freeze authority
    );
      // Create transaction
    const transaction = new Transaction()
      .add(createMintAccountIx)
      .add(initializeMintIx);
    
    // Sign with mint keypair
    transaction.partialSign(mintKeypair);
    
    // Send transaction using helper function
    const signature = await sendTransactionWithWallet(wallet, transaction, connection);
    
    console.log("BioX token mint created:", mintKeypair.publicKey.toString());
    
    return {
      success: true,
      mintAddress: mintKeypair.publicKey,
      signature: signature
    };
  } catch (error: any) {
    console.error("Error creating token mint:", error);
    return {
      success: false,
      error: error.message || "Failed to create token mint"
    };
  }
}

// Mint tokens to a user's account (wrapper for enhanced function)
export async function mintBioXTokens(
  wallet: any,
  connection: Connection,
  mintAddress: PublicKey,
  recipientAddress: PublicKey,
  amount: number // Amount in token units (will be adjusted for decimals)
) {
  // Use the enhanced version that handles both custom tokens and USDC
  return await mintBioXTokensEnhanced(wallet, connection, mintAddress, recipientAddress, amount);
}

// Enhanced mintBioXTokens function to work with USDC and custom tokens
export async function mintBioXTokensEnhanced(
  wallet: any,
  connection: Connection,
  mintAddress: PublicKey,
  recipientAddress: PublicKey,
  amount: number // Amount in token units (will be adjusted for decimals)
) {
  try {
    const walletPublicKey = getWalletPublicKey(wallet);
    
    // Get mint info to determine decimals
    const mintInfo = await connection.getAccountInfo(mintAddress);
    if (!mintInfo) {
      throw new Error("Mint account does not exist");
    }
    
    // Get or create associated token account for recipient
    const recipientTokenAccount = getAssociatedTokenAddressSync(
      mintAddress,
      recipientAddress
    );
    
    // Check if token account exists
    const accountInfo = await connection.getAccountInfo(recipientTokenAccount);
    
    const instructions = [];
    
    // Create token account if it doesn't exist
    if (!accountInfo) {
      console.log("Creating token account for:", recipientAddress.toString());
      instructions.push(
        createAssociatedTokenAccountInstruction(
          walletPublicKey, // payer
          recipientTokenAccount, // associatedToken
          recipientAddress, // owner
          mintAddress // mint
        )
      );
    }
    
    // Check if wallet has mint authority for this token
    // For USDC devnet, typically the wallet won't have mint authority
    // For custom tokens created by the wallet, it will have mint authority
    try {
      // Add mint instruction (this will fail if wallet doesn't have mint authority)
      instructions.push(
        createMintToInstruction(
          mintAddress, // mint
          recipientTokenAccount, // destination
          walletPublicKey, // authority
          amount * Math.pow(10, 6) // amount with decimals (assuming 6 decimals)
        )
      );
      
      // Create transaction
      const transaction = new Transaction().add(...instructions);
      
      // Send transaction using helper function
      const signature = await sendTransactionWithWallet(wallet, transaction, connection);
      
      console.log(`Minted ${amount} tokens to ${recipientAddress.toString()}`);
      
      return {
        success: true,
        signature: signature,
        tokenAccount: recipientTokenAccount,
        message: `Successfully minted ${amount} tokens`
      };
      
    } catch (mintError: any) {
      // If minting fails due to authority issues, just create the account
      if (mintError.message?.includes("authority") || mintError.message?.includes("unauthorized")) {
        console.log("No mint authority - creating token account only");
        
        if (instructions.length === 1) { // Only account creation instruction
          const transaction = new Transaction().add(instructions[0]);
          const signature = await sendTransactionWithWallet(wallet, transaction, connection);
          
          return {
            success: true,
            signature: signature,
            tokenAccount: recipientTokenAccount,
            message: "Token account created. You'll need to get tokens from a faucet or exchange.",
            needsFaucet: true
          };
        }
      }
      throw mintError;
    }
    
  } catch (error: any) {
    console.error("Error minting tokens:", error);
    return {
      success: false,
      error: error.message || "Failed to mint tokens"
    };
  }
}

// Simplified function to just create a USDC token account
export async function createUSDCAccount(
  wallet: any,
  connection: Connection,
  recipientAddress: PublicKey
) {
  try {
    const walletPublicKey = getWalletPublicKey(wallet);
    const usdcMint = BIOX_TOKEN_MINT; // Using the USDC devnet
    
    // Get associated token account address
    const recipientTokenAccount = getAssociatedTokenAddressSync(
      usdcMint,
      recipientAddress
    );
    
    // Check if account already exists
    const accountInfo = await connection.getAccountInfo(recipientTokenAccount);
    
    if (accountInfo) {
      return {
        success: true,
        tokenAccount: recipientTokenAccount,
        message: "USDC token account already exists",
        alreadyExists: true
      };
    }
    
    // Create the associated token account
    const instruction = createAssociatedTokenAccountInstruction(
      walletPublicKey, // payer
      recipientTokenAccount, // associatedToken
      recipientAddress, // owner
      usdcMint // mint
    );
    
    const transaction = new Transaction().add(instruction);
    const signature = await sendTransactionWithWallet(wallet, transaction, connection);
    
    console.log("USDC token account created:", recipientTokenAccount.toString());
    
    return {
      success: true,
      signature: signature,
      tokenAccount: recipientTokenAccount,
      message: "USDC token account created successfully. Use a devnet faucet to get test USDC tokens."
    };
    
  } catch (error: any) {
    console.error("Error creating USDC account:", error);
    return {
      success: false,
      error: error.message || "Failed to create USDC token account"
    };
  }
}

// Airdrop USDC tokens for testing (devnet only)
export async function airdropUSDC(
  wallet: any,
  connection: Connection,
  recipientAddress: PublicKey,
  amount: number // Amount in USDC (e.g., 100 for 100 USDC)
) {
  try {
    const walletPublicKey = getWalletPublicKey(wallet);
    
    // Use devnet USDC mint address
    const usdcMint = BIOX_TOKEN_MINT;
    
    // Get or create associated token account for recipient
    const recipientTokenAccount = getAssociatedTokenAddressSync(
      usdcMint,
      recipientAddress
    );
    
    // Check if token account exists
    const accountInfo = await connection.getAccountInfo(recipientTokenAccount);
    
    const instructions = [];
    
    // Create token account if it doesn't exist
    if (!accountInfo) {
      console.log("Creating USDC token account for:", recipientAddress.toString());
      instructions.push(
        createAssociatedTokenAccountInstruction(
          walletPublicKey, // payer
          recipientTokenAccount, // associatedToken
          recipientAddress, // owner
          usdcMint // mint
        )
      );
    }
    
    // For devnet testing, we'll simulate minting by using a faucet-like approach
    // In a real scenario, you'd need mint authority or use a proper faucet
    console.log("Note: For devnet USDC, you might need to use the official Solana faucet or request tokens from a devnet faucet");
    
    // If this is a custom mint (not the official USDC), we can mint
    // For official USDC, users need to get tokens from exchanges or faucets
    const isCustomMint = !usdcMint.equals(new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"));
    
    if (isCustomMint) {
      // Add mint instruction (only works if wallet has mint authority)
      instructions.push(
        createMintToInstruction(
          usdcMint, // mint
          recipientTokenAccount, // destination
          walletPublicKey, // authority
          amount * Math.pow(10, 6) // amount with decimals (USDC has 6 decimals)
        )
      );
    }
    
    if (instructions.length > 0) {
      // Create transaction
      const transaction = new Transaction().add(...instructions);
      
      // Send transaction using helper function
      const signature = await sendTransactionWithWallet(wallet, transaction, connection);
      
      console.log(`USDC token account setup completed for ${recipientAddress.toString()}`);
      
      return {
        success: true,
        signature: signature,
        tokenAccount: recipientTokenAccount,
        message: isCustomMint ? 
          `Minted ${amount} USDC tokens` : 
          "USDC token account created. Use a devnet faucet to get test USDC tokens."
      };
    } else {
      return {
        success: true,
        tokenAccount: recipientTokenAccount,
        message: "USDC token account already exists. Use a devnet faucet to get test USDC tokens.",
        needsFaucet: true
      };
    }
    
  } catch (error: any) {
    console.error("Error setting up USDC:", error);
    return {
      success: false,
      error: error.message || "Failed to setup USDC token account"
    };
  }
}

// Function to check if user has a USDC token account and balance
export async function checkUSDCAccountStatus(
  connection: Connection,
  userPublicKey: PublicKey
) {
  try {
    const usdcMint = BIOX_TOKEN_MINT;
    const tokenAccount = getAssociatedTokenAddressSync(usdcMint, userPublicKey);
    
    // Check if account exists
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    
    if (!accountInfo) {
      return {
        success: true,
        exists: false,
        balance: 0,
        tokenAccount: tokenAccount,
        message: "USDC token account does not exist"
      };
    }
    
    // Get balance
    try {
      const balanceInfo = await connection.getTokenAccountBalance(tokenAccount);
      
      return {
        success: true,
        exists: true,
        balance: parseFloat(balanceInfo.value.amount) / Math.pow(10, balanceInfo.value.decimals),
        rawBalance: balanceInfo.value.amount,
        decimals: balanceInfo.value.decimals,
        tokenAccount: tokenAccount
      };
    } catch (balanceError) {
      return {
        success: true,
        exists: true,
        balance: 0,
        tokenAccount: tokenAccount,
        message: "Account exists but balance could not be determined"
      };
    }
    
  } catch (error: any) {
    console.error("Error checking USDC account status:", error);
    return {
      success: false,
      error: error.message || "Failed to check USDC account status"
    };
  }
}

// Updated sendTransactionWithWallet function with better error handling
async function sendTransactionWithWallet(
  wallet: any,
  transaction: Transaction,
  connection: Connection
): Promise<string> {
  try {
    const walletPublicKey = getWalletPublicKey(wallet);
    
    // Set recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;
    
    console.log("Attempting to send transaction with wallet methods...");
    
    // Method 1: Try sendTransaction first (most compatible)
    if (wallet.sendTransaction) {
      console.log("Using wallet.sendTransaction");
      try {
        const signature = await wallet.sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");
        return signature;
      } catch (sendError) {
        console.warn("wallet.sendTransaction failed, trying alternatives:", sendError);
      }
    }
    
    // Method 2: Try adapter's sendTransaction
    if (wallet.adapter?.sendTransaction) {
      console.log("Using wallet.adapter.sendTransaction");
      try {
        const signature = await wallet.adapter.sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");
        return signature;
      } catch (sendError) {
        console.warn("wallet.adapter.sendTransaction failed, trying alternatives:", sendError);
      }
    }
    
    // Method 3: Try signTransaction and manual send
    let signedTransaction;
    if (wallet.signTransaction) {
      console.log("Using wallet.signTransaction");
      try {
        signedTransaction = await wallet.signTransaction(transaction);
      } catch (signError) {
        console.warn("wallet.signTransaction failed:", signError);
      }
    } else if (wallet.adapter?.signTransaction) {
      console.log("Using wallet.adapter.signTransaction");
      try {
        signedTransaction = await wallet.adapter.signTransaction(transaction);
      } catch (signError) {
        console.warn("wallet.adapter.signTransaction failed:", signError);
      }
    }
    
    if (signedTransaction) {
      // Send the signed transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    }
    
    throw new Error("Wallet does not support any compatible transaction methods. Please try a different wallet like Phantom or Solflare.");
    
  } catch (error: any) {
    console.error("Error sending transaction:", error);
    
    // Provide more specific error messages
    if (error.message?.includes("User rejected")) {
      throw new Error("Transaction was rejected by user");
    } else if (error.message?.includes("insufficient funds")) {
      throw new Error("Insufficient funds for transaction");
    } else if (error.message?.includes("does not support")) {
      throw new Error("Please connect a wallet that supports transaction signing (like Phantom or Solflare)");
    } else if (error.message?.includes("this.emit")) {
      throw new Error("Wallet connection error. Please disconnect and reconnect your wallet.");
    }
    
    throw error;
  }
}

// Get or create a user's token account (simplified for existing tokens like USDC)
export async function setupUserTokenAccount(
  wallet: any,
  tokenMint: PublicKey,
  userPublicKey: PublicKey,
  initialAmount: number = 0 // Don't mint by default
) {
  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8899",
      "confirmed"
    );
    
    console.log("Setting up token account for user:", userPublicKey.toString());
    console.log("Token mint:", tokenMint.toString());
    
    // First ensure the user has a token account
    const tokenAccountResult = await ensureTokenAccount(
      connection,
      wallet,
      tokenMint,
      userPublicKey
    );
    
    if (!tokenAccountResult.success) {
      return tokenAccountResult;
    }
    
    console.log("Token account setup successful:", tokenAccountResult.tokenAccount?.toString());
    
    return {
      success: true,
      tokenAccount: tokenAccountResult.tokenAccount,
      message: "Token account set up successfully. You can now fund papers with tokens."
    };
  } catch (error: any) {
    console.error("Error setting up user token account:", error);
    return {
      success: false,
      error: error.message || "Failed to set up token account"
    };
  }
}

// Get user's token balance
export async function getUserTokenBalance(
  wallet: { publicKey?: PublicKey },
  tokenMint: PublicKey = getCurrentTokenMint()
) {
  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8899",
      "confirmed"
    );
    
    if (!wallet.publicKey) {
      return {
        success: true,
        balance: 0,
        rawBalance: "0",
        decimals: 9 // BIOX token has 9 decimals
      };
    }
    
    // Get associated token account address
    const tokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      wallet.publicKey
    );
    
    // Get account info
    const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
    
    if (accountInfo && accountInfo.value) {
      return {
        success: true,
        balance: parseFloat(accountInfo.value.amount) / Math.pow(10, accountInfo.value.decimals),
        rawBalance: accountInfo.value.amount,
        decimals: accountInfo.value.decimals
      };
    } else {
      return {
        success: true,
        balance: 0,
        rawBalance: "0",
        decimals: 9
      };
    }
  } catch (error) {
    console.error("Error getting token balance:", error);
    
    // If account doesn't exist, return 0 balance
    if (error instanceof Error && error.message.includes("could not find account")) {
      return {
        success: true,
        balance: 0,
        rawBalance: "0",
        decimals: 9
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get token balance",
      balance: 0,
      rawBalance: "0",
      decimals: 9
    };
  }
}

// Get user's SOL balance
export async function getUserSOLBalance(wallet: any) {
  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8899",
      "confirmed"
    );
    
    const walletPublicKey = getWalletPublicKey(wallet);
    const balance = await connection.getBalance(walletPublicKey);
    
    return {
      success: true,
      balance: balance / LAMPORTS_PER_SOL,
      rawBalance: balance.toString()
    };
  } catch (error) {
    console.error("Error getting SOL balance:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get SOL balance",
      balance: 0,
      rawBalance: "0"
    };
  }
}

// Add this to your solana.ts
export async function setupTestingEnvironment(wallet: any) {
  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8899",
      "confirmed"
    );
    
    const userPublicKey = getWalletPublicKey(wallet);
    
    // For local testing, you can request an airdrop
    if (process.env.NEXT_PUBLIC_RPC_URL?.includes("localhost")) {
      try {
        const airdropSignature = await connection.requestAirdrop(
          userPublicKey,
          2 * LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(airdropSignature);
        console.log("SOL airdrop completed");
      } catch (error) {
        console.log("Airdrop failed (might already have enough SOL)");
      }
    }
    
    // Create token account if needed
    const tokenAccount = getAssociatedTokenAddressSync(
      BIOX_TOKEN_MINT,
      userPublicKey
    );
    
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    if (!accountInfo) {
      const createATAIx = createAssociatedTokenAccountInstruction(
        userPublicKey,
        tokenAccount,
        userPublicKey,
        BIOX_TOKEN_MINT
      );
      
      const transaction = new Transaction().add(createATAIx);
      await sendTransactionWithWallet(wallet, transaction, connection);
      console.log("Token account created");
    }
    
    return {
      success: true,
      tokenAccount: tokenAccount,
      message: "Testing environment setup complete"
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Setup failed"
    };
  }
}

// Add this enhanced funding function that ensures token accounts exist
export async function fundPaperWithTokenAccountCreation(
  program: anchor.Program<BioxResearch>,
  wallet: any,
  paperId: number,
  amount: number,
  tokenMint: PublicKey = BIOX_TOKEN_MINT
) {
  try {
    const connection = program.provider.connection;
    const funderPublicKey = getWalletPublicKey(wallet);
    
    // 1. Ensure funder has a token account for the specified mint
    console.log("Ensuring funder token account exists...");
    const funderTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      tokenMint,
      funderPublicKey
    );
    
    console.log("Funder token account:", funderTokenAccount.address.toString());
    
    // 2. Check funder's token balance
    const funderBalance = await connection.getTokenAccountBalance(funderTokenAccount.address);
    const requiredAmount = amount * Math.pow(10, 6); // Assuming 6 decimals
    
    if (funderBalance.value.uiAmount === null || funderBalance.value.uiAmount < amount) {
      return {
        success: false,
        error: `Insufficient token balance. You have ${funderBalance.value.uiAmount || 0} tokens, but need ${amount} tokens.`,
        needsTokens: true
      };
    }
    
    // 3. Get all required PDAs as per the contract
    const paperIdBN = new anchor.BN(paperId);
    const [paperPda] = getPaperPda(paperIdBN);
    const [paperTokenAccountPda] = getPaperTokenAccountPda(paperIdBN);
    const [platformTokenAccountPda] = getPlatformVaultPda();
    const [fundingPda] = getFundingPda(paperIdBN, funderPublicKey);
    const [programStatePda] = getProgramStatePda();
    
    console.log("PDAs:", {
      paperPda: paperPda.toString(),
      paperTokenAccountPda: paperTokenAccountPda.toString(),
      platformTokenAccountPda: platformTokenAccountPda.toString(),
      fundingPda: fundingPda.toString(),
      funderTokenAccount: funderTokenAccount.toString()
    });
    
    // 4. Check if paper exists and is published
    const paper = await program.account.researchPaper.fetch(paperPda);
    if (!paper.isPublished) {
      return {
        success: false,
        error: "Paper must be published before it can be funded"
      };
    }
    
    // 5. Execute funding transaction with exact account structure from IDL
    console.log("Executing funding transaction...");
    const tx = await program.methods
      .fundPaper(paperIdBN, new anchor.BN(requiredAmount))
      .accounts({
        funder: funderPublicKey,
        funderTokenAccount: funderTokenAccount.address,
      })
      .rpc();
    
    console.log("Funding transaction signature:", tx);
    
    return {
      success: true,
      signature: tx,
      message: `Successfully funded paper with ${amount} tokens!`
    };
    
  } catch (error: any) {
    console.error("Funding error:", error);
    
    let errorMessage = "Failed to fund paper";
    
    if (error.message?.includes("InvalidMint")) {
      errorMessage = "Invalid token mint. Please create a valid token mint first.";
    } else if (error.message?.includes("TokenAccountNotFound")) {
      errorMessage = "Token account not found. Please ensure all token accounts are created.";
    } else if (error.message?.includes("InsufficientFunds")) {
      errorMessage = "Insufficient token balance or SOL for transaction fees.";
    } else if (error.logs) {
      const logs = error.logs.join(' ');
      if (logs.includes("Invalid Mint")) {
        errorMessage = "The token mint address is invalid or doesn't exist on this network.";
      }
    }
    
    return {
      success: false,
      error: errorMessage,
      logs: error.logs
    };
  }
}

// Helper function to get or create associated token account
async function getOrCreateAssociatedTokenAccount(
  connection: Connection,
  payer: any,
  mint: PublicKey,
  owner: PublicKey
) {
  try {
    // Calculate the associated token account address
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mint,
      owner,
      false, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    console.log("Associated token address:", associatedTokenAddress.toString());
    
    // Check if account exists
    const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
    
    if (accountInfo) {
      console.log("Token account already exists");
      // Account exists, return it
      return {
        address: associatedTokenAddress,
        mint,
        owner,
        amount: BigInt(0), // We'll get the actual amount separately
      };
    }
    
    console.log("Creating associated token account...");
    
    // Account doesn't exist, create it
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        owner, // payer
        associatedTokenAddress, // associatedToken
        owner, // owner
        mint, // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = owner;
    
    // Send transaction
    const signature = await sendTransactionWithWallet(payer, transaction, connection);
    
    console.log("Token account created. Signature:", signature);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    return {
      address: associatedTokenAddress,
      mint,
      owner,
      amount: BigInt(0),
    };
    
  } catch (error: any) {
    console.error("Error creating token account:", error);
    throw new Error(`Failed to create token account: ${error.message}`);
  }
}

//# sourceMappingURL=biox_research.cjs.map