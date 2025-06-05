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
  ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { BioxResearch } from "./biox_research";
import idl from "./biox_research.json";

// Program ID from the contract
export const PROGRAM_ID = new PublicKey("4TsLtFAfkbpcFjesanK4ojZNTK1bsQPfPuVxt5g19hhM");

// BioX Research Platform Token Mint (using USDC for testing)
// For production, this would be a custom token mint
export const BIOX_TOKEN_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // USDC devnet mint

// Helper function to extract publicKey from wallet
export function getWalletPublicKey(wallet: { adapter?: { publicKey?: PublicKey }; publicKey?: PublicKey }): PublicKey {
  const publicKey = wallet.adapter?.publicKey || wallet.publicKey;
  if (!publicKey) {
    throw new Error("Wallet is not connected or does not have a public key");
  }
  return publicKey;
}

// Helper function to create wallet adapter for Anchor
export function createWalletAdapter(wallet: { 
  adapter?: { 
    publicKey?: PublicKey; 
    signTransaction?: Function; 
    signAllTransactions?: Function; 
  }; 
  publicKey?: PublicKey; 
  signTransaction?: Function; 
  signAllTransactions?: Function; 
}) {
  const publicKey = getWalletPublicKey(wallet);
  
  return {
    publicKey,
    signTransaction: wallet.adapter?.signTransaction?.bind(wallet.adapter) || wallet.signTransaction?.bind(wallet),
    signAllTransactions: wallet.adapter?.signAllTransactions?.bind(wallet.adapter) || wallet.signAllTransactions?.bind(wallet),
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
  voterTokenAccount: PublicKey
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
    const result = await votePaper(program, wallet, paperId, isUpvote, voterTokenAccount);
    
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
  funderTokenAccount: PublicKey
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
    
    if (amount <= 0) {
      return {
        success: false,
        error: "Amount must be greater than 0"
      };
    }
    
    console.log("Connection Info:", getConnectionInfo());
    console.log("Wallet Public Key:", getWalletPublicKey(wallet).toString());
    
    // Initialize program
    const program = initializeProgram(wallet);
    
    // Fund paper
    const result = await fundPaper(program, wallet, paperId, amount, funderTokenAccount);
    
    return result;
  } catch (error) {
    console.error("fundPaperWorkflow error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred while funding paper"
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

// Mint tokens to a user's account
export async function mintBioXTokens(
  wallet: any,
  connection: Connection,
  mintAddress: PublicKey,
  recipientAddress: PublicKey,
  amount: number // Amount in token units (will be adjusted for decimals)
) {
  try {
    const walletPublicKey = getWalletPublicKey(wallet);
    
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
      instructions.push(
        createAssociatedTokenAccountInstruction(
          walletPublicKey, // payer
          recipientTokenAccount, // associatedToken
          recipientAddress, // owner
          mintAddress // mint
        )
      );
    }
    
    // Add mint instruction
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
      tokenAccount: recipientTokenAccount
    };
  } catch (error: any) {
    console.error("Error minting tokens:", error);
    return {
      success: false,
      error: error.message || "Failed to mint tokens"
    };
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

// Helper function to send transactions with proper wallet handling
async function sendTransactionWithWallet(
  wallet: any,
  transaction: Transaction,
  connection: Connection
): Promise<string> {  try {
    const walletPublicKey = getWalletPublicKey(wallet);
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;
    
    // Try different wallet methods - check both wallet and wallet.adapter
    const sendTransaction = wallet.sendTransaction || wallet.adapter?.sendTransaction;
    const signTransaction = wallet.signTransaction || wallet.adapter?.signTransaction;
    const signAndSendTransaction = wallet.signAndSendTransaction || wallet.adapter?.signAndSendTransaction;
    
    if (sendTransaction) {
      // Modern wallet adapter approach
      return await sendTransaction(transaction, connection);
    } else if (signTransaction) {
      // Sign and send manually
      const signedTransaction = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      // Confirm transaction
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, "confirmed");
      
      return signature;
    } else if (signAndSendTransaction) {
      // Legacy wallet approach
      const result = await signAndSendTransaction(transaction);
      return typeof result === 'string' ? result : result.signature;
    } else {
      throw new Error("Wallet does not support transaction sending. Please make sure your wallet is properly connected.");
    }
  } catch (error: any) {
    console.error("Transaction sending error:", error);
    throw new Error(`Failed to send transaction: ${error.message || error}`);
  }
}

// Initialize required token accounts for a paper
export async function initializeRequiredTokenAccounts(
  program: anchor.Program<BioxResearch>,
  wallet: any,
  paperId: number
) {
  try {
    const connection = program.provider.connection;
    const walletPublicKey = getWalletPublicKey(wallet);
    const paperIdBN = new anchor.BN(paperId);
    
    // Get PDAs
    const [paperTokenAccountPda] = getPaperTokenAccountPda(paperIdBN);
    const [platformVaultPda] = getPlatformVaultPda();
    
    console.log("Initializing token accounts for paper:", {
      paperId,
      paperTokenAccountPda: paperTokenAccountPda.toString(),
      platformVaultPda: platformVaultPda.toString()
    });

    const instructions = [];
    
    // Check and create paper token account
    const paperTokenAccountInfo = await connection.getAccountInfo(paperTokenAccountPda);
    if (!paperTokenAccountInfo) {
      console.log("Creating paper token account...");
      
      // Create the token account manually since it's a PDA
      const createAccountIx = SystemProgram.createAccount({
        fromPubkey: walletPublicKey,
        newAccountPubkey: paperTokenAccountPda,
        space: 165, // Token account size
        lamports: await connection.getMinimumBalanceForRentExemption(165),
        programId: TOKEN_PROGRAM_ID,
      });
      
      const initAccountIx = createInitializeAccountInstruction(
        paperTokenAccountPda,
        BIOX_TOKEN_MINT,
        paperTokenAccountPda, // PDA owns itself
        TOKEN_PROGRAM_ID
      );
      
      instructions.push(createAccountIx, initAccountIx);
    }
    
    // Check and create platform vault
    const platformVaultInfo = await connection.getAccountInfo(platformVaultPda);
    if (!platformVaultInfo) {
      console.log("Creating platform vault...");
      
      const createVaultIx = SystemProgram.createAccount({
        fromPubkey: walletPublicKey,
        newAccountPubkey: platformVaultPda,
        space: 165, // Token account size
        lamports: await connection.getMinimumBalanceForRentExemption(165),
        programId: TOKEN_PROGRAM_ID,
      });
      
      const initVaultIx = createInitializeAccountInstruction(
        platformVaultPda,
        BIOX_TOKEN_MINT,
        platformVaultPda, // PDA owns itself
        TOKEN_PROGRAM_ID
      );
      
      instructions.push(createVaultIx, initVaultIx);
    }
    
    // Execute instructions if any
    if (instructions.length > 0) {
      const transaction = new Transaction().add(...instructions);
      const signature = await sendTransactionWithWallet(wallet, transaction, connection);
      
      console.log("Token accounts initialized:", signature);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");
      
      return { success: true, signature };
    }
    
    return { success: true, message: "Token accounts already exist" };
    
  } catch (error) {
    console.error("Error initializing token accounts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to initialize token accounts"
    };
  }
}

// New fund paper function with better error handling and token checks
export async function fundPaperWithTokens(
  program: anchor.Program<BioxResearch>,
  wallet: any,
  paperId: number,
  amountInTokens: number
) {
  try {
    const walletPublicKey = getWalletPublicKey(wallet);
    const paperIdBN = new anchor.BN(paperId);
    
    // Convert to smallest units (assuming 6 decimals like USDC)
    const amountInSmallestUnits = Math.floor(amountInTokens * 1_000_000);
    const amountBN = new anchor.BN(amountInSmallestUnits);
    
    console.log("Funding paper with details:", {
      paperId,
      amountInTokens,
      amountInSmallestUnits,
      funder: walletPublicKey.toString()
    });

    // Step 1: Ensure user has token account
    const funderTokenAccount = getAssociatedTokenAddressSync(
      BIOX_TOKEN_MINT,
      walletPublicKey
    );
    
    // Check if user token account exists and has balance
    const connection = program.provider.connection;
    const funderAccountInfo = await connection.getAccountInfo(funderTokenAccount);
    if (!funderAccountInfo) {
      return {
        success: false,
        error: "You don't have a token account for this token. Please create one first or get some test tokens."
      };
    }

    // Step 2: Initialize required PDA token accounts
    const initResult = await initializeRequiredTokenAccounts(program, wallet, paperId);
    if (!initResult.success) {
      return {
        success: false,
        error: `Failed to initialize token accounts: ${initResult.error}`
      };
    }

    // Step 3: Call the fund_paper instruction
    console.log("Calling fund_paper instruction...");
    
    const txBuilder = program.methods
      .fundPaper(paperIdBN, amountBN)
      .accounts({
        funder: walletPublicKey,
        funderTokenAccount: funderTokenAccount,
        // Other accounts are auto-derived by Anchor based on the IDL
      });

    const signature = await txBuilder.rpc();
    console.log("Fund paper transaction sent:", signature);

    // Wait for confirmation
    await program.provider.connection.confirmTransaction(signature, "confirmed");
    console.log("Fund paper transaction confirmed");

    return {
      success: true,
      txHash: signature,
      message: `Successfully funded ${amountInTokens} tokens to paper #${paperId}`
    };

  } catch (error) {
    console.error("Error funding paper:", error);
    
    if (error instanceof anchor.AnchorError) {
      console.error("Anchor Error Details:", {
        code: error.error.errorCode.number,
        message: error.error.errorMessage,
        logs: error.logs
      });
      
      // Handle specific contract errors
      switch (error.error.errorCode.number) {
        case 6007:
          return { success: false, error: "Paper is not published yet" };
        case 6008:
          return { success: false, error: "Funding deadline has passed" };
        case 6009:
          return { success: false, error: "Invalid funding amount" };
        case 6013:
          return { success: false, error: "Program is currently paused" };
        default:
          return { success: false, error: error.error.errorMessage };
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

// New user token account creation function
export async function createUserTokenAccount(
  wallet: any,
  tokenMint: PublicKey = BIOX_TOKEN_MINT
) {
  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com",
      "confirmed"
    );
    
    const walletPublicKey = getWalletPublicKey(wallet);
    
    // Get associated token account address
    const tokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      walletPublicKey
    );
    
    // Check if it already exists
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    if (accountInfo) {
      return {
        success: true,
        tokenAccount: tokenAccount.toString(),
        message: "Token account already exists"
      };
    }
    
    // Create the associated token account
    const instruction = createAssociatedTokenAccountInstruction(
      walletPublicKey, // payer
      tokenAccount,    // associatedToken
      walletPublicKey, // owner
      tokenMint        // mint
    );
    
    const transaction = new Transaction().add(instruction);
    const signature = await sendTransactionWithWallet(wallet, transaction, connection);
    
    console.log("User token account created:", signature);
    
    return {
      success: true,
      tokenAccount: tokenAccount.toString(),
      signature
    };
    
  } catch (error) {
    console.error("Error creating user token account:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create token account"
    };
  }
}

//# sourceMappingURL=biox_research.cjs.map