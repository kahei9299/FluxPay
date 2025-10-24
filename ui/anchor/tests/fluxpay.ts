import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Fluxpay } from "../target/types/fluxpay";
import { expect } from "chai";

describe("FluxPay Comprehensive Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Fluxpay as Program<Fluxpay>;

  // ============================================================================
  // Helper Functions
  // ============================================================================

  function getAllowancePda(giver: PublicKey, recipient: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("allowance"), giver.toBuffer(), recipient.toBuffer()],
      program.programId
    );
  }

  async function fundPda(
    from: anchor.web3.Keypair,
    pda: PublicKey,
    amount: number
  ): Promise<void> {
    const tx = await provider.connection.sendTransaction(
      new anchor.web3.Transaction().add(
        SystemProgram.transfer({
          fromPubkey: from.publicKey,
          toPubkey: pda,
          lamports: amount,
        })
      ),
      [from]
    );
    await provider.connection.confirmTransaction(tx);
  }

  async function getBalance(address: PublicKey): Promise<number> {
    return await provider.connection.getBalance(address);
  }

  // ============================================================================
  // Happy Path Tests
  // ============================================================================

  describe("Happy Path", () => {
    it("Full lifecycle: initialize → fund → withdraw → close", async () => {
      const giver = (provider.wallet as anchor.Wallet).payer;
      const recipient = anchor.web3.Keypair.generate();
      
      const total = new anchor.BN(1_000_000_000); // 1 SOL
      const expiresAt = new anchor.BN(Date.now() / 1000 + 3600); // 1 hour from now

      const [allowancePda] = getAllowancePda(giver.publicKey, recipient.publicKey);

      // 1. Initialize
      await program.methods
        .initialize(total, expiresAt)
        .accounts({
          giver: giver.publicKey,
          recipient: recipient.publicKey,
          allowance: allowancePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      let allowance = await program.account.allowance.fetch(allowancePda);
      expect(allowance.total.toString()).to.equal(total.toString());
      expect(allowance.withdrawn.toString()).to.equal("0");

      // 2. Fund PDA
      await fundPda(giver, allowancePda, total.toNumber());
      const pdaBalance = await getBalance(allowancePda);
      expect(pdaBalance).to.be.greaterThan(total.toNumber());

      // 3. Withdraw
      const withdrawAmount = new anchor.BN(500_000_000); // 0.5 SOL
      const recipientBalanceBefore = await getBalance(recipient.publicKey);

      await program.methods
        .withdraw(withdrawAmount)
        .accounts({
          allowance: allowancePda,
          recipient: recipient.publicKey,
        })
        .signers([recipient])
        .rpc();

      allowance = await program.account.allowance.fetch(allowancePda);
      expect(allowance.withdrawn.toString()).to.equal(withdrawAmount.toString());

      const recipientBalanceAfter = await getBalance(recipient.publicKey);
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(withdrawAmount.toNumber());

      // 4. Close
      const giverBalanceBefore = await getBalance(giver.publicKey);

      await program.methods
        .close()
        .accounts({
          allowance: allowancePda,
          giver: giver.publicKey,
        })
        .rpc();

      const giverBalanceAfter = await getBalance(giver.publicKey);
      const remaining = total.toNumber() - withdrawAmount.toNumber();
      expect(giverBalanceAfter - giverBalanceBefore).to.be.greaterThan(remaining - 10000); // Account for fees
    });

    it("Multiple partial withdrawals", async () => {
      const giver = (provider.wallet as anchor.Wallet).payer;
      const recipient = anchor.web3.Keypair.generate();
      
      const total = new anchor.BN(1_000_000_000); // 1 SOL
      const expiresAt = new anchor.BN(Date.now() / 1000 + 3600);

      const [allowancePda] = getAllowancePda(giver.publicKey, recipient.publicKey);

      // Initialize and fund
      await program.methods
        .initialize(total, expiresAt)
        .accounts({
          giver: giver.publicKey,
          recipient: recipient.publicKey,
          allowance: allowancePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fundPda(giver, allowancePda, total.toNumber());

      // Multiple withdrawals
      const amounts = [200_000_000, 300_000_000, 250_000_000];
      let totalWithdrawn = 0;

      for (const amount of amounts) {
        await program.methods
          .withdraw(new anchor.BN(amount))
          .accounts({
            allowance: allowancePda,
            recipient: recipient.publicKey,
          })
          .signers([recipient])
          .rpc();

        totalWithdrawn += amount;

        const allowance = await program.account.allowance.fetch(allowancePda);
        expect(allowance.withdrawn.toNumber()).to.equal(totalWithdrawn);
      }
    });

    it("Withdraw exact total amount", async () => {
      const giver = (provider.wallet as anchor.Wallet).payer;
      const recipient = anchor.web3.Keypair.generate();
      
      const total = new anchor.BN(500_000_000); // 0.5 SOL
      const expiresAt = new anchor.BN(Date.now() / 1000 + 3600);

      const [allowancePda] = getAllowancePda(giver.publicKey, recipient.publicKey);

      await program.methods
        .initialize(total, expiresAt)
        .accounts({
          giver: giver.publicKey,
          recipient: recipient.publicKey,
          allowance: allowancePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fundPda(giver, allowancePda, total.toNumber());

      // Withdraw exactly the total
      await program.methods
        .withdraw(total)
        .accounts({
          allowance: allowancePda,
          recipient: recipient.publicKey,
        })
        .signers([recipient])
        .rpc();

      const allowance = await program.account.allowance.fetch(allowancePda);
      expect(allowance.withdrawn.toString()).to.equal(total.toString());
    });
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe("Validation Tests", () => {
    it("Rejects expired withdrawal", async () => {
      const giver = (provider.wallet as anchor.Wallet).payer;
      const recipient = anchor.web3.Keypair.generate();
      
      const total = new anchor.BN(1_000_000_000);
      const expiresAt = new anchor.BN(Date.now() / 1000 - 3600); // 1 hour ago (expired)

      const [allowancePda] = getAllowancePda(giver.publicKey, recipient.publicKey);

      await program.methods
        .initialize(total, expiresAt)
        .accounts({
          giver: giver.publicKey,
          recipient: recipient.publicKey,
          allowance: allowancePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fundPda(giver, allowancePda, total.toNumber());

      // Try to withdraw from expired allowance
      try {
        await program.methods
          .withdraw(new anchor.BN(100_000_000))
          .accounts({
            allowance: allowancePda,
            recipient: recipient.publicKey,
          })
          .signers([recipient])
          .rpc();
        
        expect.fail("Should have thrown AllowanceExpired error");
      } catch (err) {
        expect(err.toString()).to.include("AllowanceExpired");
      }
    });

    it("Rejects over-cap withdrawal", async () => {
      const giver = (provider.wallet as anchor.Wallet).payer;
      const recipient = anchor.web3.Keypair.generate();
      
      const total = new anchor.BN(500_000_000); // 0.5 SOL
      const expiresAt = new anchor.BN(Date.now() / 1000 + 3600);

      const [allowancePda] = getAllowancePda(giver.publicKey, recipient.publicKey);

      await program.methods
        .initialize(total, expiresAt)
        .accounts({
          giver: giver.publicKey,
          recipient: recipient.publicKey,
          allowance: allowancePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fundPda(giver, allowancePda, 1_000_000_000); // Fund more than cap

      // Try to withdraw more than cap
      try {
        await program.methods
          .withdraw(new anchor.BN(600_000_000)) // More than 0.5 SOL cap
          .accounts({
            allowance: allowancePda,
            recipient: recipient.publicKey,
          })
          .signers([recipient])
          .rpc();
        
        expect.fail("Should have thrown InsufficientAllowance error");
      } catch (err) {
        expect(err.toString()).to.include("InsufficientAllowance");
      }
    });

    it("Rejects non-recipient withdrawal", async () => {
      const giver = (provider.wallet as anchor.Wallet).payer;
      const recipient = anchor.web3.Keypair.generate();
      const attacker = anchor.web3.Keypair.generate();
      
      const total = new anchor.BN(1_000_000_000);
      const expiresAt = new anchor.BN(Date.now() / 1000 + 3600);

      const [allowancePda] = getAllowancePda(giver.publicKey, recipient.publicKey);

      await program.methods
        .initialize(total, expiresAt)
        .accounts({
          giver: giver.publicKey,
          recipient: recipient.publicKey,
          allowance: allowancePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fundPda(giver, allowancePda, total.toNumber());

      // Try to withdraw with wrong signer
      try {
        await program.methods
          .withdraw(new anchor.BN(100_000_000))
          .accounts({
            allowance: allowancePda,
            recipient: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();
        
        expect.fail("Should have thrown ConstraintHasOne error");
      } catch (err) {
        expect(err.toString()).to.include("ConstraintHasOne");
      }
    });

    it("Rejects non-giver close", async () => {
      const giver = (provider.wallet as anchor.Wallet).payer;
      const recipient = anchor.web3.Keypair.generate();
      const attacker = anchor.web3.Keypair.generate();
      
      const total = new anchor.BN(1_000_000_000);
      const expiresAt = new anchor.BN(Date.now() / 1000 + 3600);

      const [allowancePda] = getAllowancePda(giver.publicKey, recipient.publicKey);

      await program.methods
        .initialize(total, expiresAt)
        .accounts({
          giver: giver.publicKey,
          recipient: recipient.publicKey,
          allowance: allowancePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fundPda(giver, allowancePda, total.toNumber());

      // Try to close with wrong signer
      try {
        await program.methods
          .close()
          .accounts({
            allowance: allowancePda,
            giver: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();
        
        expect.fail("Should have thrown ConstraintHasOne error");
      } catch (err) {
        expect(err.toString()).to.include("ConstraintHasOne");
      }
    });

    it("Rejects double initialization", async () => {
      const giver = (provider.wallet as anchor.Wallet).payer;
      const recipient = anchor.web3.Keypair.generate();
      
      const total = new anchor.BN(1_000_000_000);
      const expiresAt = new anchor.BN(Date.now() / 1000 + 3600);

      const [allowancePda] = getAllowancePda(giver.publicKey, recipient.publicKey);

      // First initialization
      await program.methods
        .initialize(total, expiresAt)
        .accounts({
          giver: giver.publicKey,
          recipient: recipient.publicKey,
          allowance: allowancePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Try to initialize again
      try {
        await program.methods
          .initialize(total, expiresAt)
          .accounts({
            giver: giver.publicKey,
            recipient: recipient.publicKey,
            allowance: allowancePda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (err) {
        // Anchor will throw an error because account already exists
        expect(err).to.exist;
      }
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge Cases", () => {
    it("Zero amount withdrawal", async () => {
      const giver = (provider.wallet as anchor.Wallet).payer;
      const recipient = anchor.web3.Keypair.generate();
      
      const total = new anchor.BN(1_000_000_000);
      const expiresAt = new anchor.BN(Date.now() / 1000 + 3600);

      const [allowancePda] = getAllowancePda(giver.publicKey, recipient.publicKey);

      await program.methods
        .initialize(total, expiresAt)
        .accounts({
          giver: giver.publicKey,
          recipient: recipient.publicKey,
          allowance: allowancePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fundPda(giver, allowancePda, total.toNumber());

      // Withdraw 0 lamports (should succeed, just does nothing)
      await program.methods
        .withdraw(new anchor.BN(0))
        .accounts({
          allowance: allowancePda,
          recipient: recipient.publicKey,
        })
        .signers([recipient])
        .rpc();

      const allowance = await program.account.allowance.fetch(allowancePda);
      expect(allowance.withdrawn.toNumber()).to.equal(0);
    });

    it("Withdraw from unfunded PDA fails", async () => {
      const giver = (provider.wallet as anchor.Wallet).payer;
      const recipient = anchor.web3.Keypair.generate();
      
      const total = new anchor.BN(1_000_000_000);
      const expiresAt = new anchor.BN(Date.now() / 1000 + 3600);

      const [allowancePda] = getAllowancePda(giver.publicKey, recipient.publicKey);

      await program.methods
        .initialize(total, expiresAt)
        .accounts({
          giver: giver.publicKey,
          recipient: recipient.publicKey,
          allowance: allowancePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // DON'T fund the PDA
      // Try to withdraw (should fail - insufficient balance)
      try {
        await program.methods
          .withdraw(new anchor.BN(100_000_000))
          .accounts({
            allowance: allowancePda,
            recipient: recipient.publicKey,
          })
          .signers([recipient])
          .rpc();
        
        expect.fail("Should have failed due to insufficient balance");
      } catch (err) {
        // Will fail with arithmetic error or insufficient balance
        expect(err).to.exist;
      }
    });

    it("Close returns correct remaining balance", async () => {
      const giver = (provider.wallet as anchor.Wallet).payer;
      const recipient = anchor.web3.Keypair.generate();
      
      const total = new anchor.BN(1_000_000_000); // 1 SOL
      const expiresAt = new anchor.BN(Date.now() / 1000 + 3600);

      const [allowancePda] = getAllowancePda(giver.publicKey, recipient.publicKey);

      await program.methods
        .initialize(total, expiresAt)
        .accounts({
          giver: giver.publicKey,
          recipient: recipient.publicKey,
          allowance: allowancePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fundPda(giver, allowancePda, total.toNumber());

      // Withdraw some amount
      const withdrawAmount = new anchor.BN(300_000_000); // 0.3 SOL
      await program.methods
        .withdraw(withdrawAmount)
        .accounts({
          allowance: allowancePda,
          recipient: recipient.publicKey,
        })
        .signers([recipient])
        .rpc();

      // Close and verify giver gets back the remaining
      const giverBalanceBefore = await getBalance(giver.publicKey);
      
      await program.methods
        .close()
        .accounts({
          allowance: allowancePda,
          giver: giver.publicKey,
        })
        .rpc();

      const giverBalanceAfter = await getBalance(giver.publicKey);
      const expectedReturn = total.toNumber() - withdrawAmount.toNumber();
      
      // Should get back ~0.7 SOL (minus rent which returns to giver anyway)
      expect(giverBalanceAfter - giverBalanceBefore).to.be.greaterThan(expectedReturn - 10000);
    });

    it("Partial withdraw then close", async () => {
      const giver = (provider.wallet as anchor.Wallet).payer;
      const recipient = anchor.web3.Keypair.generate();
      
      const total = new anchor.BN(800_000_000); // 0.8 SOL
      const expiresAt = new anchor.BN(Date.now() / 1000 + 3600);

      const [allowancePda] = getAllowancePda(giver.publicKey, recipient.publicKey);

      await program.methods
        .initialize(total, expiresAt)
        .accounts({
          giver: giver.publicKey,
          recipient: recipient.publicKey,
          allowance: allowancePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fundPda(giver, allowancePda, total.toNumber());

      // Withdraw 0.5 SOL
      await program.methods
        .withdraw(new anchor.BN(500_000_000))
        .accounts({
          allowance: allowancePda,
          recipient: recipient.publicKey,
        })
        .signers([recipient])
        .rpc();

      // Giver closes and gets remaining 0.3 SOL back
      const giverBalanceBefore = await getBalance(giver.publicKey);
      
      await program.methods
        .close()
        .accounts({
          allowance: allowancePda,
          giver: giver.publicKey,
        })
        .rpc();

      const giverBalanceAfter = await getBalance(giver.publicKey);
      expect(giverBalanceAfter - giverBalanceBefore).to.be.greaterThan(290_000_000); // ~0.3 SOL minus fees
    });
  });
});
