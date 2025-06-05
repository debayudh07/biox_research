"use client"

import Link from "next/link"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { useWallet } from "@solana/wallet-adapter-react"
import { WalletButton } from "@/components/wallet-button"
import { useState } from "react"
import { Toast, useToast } from "@/components/toast"
import { useUser } from "@/components/user-context"
import {
  ArrowRight,
  Brain,
  FileText,
  FlaskRoundIcon as Flask,
  HeartPulse,
  Microscope,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from "lucide-react"

export default function Home() {
  const { publicKey, signMessage, connected } = useWallet();
  const [isSigningUp, setIsSigningUp] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  const { isSignedUp, setUserSignedUp } = useUser();
  
  const handleSignUp = async () => {
    if (!connected || !publicKey || !signMessage) {
      showToast("Please connect your wallet first", "error");
      return;
    }
    
    try {
      setIsSigningUp(true);
      
      // Create a message for the user to sign
      const message = new TextEncoder().encode(
        `Welcome to BioResearch Hub! Sign this message to verify your wallet and complete signup. Timestamp: ${Date.now()}`
      );
      
      // Ask user to sign the message
      await signMessage(message);
      
      // If we get here, the message was signed successfully
      // Use the context to update the user state
      setUserSignedUp(true, publicKey.toString());
      
      showToast("Successfully signed up! Welcome to BioResearch Hub.", "success");
      
    } catch (error) {
      console.error("Error during sign up:", error);
      showToast("Sign up failed. Please try again.", "error");
    } finally {
      setIsSigningUp(false);
    }
  };
  
  return (
    <div className="flex min-h-screen flex-col">
      <div className="dna-helix"></div>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Microscope className="h-6 w-6 text-emerald-500" />
            <span className="text-xl font-bold text-emerald-500">BioResearch Hub</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {connected && isSignedUp && (
              <Link
                href="/publishpaper"
                className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
              >
                Publish Paper
              </Link>
            )}
            <Link
              href="#features"
              className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Features
            </Link>
            <Link
              href="#about"
              className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              About
            </Link>
            <Link
              href="#how-it-works"
              className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              How It Works
            </Link>
            <Link
              href="#contact"
              className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <ModeToggle />
            <WalletButton />
            {!isSignedUp && (
              <Button 
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={handleSignUp}
                disabled={isSigningUp || !connected}
              >
                {isSigningUp ? "Signing..." : "Sign Up"}
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-emerald-700/10 dark:from-emerald-900/20 dark:to-emerald-800/20"></div>
          </div>
          <div className="container px-4 md:px-6 relative z-10">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 xl:grid-cols-2">
              <div className="flex flex-col justify-center space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter text-emerald-500 sm:text-5xl xl:text-6xl/none">
                    Advancing Bio-Medical Research Together
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    Publish, review, fund, and analyze bio-medical research papers in a decentralized ecosystem powered
                    by blockchain and AI.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    Publish Your Research
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                    <Link href="/viewpaperandfund">
                    <Button
                      variant="outline"
                      className="border-emerald-500 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-700"
                    >
                      Explore Papers
                    </Button>
                    </Link>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative h-[350px] w-[350px] animate-float">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-64 h-64">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-300 to-emerald-600 dark:from-emerald-700 dark:to-emerald-500 animate-pulse-slow"></div>
                      <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
                        <Microscope className="h-24 w-24 text-emerald-500" />
                      </div>
                      <div
                        className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center animate-float"
                        style={{ animationDelay: "1s" }}
                      >
                        <FileText className="h-8 w-8 text-emerald-500" />
                      </div>
                      <div
                        className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center animate-float"
                        style={{ animationDelay: "1.5s" }}
                      >
                        <Brain className="h-8 w-8 text-emerald-500" />
                      </div>
                      <div
                        className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center animate-float"
                        style={{ animationDelay: "2s" }}
                      >
                        <HeartPulse className="h-8 w-8 text-emerald-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center animate-fade-in">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-emerald-100 dark:bg-emerald-900 px-3 py-1 text-sm text-emerald-500">
                  Features
                </div>
                <h2 className="text-3xl font-bold tracking-tighter text-emerald-500 sm:text-5xl">
                  Revolutionizing Bio-Medical Research
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Our platform offers unique advantages that traditional research publishing can&apos;t match.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-6 shadow-sm card-hover animate-fade-in animate-delay-100">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <FileText className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-emerald-500">Publish Research</h3>
                <p className="text-center text-muted-foreground">
                  Publish your bio-medical research papers with full ownership and transparent attribution.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-6 shadow-sm card-hover animate-fade-in animate-delay-200">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <ThumbsUp className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-emerald-500">Community Review</h3>
                <p className="text-center text-muted-foreground">
                  Get feedback through upvotes, downvotes, and peer reviews from the scientific community.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-6 shadow-sm card-hover animate-fade-in animate-delay-300">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <Users className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-emerald-500">Crowdfunding</h3>
                <p className="text-center text-muted-foreground">
                  Secure funding for your research directly from interested parties and organizations.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-6 shadow-sm card-hover animate-fade-in animate-delay-100">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <Brain className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-emerald-500">AI Analysis</h3>
                <p className="text-center text-muted-foreground">
                  Leverage AI to analyze your research, identify patterns, and suggest improvements.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-6 shadow-sm card-hover animate-fade-in animate-delay-200">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <Flask className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-emerald-500">Collaboration</h3>
                <p className="text-center text-muted-foreground">
                  Connect with researchers worldwide and form collaborative partnerships.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-6 shadow-sm card-hover animate-fade-in animate-delay-300">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <Zap className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-emerald-500">Fast Publication</h3>
                <p className="text-center text-muted-foreground">
                  Bypass traditional lengthy publication processes while maintaining scientific rigor.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
              <div className="space-y-4 animate-fade-in">
                <div className="inline-block rounded-lg bg-emerald-100 dark:bg-emerald-900 px-3 py-1 text-sm text-emerald-500">
                  About Us
                </div>
                <h2 className="text-3xl font-bold tracking-tighter text-emerald-500 sm:text-4xl md:text-5xl">
                  Our Mission
                </h2>
                <p className="text-muted-foreground md:text-xl/relaxed">
                  BioResearch Hub was founded with a simple yet powerful mission: to democratize bio-medical research
                  and accelerate scientific discovery.
                </p>
                <p className="text-muted-foreground md:text-xl/relaxed">
                  We believe in a future where research is accessible, transparent, and collaborative. By leveraging
                  blockchain technology and AI, we&apos;re building a platform that eliminates barriers, reduces publication
                  bias, and empowers researchers worldwide.
                </p>
                <p className="text-muted-foreground md:text-xl/relaxed">
                  Our team consists of scientists, developers, and healthcare specialists who are passionate about
                  creating a more equitable research ecosystem.
                </p>
              </div>
              <div className="flex items-center justify-center animate-fade-in animate-delay-200">
                <div className="relative w-full max-w-md">
                  <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-30 blur"></div>
                  <div className="relative rounded-lg border bg-background p-6 shadow-sm">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-2">
                          <ThumbsUp className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div className="flex-1">
                          <div className="h-2 w-full rounded-full bg-emerald-100 dark:bg-emerald-900">
                            <div className="h-2 w-3/4 rounded-full bg-emerald-500"></div>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">75% Upvoted</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-2">
                          <ThumbsDown className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div className="flex-1">
                          <div className="h-2 w-full rounded-full bg-emerald-100 dark:bg-emerald-900">
                            <div className="h-2 w-1/4 rounded-full bg-emerald-500"></div>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">25% Downvoted</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-emerald-500">
                          Novel CRISPR Application in Neurological Disorders
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          This groundbreaking research demonstrates a new application of CRISPR-Cas9 technology in
                          treating neurodegenerative diseases...
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>By Dr. Sarah Chen</span>
                          <span>•</span>
                          <span>Published 2 days ago</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-emerald-500">
                          $24,850 <span className="text-xs text-muted-foreground">funded</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-emerald-500 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-700"
                        >
                          View Paper
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center animate-fade-in">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-emerald-100 dark:bg-emerald-900 px-3 py-1 text-sm text-emerald-500">
                  How It Works
                </div>
                <h2 className="text-3xl font-bold tracking-tighter text-emerald-500 sm:text-5xl">
                  The Research Journey
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  From publication to funding, our platform streamlines the entire research process.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl gap-6 py-12 lg:grid-cols-4">
              <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm card-hover animate-fade-in animate-delay-100">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <div className="rounded-full bg-emerald-500 text-white w-8 h-8 flex items-center justify-center font-bold">
                    1
                  </div>
                </div>
                <h3 className="text-lg font-bold text-emerald-500">Submit Research</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Upload your paper, data, and methodology to our secure platform
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm card-hover animate-fade-in animate-delay-200">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <div className="rounded-full bg-emerald-500 text-white w-8 h-8 flex items-center justify-center font-bold">
                    2
                  </div>
                </div>
                <h3 className="text-lg font-bold text-emerald-500">Community Review</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Receive feedback, upvotes, and constructive criticism
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm card-hover animate-fade-in animate-delay-300">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <div className="rounded-full bg-emerald-500 text-white w-8 h-8 flex items-center justify-center font-bold">
                    3
                  </div>
                </div>
                <h3 className="text-lg font-bold text-emerald-500">AI Analysis</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Get AI-powered insights and improvement suggestions
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm card-hover animate-fade-in animate-delay-400">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <div className="rounded-full bg-emerald-500 text-white w-8 h-8 flex items-center justify-center font-bold">
                    4
                  </div>
                </div>
                <h3 className="text-lg font-bold text-emerald-500">Secure Funding</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Attract crowdfunding from interested parties and organizations
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center animate-fade-in">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-emerald-100 dark:bg-emerald-900 px-3 py-1 text-sm text-emerald-500">
                  Join Us
                </div>
                <h2 className="text-3xl font-bold tracking-tighter text-emerald-500 sm:text-5xl">
                  Be Part of the Scientific Revolution
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Join our community of researchers and help shape the future of bio-medical science.
                </p>
              </div>
              <div className="w-full max-w-sm space-y-2 animate-fade-in animate-delay-200">
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                  Register as a Researcher
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-emerald-500 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-700"
                >
                  Subscribe to Research Updates
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="w-full border-t py-6">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <Microscope className="h-6 w-6 text-emerald-500" />
            <span className="text-lg font-bold text-emerald-500">BioResearch Hub</span>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            © 2025 BioResearch Hub. All rights reserved. Powered by blockchain technology.
          </p>
          <div className="flex gap-4">
            <Link href="#" className="text-muted-foreground hover:text-emerald-500">
              Terms
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-emerald-500">
              Privacy
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-emerald-500">
              Contact
            </Link>
          </div>
        </div>
      </footer>
      {toast.visible && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={hideToast} 
        />
      )}
    </div>
  )
}
