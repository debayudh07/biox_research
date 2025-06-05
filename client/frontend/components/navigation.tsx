"use client";

import Link from "next/link";
import { Microscope, Coins, UserPlus } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { WalletButton } from "@/components/wallet-button";
import { useWallet } from "@solana/wallet-adapter-react";
import { useUser } from "@/components/user-context";
import { useState, useEffect } from "react";
import { getUserTokenBalance } from "@/lib/solana";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function Navigation() {
  const { connected, publicKey, signMessage } = useWallet();
  const { isSignedUp, signUp, checkUserExists } = useUser();
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    institution: "",
    field: ""
  });

  // Check if user exists when wallet connects
  useEffect(() => {
    const verifyWallet = async () => {
      if (connected && publicKey && !isSignedUp) {
        setIsVerifying(true);
        try {
          const userExists = await checkUserExists(publicKey.toString());
          if (!userExists) {
            // Small delay to prevent dialog from showing immediately
            setTimeout(() => {
              setShowSignupDialog(true);
            }, 500);
          }
        } catch (error) {
          console.error("Error checking user existence:", error);
          toast.error("Failed to verify wallet");
        } finally {
          setIsVerifying(false);
        }
      }
    };

    verifyWallet();
  }, [connected, publicKey, isSignedUp, checkUserExists]);

  // Fetch token balance when wallet is connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (connected && publicKey && isSignedUp) {
        setIsLoadingBalance(true);
        try {
          const balanceResult = await getUserTokenBalance({ publicKey });
          if (balanceResult.success) {
            setTokenBalance(balanceResult.balance);
          } else {
            console.warn("Failed to fetch token balance:", balanceResult.error);
            setTokenBalance(0);
          }
        } catch (error) {
          console.error("Error fetching token balance:", error);
          setTokenBalance(0);
        } finally {
          setIsLoadingBalance(false);
        }
      } else {
        setTokenBalance(0);
      }
    };

    fetchBalance();
    
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [connected, publicKey, isSignedUp]);

  const handleSignup = async () => {
    if (!publicKey || !signMessage) {
      toast.error("Wallet not properly connected");
      return;
    }

    if (!signupForm.name || !signupForm.email || !signupForm.institution) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSigningUp(true);
    try {
      // Create verification message
      const message = `Welcome to BioResearch Hub!

Please sign this message to verify your wallet ownership and create your account.

Wallet: ${publicKey.toString()}
Name: ${signupForm.name}
Email: ${signupForm.email}
Institution: ${signupForm.institution}
Timestamp: ${Date.now()}

This signature proves you own this wallet and authorizes account creation.`;

      const encodedMessage = new TextEncoder().encode(message);
      
      // Request signature from wallet
      const signature = await signMessage(encodedMessage);
      
      // Sign up user with verified wallet
      const success = await signUp({
        walletAddress: publicKey.toString(),
        signature: Array.from(signature),
        message: message,
        ...signupForm
      });

      if (success) {
        setShowSignupDialog(false);
        setSignupForm({ name: "", email: "", institution: "", field: "" });
        toast.success("Account created successfully! Welcome to BioResearch Hub!");
      } else {
        toast.error("Failed to create account. Please try again.");
      }
    } catch (error) {
      console.error("Signup error:", error);
      if (error instanceof Error) {
        if (error.message.includes("User rejected") || error.message.includes("rejected")) {
          toast.error("Signature was rejected. Please try again and approve the signature.");
        } else if (error.message.includes("wallet")) {
          toast.error("Wallet connection issue. Please reconnect your wallet.");
        } else {
          toast.error("Failed to create account. Please try again.");
        }
      } else {
        toast.error("Failed to create account. Please try again.");
      }
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setSignupForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Microscope className="h-6 w-6 text-emerald-500" />
          <span className="text-xl font-bold text-emerald-500">BioResearch Hub</span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {connected && isSignedUp && (
            <>
              <Link
                href="/publishpaper"
                className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
              >
                Publish Paper
              </Link>
              <Link
                href="/mint"
                className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
              >
                Mint Tokens
              </Link>
              <Link
                href="/profile"
                className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
              >
                Profile
              </Link>
            </>
          )}
          <Link
            href="/#features"
            className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Features
          </Link>
          <Link
            href="/#about"
            className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            About
          </Link>
        </nav>
        
        <div className="flex items-center gap-4">
          {connected && isSignedUp && (
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
              <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {isLoadingBalance ? "..." : tokenBalance.toFixed(2)} BIOX
              </span>
            </div>
          )}
          
          {connected && !isSignedUp && !isVerifying && (
            <Dialog open={showSignupDialog} onOpenChange={setShowSignupDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Sign Up
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create Your Account</DialogTitle>
                  <DialogDescription>
                    Complete your profile and sign a message to verify your wallet ownership.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      placeholder="Enter your full name"
                      value={signupForm.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      disabled={isSigningUp}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={signupForm.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      disabled={isSigningUp}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="institution">Institution *</Label>
                    <Input
                      id="institution"
                      placeholder="Enter your institution"
                      value={signupForm.institution}
                      onChange={(e) => handleInputChange("institution", e.target.value)}
                      disabled={isSigningUp}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="field">Research Field</Label>
                    <Input
                      id="field"
                      placeholder="e.g., Molecular Biology, Genetics"
                      value={signupForm.field}
                      onChange={(e) => handleInputChange("field", e.target.value)}
                      disabled={isSigningUp}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-md">
                    <strong>Note:</strong> You'll be asked to sign a message with your wallet to verify ownership and create your account.
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowSignupDialog(false)}
                    className="flex-1"
                    disabled={isSigningUp}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSignup}
                    disabled={isSigningUp}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isSigningUp ? "Creating Account..." : "Sign & Create Account"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          
          {isVerifying && (
            <div className="text-sm text-emerald-600 dark:text-emerald-400">
              Verifying wallet...
            </div>
          )}
          
          <ModeToggle />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
