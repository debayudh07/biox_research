// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BioxResearch } from "../target/types/biox_research";

module.exports = async function (provider: anchor.AnchorProvider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);

  // Get the deployed program
  const program = anchor.workspace.Contracts as Program<BioxResearch>;
  console.log("Program ID:", program.programId.toString());

  try {
    // Initialize the program
    const tx = await program.methods
      .initialize()
      .accounts({
        admin: provider.wallet.publicKey,
      })
      .rpc();
    
    console.log("Your BioX Research Platform has been initialized!");
    console.log("Transaction signature:", tx);
  } catch (error) {
    console.error("Error initializing program:", error);
  }
};
