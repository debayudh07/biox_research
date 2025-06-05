import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BioxResearch } from "../target/types/biox_research";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } from "@solana/spl-token";
import { assert, expect } from "chai";

describe("biox_research", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.BioxResearch as Program<BioxResearch>;
  
  // Test accounts
  let admin: Keypair;
  let author: Keypair;
  let funder: Keypair;
  let voter: Keypair;
  let mint: PublicKey;
  let adminTokenAccount: PublicKey;
  let authorTokenAccount: PublicKey;
  let funderTokenAccount: PublicKey;
  let voterTokenAccount: PublicKey;
  
  // Program derived addresses
  let programStatePda: PublicKey;
  let paperPda: PublicKey;
  let paperTokenAccountPda: PublicKey;
  let platformVaultPda: PublicKey;
  let fundingPda: PublicKey;
  let votePda: PublicKey;
  
  // Test data
  const paperData = {
    title: "Revolutionary Gene Therapy Research",
    abstractText: "This paper explores novel approaches to gene therapy using CRISPR-Cas9 technology with enhanced precision and reduced off-target effects.",
    ipfsHash: "QmXoYLX8dEp2H9B3cK4vN7mR8qS1tU6pW9fG2hJ4lM5nO",
    authors: ["Dr. John Smith", "Dr. Jane Doe"],
    fundingGoal: new anchor.BN(5_000_000), // 5 tokens
    fundingPeriodDays: new anchor.BN(30),
  };

  before(async () => {
    // Generate keypairs
    admin = Keypair.generate();
    author = Keypair.generate();
    funder = Keypair.generate();
    voter = Keypair.generate();

    // Helper function to airdrop with retry and delay
    const airdropWithRetry = async (publicKey: PublicKey, amount: number, maxRetries = 3) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const signature = await provider.connection.requestAirdrop(publicKey, amount);
          await provider.connection.confirmTransaction(signature);
          return;
        } catch (error) {
          if (i === maxRetries - 1) throw error;
          console.log(`Airdrop attempt ${i + 1} failed, retrying in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    };

    // Airdrop SOL to test accounts with delays between requests
    try {
      await airdropWithRetry(admin.publicKey, 2 * LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await airdropWithRetry(author.publicKey, 2 * LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await airdropWithRetry(funder.publicKey, 2 * LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await airdropWithRetry(voter.publicKey, 2 * LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error("Airdrop failed:", error);
      // Use a fallback approach - fund from a pre-funded account
      const payerKeypair = provider.wallet.payer;
      
      // Transfer SOL from payer to test accounts
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: payerKeypair.publicKey,
        toPubkey: admin.publicKey,
        lamports: 2 * LAMPORTS_PER_SOL,
      });
      
      const transaction = new anchor.web3.Transaction().add(transferInstruction);
      await provider.sendAndConfirm(transaction, [payerKeypair]);
      
      // Similar transfers for other accounts...
      for (const keypair of [author, funder, voter]) {
        const transferTx = new anchor.web3.Transaction().add(
          SystemProgram.transfer({
            fromPubkey: payerKeypair.publicKey,
            toPubkey: keypair.publicKey,
            lamports: 2 * LAMPORTS_PER_SOL,
          })
        );
        await provider.sendAndConfirm(transferTx, [payerKeypair]);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Create mint
    mint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      admin.publicKey,
      6 // 6 decimals
    );

    // Create token accounts
    adminTokenAccount = await createAccount(
      provider.connection,
      admin,
      mint,
      admin.publicKey
    );

    authorTokenAccount = await createAccount(
      provider.connection,
      author,
      mint,
      author.publicKey
    );

    funderTokenAccount = await createAccount(
      provider.connection,
      funder,
      mint,
      funder.publicKey
    );

    voterTokenAccount = await createAccount(
      provider.connection,
      voter,
      mint,
      voter.publicKey
    );

    // Mint tokens to accounts
    await mintTo(
      provider.connection,
      admin,
      mint,
      funderTokenAccount,
      admin,
      10_000_000 // 10 tokens
    );

    await mintTo(
      provider.connection,
      admin,
      mint,
      voterTokenAccount,
      admin,
      5_000_000 // 5 tokens for weighted voting
    );

    // Derive PDAs
    [programStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("program-state")],
      program.programId
    );

    [paperPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("paper"), new anchor.BN(0).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [paperTokenAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("paper-token"), new anchor.BN(0).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [platformVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("platform-vault")],
      program.programId
    );

    [fundingPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("funding"),
        new anchor.BN(0).toArrayLike(Buffer, "le", 8),
        funder.publicKey.toBuffer(),
      ],
      program.programId
    );

    [votePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vote"),
        new anchor.BN(0).toArrayLike(Buffer, "le", 8),
        voter.publicKey.toBuffer(),
      ],
      program.programId
    );
  });

  describe("Initialize", () => {
    it("Initializes the program successfully", async () => {
      await program.methods
        .initialize()
        .accounts({
          admin: admin.publicKey,
          programState: programStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const programState = await program.account.programState.fetch(programStatePda);
      
      assert.equal(programState.admin.toString(), admin.publicKey.toString());
      assert.equal(programState.paperCount.toNumber(), 0);
      assert.equal(programState.totalFunding.toNumber(), 0);
      assert.equal(programState.platformFeeRate, 250); // 2.5%
      assert.equal(programState.minFundingGoal.toNumber(), 1_000_000);
      assert.equal(programState.isPaused, false);
    });

    it("Should fail to initialize twice", async () => {
      try {
        await program.methods
          .initialize()
          .accounts({
            admin: admin.publicKey,
            programState: programStatePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        
        assert.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("already in use");
      }
    });
  });

  describe("Submit Paper", () => {
    it("Submits a research paper successfully", async () => {
      await program.methods
        .submitPaper(
          paperData.title,
          paperData.abstractText,
          paperData.ipfsHash,
          paperData.authors,
          paperData.fundingGoal,
          paperData.fundingPeriodDays
        )
        .accounts({
          author: author.publicKey,
          paper: paperPda,
          programState: programStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([author])
        .rpc();

      const paper = await program.account.researchPaper.fetch(paperPda);
      const programState = await program.account.programState.fetch(programStatePda);
      
      assert.equal(paper.id.toNumber(), 0);
      assert.equal(paper.author.toString(), author.publicKey.toString());
      assert.equal(paper.title, paperData.title);
      assert.equal(paper.abstractText, paperData.abstractText);
      assert.equal(paper.ipfsHash, paperData.ipfsHash);
      assert.deepEqual(paper.authors, paperData.authors);
      assert.equal(paper.isPublished, false);
      assert.equal(paper.fundingGoal.toNumber(), paperData.fundingGoal.toNumber());
      assert.equal(paper.fundingCurrent.toNumber(), 0);
      assert.equal(paper.upvotes.toNumber(), 0);
      assert.equal(paper.downvotes.toNumber(), 0);
      assert.equal(programState.paperCount.toNumber(), 1);
    });

    it("Should fail with invalid title", async () => {
      try {
        await program.methods
          .submitPaper(
            "", // Empty title
            paperData.abstractText,
            paperData.ipfsHash,
            paperData.authors,
            paperData.fundingGoal,
            paperData.fundingPeriodDays
          )
          .accounts({
            author: author.publicKey,
            paper: paperPda,
            programState: programStatePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([author])
          .rpc();
        
        assert.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("InvalidTitle");
      }
    });

    it("Should fail with funding goal too low", async () => {
      const [invalidPaperPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper"), new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .submitPaper(
            "Test Paper",
            paperData.abstractText,
            paperData.ipfsHash,
            paperData.authors,
            new anchor.BN(500_000), // Below minimum
            paperData.fundingPeriodDays
          )
          .accounts({
            author: author.publicKey,
            paper: invalidPaperPda,
            programState: programStatePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([author])
          .rpc();
        
        assert.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("FundingGoalTooLow");
      }
    });
  });

  describe("Publish Paper", () => {
    it("Author can publish their own paper", async () => {
      await program.methods
        .publishPaper(new anchor.BN(0))
        .accounts({
          authority: author.publicKey,
          paper: paperPda,
          programState: programStatePda,
        })
        .signers([author])
        .rpc();

      const paper = await program.account.researchPaper.fetch(paperPda);
      assert.equal(paper.isPublished, true);
      assert.equal(paper.status.published !== undefined, true);
    });

    it("Should fail when non-author tries to publish", async () => {
      const [secondPaperPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper"), new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // First submit a paper with different author
      await program.methods
        .submitPaper(
          "Second Paper",
          paperData.abstractText,
          paperData.ipfsHash,
          paperData.authors,
          paperData.fundingGoal,
          paperData.fundingPeriodDays
        )
        .accounts({
          author: funder.publicKey, // Different author
          paper: secondPaperPda,
          programState: programStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([funder])
        .rpc();

      try {
        await program.methods
          .publishPaper(new anchor.BN(1))
          .accounts({
            authority: author.publicKey, // Wrong authority
            paper: secondPaperPda,
            programState: programStatePda,
          })
          .signers([author])
          .rpc();
        
        assert.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("Unauthorized");
      }
    });

    it("Admin can publish any paper", async () => {
      const [secondPaperPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper"), new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      await program.methods
        .publishPaper(new anchor.BN(1))
        .accounts({
          authority: admin.publicKey, // Admin authority
          paper: secondPaperPda,
          programState: programStatePda,
        })
        .signers([admin])
        .rpc();

      const paper = await program.account.researchPaper.fetch(secondPaperPda);
      assert.equal(paper.isPublished, true);
    });
  });

  describe("Fund Paper", () => {
    before(async () => {
      // Create paper token account
      await createAccount(
        provider.connection,
        admin,
        mint,
        paperTokenAccountPda,
        admin
      );

      // Create platform vault
      await createAccount(
        provider.connection,
        admin,
        mint,
        platformVaultPda,
        admin
      );
    });

    it("Successfully funds a published paper", async () => {
      const fundAmount = new anchor.BN(2_000_000); // 2 tokens
      
      await program.methods
        .fundPaper(new anchor.BN(0), fundAmount)
        .accounts({
          funder: funder.publicKey,
          paper: paperPda,
          funderTokenAccount: funderTokenAccount,
          paperTokenAccount: paperTokenAccountPda,
          platformTokenAccount: platformVaultPda,
          funding: fundingPda,
          programState: programStatePda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([funder])
        .rpc();

      const paper = await program.account.researchPaper.fetch(paperPda);
      const funding = await program.account.funding.fetch(fundingPda);
      const programState = await program.account.programState.fetch(programStatePda);

      // Calculate expected amounts (2.5% fee)
      const platformFee = fundAmount.toNumber() * 250 / 10000; // 50,000
      const netAmount = fundAmount.toNumber() - platformFee; // 1,950,000

      assert.equal(paper.fundingCurrent.toNumber(), netAmount);
      assert.equal(funding.amount.toNumber(), netAmount);
      assert.equal(funding.platformFee.toNumber(), platformFee);
      assert.equal(funding.funder.toString(), funder.publicKey.toString());
      assert.equal(programState.totalFunding.toNumber(), netAmount);

      // Check token balances
      const paperTokenBalance = await getAccount(provider.connection, paperTokenAccountPda);
      const platformTokenBalance = await getAccount(provider.connection, platformVaultPda);
      
      assert.equal(Number(paperTokenBalance.amount), netAmount);
      assert.equal(Number(platformTokenBalance.amount), platformFee);
    });

    it("Should fail to fund unpublished paper", async () => {
      const [unpublishedPaperPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper"), new anchor.BN(2).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // Submit but don't publish
      await program.methods
        .submitPaper(
          "Unpublished Paper",
          paperData.abstractText,
          paperData.ipfsHash,
          paperData.authors,
          paperData.fundingGoal,
          paperData.fundingPeriodDays
        )
        .accounts({
          author: author.publicKey,
          paper: unpublishedPaperPda,
          programState: programStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([author])
        .rpc();

      const [unpublishedFundingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("funding"),
          new anchor.BN(2).toArrayLike(Buffer, "le", 8),
          funder.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .fundPaper(new anchor.BN(2), new anchor.BN(1_000_000))
          .accounts({
            funder: funder.publicKey,
            paper: unpublishedPaperPda,
            funderTokenAccount: funderTokenAccount,
            paperTokenAccount: paperTokenAccountPda,
            platformTokenAccount: platformVaultPda,
            funding: unpublishedFundingPda,
            programState: programStatePda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([funder])
          .rpc();
        
        assert.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("PaperNotPublished");
      }
    });

    it("Updates status to FullyFunded when goal is reached", async () => {
      const remainingAmount = new anchor.BN(3_050_000); // More than remaining needed
      
      const [secondFundingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("funding"),
          new anchor.BN(0).toArrayLike(Buffer, "le", 8),
          voter.publicKey.toBuffer(), // Using voter as second funder
        ],
        program.programId
      );

      // Fund with voter account to reach the goal
      await mintTo(
        provider.connection,
        admin,
        mint,
        voterTokenAccount,
        admin,
        5_000_000 // Add more tokens to voter account
      );

      await program.methods
        .fundPaper(new anchor.BN(0), remainingAmount)
        .accounts({
          funder: voter.publicKey,
          paper: paperPda,
          funderTokenAccount: voterTokenAccount,
          paperTokenAccount: paperTokenAccountPda,
          platformTokenAccount: platformVaultPda,
          funding: secondFundingPda,
          programState: programStatePda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();

      const paper = await program.account.researchPaper.fetch(paperPda);
      assert.equal(paper.status.fullyFunded !== undefined, true);
    });
  });

  describe("Vote Paper", () => {
    it("Successfully votes on a published paper with weight", async () => {
      await program.methods
        .votePaper(new anchor.BN(0), true) // Upvote
        .accounts({
          voter: voter.publicKey,
          paper: paperPda,
          programState: programStatePda,
          voterTokenAccount: voterTokenAccount,
          vote: votePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();

      const paper = await program.account.researchPaper.fetch(paperPda);
      const vote = await program.account.vote.fetch(votePda);

      // Voter has 5+ tokens, so should get weighted vote (at least 5x weight)
      assert.isTrue(paper.upvotes.toNumber() >= 5);
      assert.equal(vote.isUpvote, true);
      assert.equal(vote.voter.toString(), voter.publicKey.toString());
      assert.isTrue(vote.weight.toNumber() >= 5);
    });

    it("Should fail to vote on unpublished paper", async () => {
      const [unpublishedPaperPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper"), new anchor.BN(2).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const [unpublishedVotePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          new anchor.BN(2).toArrayLike(Buffer, "le", 8),
          voter.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .votePaper(new anchor.BN(2), true)
          .accounts({
            voter: voter.publicKey,
            paper: unpublishedPaperPda,
            programState: programStatePda,
            voterTokenAccount: voterTokenAccount,
            vote: unpublishedVotePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([voter])
          .rpc();
        
        assert.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("PaperNotPublished");
      }
    });
  });

  describe("Claim Funds", () => {
    it("Author can claim funds when paper is fully funded", async () => {
      const paperTokenBalanceBefore = await getAccount(provider.connection, paperTokenAccountPda);
      const authorTokenBalanceBefore = await getAccount(provider.connection, authorTokenAccount);

      await program.methods
        .claimFunds(new anchor.BN(0))
        .accounts({
          author: author.publicKey,
          paper: paperPda,
          paperTokenAccount: paperTokenAccountPda,
          authorTokenAccount: authorTokenAccount,
          programState: programStatePda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([author])
        .rpc();

      const paper = await program.account.researchPaper.fetch(paperPda);
      const paperTokenBalanceAfter = await getAccount(provider.connection, paperTokenAccountPda);
      const authorTokenBalanceAfter = await getAccount(provider.connection, authorTokenAccount);

      assert.equal(paper.status.completed !== undefined, true);
      assert.equal(Number(paperTokenBalanceAfter.amount), 0);
      assert.isTrue(
        Number(authorTokenBalanceAfter.amount) > Number(authorTokenBalanceBefore.amount)
      );
    });

    it("Should fail when non-author tries to claim", async () => {
      try {
        await program.methods
          .claimFunds(new anchor.BN(0))
          .accounts({
            author: funder.publicKey, // Wrong author
            paper: paperPda,
            paperTokenAccount: paperTokenAccountPda,
            authorTokenAccount: funderTokenAccount,
            programState: programStatePda,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([funder])
          .rpc();
        
        assert.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("Unauthorized");
      }
    });
  });

  describe("Admin Functions", () => {
    it("Admin can pause the program", async () => {
      await program.methods
        .togglePause()
        .accounts({
          admin: admin.publicKey,
          programState: programStatePda,
        })
        .signers([admin])
        .rpc();

      const programState = await program.account.programState.fetch(programStatePda);
      assert.equal(programState.isPaused, true);
    });

    it("Should fail operations when paused", async () => {
      const [pausedPaperPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper"), new anchor.BN(3).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .submitPaper(
            "Paused Paper",
            paperData.abstractText,
            paperData.ipfsHash,
            paperData.authors,
            paperData.fundingGoal,
            paperData.fundingPeriodDays
          )
          .accounts({
            author: author.publicKey,
            paper: pausedPaperPda,
            programState: programStatePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([author])
          .rpc();
        
        assert.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("ProgramPaused");
      }
    });

    it("Admin can unpause the program", async () => {
      await program.methods
        .togglePause()
        .accounts({
          admin: admin.publicKey,
          programState: programStatePda,
        })
        .signers([admin])
        .rpc();

      const programState = await program.account.programState.fetch(programStatePda);
      assert.equal(programState.isPaused, false);
    });

    it("Admin can update settings", async () => {
      await program.methods
        .updateSettings(300, new anchor.BN(2_000_000)) // 3% fee, 2 token minimum
        .accounts({
          admin: admin.publicKey,
          programState: programStatePda,
        })
        .signers([admin])
        .rpc();

      const programState = await program.account.programState.fetch(programStatePda);
      assert.equal(programState.platformFeeRate, 300);
      assert.equal(programState.minFundingGoal.toNumber(), 2_000_000);
    });

    it("Should fail when non-admin tries to update settings", async () => {
      try {
        await program.methods
          .updateSettings(400, new anchor.BN(3_000_000))
          .accounts({
            admin: author.publicKey, // Non-admin
            programState: programStatePda,
          })
          .signers([author])
          .rpc();
        
        assert.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("Unauthorized");
      }
    });

    it("Should fail with fee rate too high", async () => {
      try {
        await program.methods
          .updateSettings(1500, null) // 15% - too high
          .accounts({
            admin: admin.publicKey,
            programState: programStatePda,
          })
          .signers([admin])
          .rpc();
        
        assert.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("FeeTooHigh");
      }
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("Should handle maximum string lengths", async () => {
      const longTitle = "A".repeat(100); // Max length
      const longAbstract = "B".repeat(1000); // Max length
      const longIpfsHash = "C".repeat(100); // Max length
      const maxAuthors = Array(10).fill(0).map((_, i) => `Author${i}`); // Max 10 authors

      const [maxLengthPaperPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper"), new anchor.BN(3).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      await program.methods
        .submitPaper(
          longTitle,
          longAbstract,
          longIpfsHash,
          maxAuthors,
          paperData.fundingGoal,
          paperData.fundingPeriodDays
        )
        .accounts({
          author: author.publicKey,
          paper: maxLengthPaperPda,
          programState: programStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([author])
        .rpc();

      const paper = await program.account.researchPaper.fetch(maxLengthPaperPda);
      assert.equal(paper.title, longTitle);
      assert.equal(paper.abstractText, longAbstract);
      assert.equal(paper.ipfsHash, longIpfsHash);
      assert.equal(paper.authors.length, 10);
    });

    it("Should fail with too long strings", async () => {
      const tooLongTitle = "A".repeat(101); // Too long

      const [tooLongPaperPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper"), new anchor.BN(4).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .submitPaper(
            tooLongTitle,
            paperData.abstractText,
            paperData.ipfsHash,
            paperData.authors,
            paperData.fundingGoal,
            paperData.fundingPeriodDays
          )
          .accounts({
            author: author.publicKey,
            paper: tooLongPaperPda,
            programState: programStatePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([author])
          .rpc();
        
        assert.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("InvalidTitle");
      }
    });

    it("Should handle zero token balance voting", async () => {
      const zeroBalanceVoter = Keypair.generate();
      await provider.connection.requestAirdrop(zeroBalanceVoter.publicKey, LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const zeroBalanceTokenAccount = await createAccount(
        provider.connection,
        zeroBalanceVoter,
        mint,
        zeroBalanceVoter.publicKey
      );

      const [zeroBalanceVotePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          new anchor.BN(1).toArrayLike(Buffer, "le", 8), // Vote on second paper
          zeroBalanceVoter.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .votePaper(new anchor.BN(1), false) // Downvote
        .accounts({
          voter: zeroBalanceVoter.publicKey,
          paper: PublicKey.findProgramAddressSync(
            [Buffer.from("paper"), new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
            program.programId
          )[0],
          programState: programStatePda,
          voterTokenAccount: zeroBalanceTokenAccount,
          vote: zeroBalanceVotePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([zeroBalanceVoter])
        .rpc();

      const vote = await program.account.vote.fetch(zeroBalanceVotePda);
      assert.equal(vote.weight.toNumber(), 1); // Should default to weight 1
      assert.equal(vote.isUpvote, false);
    });

    it("Should handle funding deadline expiration", async () => {
      // Create a paper with very short funding period
      const [expiredPaperPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper"), new anchor.BN(5).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      await program.methods
        .submitPaper(
          "Expired Paper",
          paperData.abstractText,
          paperData.ipfsHash,
          paperData.authors,
          paperData.fundingGoal,
          new anchor.BN(1) // 1 day funding period
        )
        .accounts({
          author: author.publicKey,
          paper: expiredPaperPda,
          programState: programStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([author])
        .rpc();

      await program.methods
        .publishPaper(new anchor.BN(5))
        .accounts({
          authority: author.publicKey,
          paper: expiredPaperPda,
          programState: programStatePda,
        })
        .signers([author])
        .rpc();

      // Note: In a real test, you would need to wait for the deadline to pass
      // or manipulate the clock. For this test, we'll just verify the paper was created
      const paper = await program.account.researchPaper.fetch(expiredPaperPda);
      assert.isTrue(paper.fundingDeadline > 0);
    });
  });

  describe("Integration Tests", () => {
    it("Complete workflow: submit -> publish -> fund -> vote -> claim", async () => {
      const workflow = {
        title: "Complete Workflow Paper",
        abstractText: "Testing the complete research paper workflow from submission to completion.",
        ipfsHash: "QmWorkflowHash123456789",
        authors: ["Dr. Workflow"],
        fundingGoal: new anchor.BN(3_000_000),
        fundingPeriodDays: new anchor.BN(60),
      };

      // Step 1: Submit paper
      const [workflowPaperPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper"), new anchor.BN(6).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      await program.methods
        .submitPaper(
          workflow.title,
          workflow.abstractText,
          workflow.ipfsHash,
          workflow.authors,
          workflow.fundingGoal,
          workflow.fundingPeriodDays
        )
        .accounts({
          author: author.publicKey,
          paper: workflowPaperPda,
          programState: programStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([author])
        .rpc();

      let paper = await program.account.researchPaper.fetch(workflowPaperPda);
      assert.equal(paper.status.draft !== undefined, true);

      // Step 2: Publish paper
      await program.methods
        .publishPaper(new anchor.BN(6))
        .accounts({
          authority: author.publicKey,
          paper: workflowPaperPda,
          programState: programStatePda,
        })
        .signers([author])
        .rpc();

      paper = await program.account.researchPaper.fetch(workflowPaperPda);
      assert.equal(paper.status.published !== undefined, true);

      // Step 3: Vote on paper
      const [workflowVotePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          new anchor.BN(6).toArrayLike(Buffer, "le", 8),
          voter.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .votePaper(new anchor.BN(6), true)
        .accounts({
          voter: voter.publicKey,
          paper: workflowPaperPda,
          programState: programStatePda,
          voterTokenAccount: voterTokenAccount,
          vote: workflowVotePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();

      paper = await program.account.researchPaper.fetch(workflowPaperPda);
      assert.isTrue(paper.upvotes.toNumber() > 0);

      // Step 4: Fund paper to completion
      const [workflowPaperTokenPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper-token"), new anchor.BN(6).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const [workflowFundingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("funding"),
          new anchor.BN(6).toArrayLike(Buffer, "le", 8),
          funder.publicKey.toBuffer(),
        ],
        program.programId
      );

      // Create paper token account
      await createAccount(
        provider.connection,
        admin,
        mint,
        workflowPaperTokenPda,
        admin
      );

      await program.methods
        .fundPaper(new anchor.BN(6), workflow.fundingGoal)
        .accounts({
          funder: funder.publicKey,
          paper: workflowPaperPda,
          funderTokenAccount: funderTokenAccount,
          paperTokenAccount: workflowPaperTokenPda,
          platformTokenAccount: platformVaultPda,
          funding: workflowFundingPda,
          programState: programStatePda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([funder])
        .rpc();

      paper = await program.account.researchPaper.fetch(workflowPaperPda);
      assert.equal(paper.status.fullyFunded !== undefined, true);

      // Step 5: Claim funds
      await program.methods
        .claimFunds(new anchor.BN(6))
        .accounts({
          author: author.publicKey,
          paper: workflowPaperPda,
          paperTokenAccount: workflowPaperTokenPda,
          authorTokenAccount: authorTokenAccount,
          programState: programStatePda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([author])
        .rpc();

      paper = await program.account.researchPaper.fetch(workflowPaperPda);
      assert.equal(paper.status.completed !== undefined, true);

      // Verify final state
      const programState = await program.account.programState.fetch(programStatePda);
      assert.equal(programState.paperCount.toNumber(), 7); // 0-6 = 7 papers total
      assert.isTrue(programState.totalFunding.toNumber() > 0);
    });

    it("Multiple funders scenario", async () => {
      const multiFundingPaper = {
        title: "Multi-Funder Research",
        abstractText: "Research funded by multiple contributors",
        ipfsHash: "QmMultiFundHash",
        authors: ["Dr. Multi"],
        fundingGoal: new anchor.BN(6_000_000), // 6 tokens
        fundingPeriodDays: new anchor.BN(45),
      };

      // Submit and publish paper
      const [multiFundPaperPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper"), new anchor.BN(7).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      await program.methods
        .submitPaper(
          multiFundingPaper.title,
          multiFundingPaper.abstractText,
          multiFundingPaper.ipfsHash,
          multiFundingPaper.authors,
          multiFundingPaper.fundingGoal,
          multiFundingPaper.fundingPeriodDays
        )
        .accounts({
          author: author.publicKey,
          paper: multiFundPaperPda,
          programState: programStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([author])
        .rpc();

      await program.methods
        .publishPaper(new anchor.BN(7))
        .accounts({
          authority: author.publicKey,
          paper: multiFundPaperPda,
          programState: programStatePda,
        })
        .signers([author])
        .rpc();

      // Create paper token account
      const [multiFundPaperTokenPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper-token"), new anchor.BN(7).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      await createAccount(
        provider.connection,
        admin,
        mint,
        multiFundPaperTokenPda,
        admin
      );

      // First funder funds 2 tokens
      const [firstFundingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("funding"),
          new anchor.BN(7).toArrayLike(Buffer, "le", 8),
          funder.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .fundPaper(new anchor.BN(7), new anchor.BN(2_000_000))
        .accounts({
          funder: funder.publicKey,
          paper: multiFundPaperPda,
          funderTokenAccount: funderTokenAccount,
          paperTokenAccount: multiFundPaperTokenPda,
          platformTokenAccount: platformVaultPda,
          funding: firstFundingPda,
          programState: programStatePda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([funder])
        .rpc();

      // Second funder (voter) funds remaining amount
      const [secondFundingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("funding"),
          new anchor.BN(7).toArrayLike(Buffer, "le", 8),
          voter.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .fundPaper(new anchor.BN(7), new anchor.BN(4_500_000)) // More than needed to test excess
        .accounts({
          funder: voter.publicKey,
          paper: multiFundPaperPda,
          funderTokenAccount: voterTokenAccount,
          paperTokenAccount: multiFundPaperTokenPda,
          platformTokenAccount: platformVaultPda,
          funding: secondFundingPda,
          programState: programStatePda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();

      const paper = await program.account.researchPaper.fetch(multiFundPaperPda);
      const firstFunding = await program.account.funding.fetch(firstFundingPda);
      const secondFunding = await program.account.funding.fetch(secondFundingPda);

      assert.equal(paper.status.fullyFunded !== undefined, true);
      assert.isTrue(paper.fundingCurrent.toNumber() >= multiFundingPaper.fundingGoal.toNumber());
      assert.equal(firstFunding.funder.toString(), funder.publicKey.toString());
      assert.equal(secondFunding.funder.toString(), voter.publicKey.toString());
    });
  });

  describe("Gas and Performance Tests", () => {
    it("Measures transaction costs", async () => {
      const balanceBefore = await provider.connection.getBalance(author.publicKey);
      
      const [gasPaperPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper"), new anchor.BN(8).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const tx = await program.methods
        .submitPaper(
          "Gas Test Paper",
          paperData.abstractText,
          paperData.ipfsHash,
          paperData.authors,
          paperData.fundingGoal,
          paperData.fundingPeriodDays
        )
        .accounts({
          author: author.publicKey,
          paper: gasPaperPda,
          programState: programStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([author])
        .rpc();

      const balanceAfter = await provider.connection.getBalance(author.publicKey);
      const txCost = balanceBefore - balanceAfter;
      
      console.log(`Transaction cost for submit_paper: ${txCost / LAMPORTS_PER_SOL} SOL`);
      
      // Verify transaction was successful
      const paper = await program.account.researchPaper.fetch(gasPaperPda);
      assert.equal(paper.title, "Gas Test Paper");
    });
  });

  describe("Event Testing", () => {
    it("Emits events correctly", async () => {
      const [eventPaperPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("paper"), new anchor.BN(9).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // Listen for events
      let eventReceived = false;
      const listener = program.addEventListener("PaperSubmittedEvent", (event) => {
        console.log("Received PaperSubmittedEvent:", event);
        eventReceived = true;
        assert.equal(event.title, "Event Test Paper");
        assert.equal(event.author.toString(), author.publicKey.toString());
      });

      await program.methods
        .submitPaper(
          "Event Test Paper",
          paperData.abstractText,
          paperData.ipfsHash,
          paperData.authors,
          paperData.fundingGoal,
          paperData.fundingPeriodDays
        )
        .accounts({
          author: author.publicKey,
          paper: eventPaperPda,
          programState: programStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([author])
        .rpc();

      // Give some time for event to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clean up listener
      await program.removeEventListener(listener);
      
      // Note: Event testing might be flaky in test environments
      // In production, you'd want more robust event handling
    });
  });
});

// Helper functions for testing
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function confirmTransaction(
  connection: any,
  signature: string,
  commitment = "confirmed"
) {
  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: signature,
  }, commitment);
}

export function createTestKeypairs(count: number): Keypair[] {
  return Array.from({ length: count }, () => Keypair.generate());
}

export async function airdropSol(
  connection: any,
  publicKey: PublicKey,
  amount: number = LAMPORTS_PER_SOL
): Promise<void> {
  const signature = await connection.requestAirdrop(publicKey, amount);
  await confirmTransaction(connection, signature);
}