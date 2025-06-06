"use client"

import Link from "next/link"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { useWallet } from "@solana/wallet-adapter-react"
import { WalletButton } from "@/components/wallet-button"
import { useState, useEffect } from "react"
import { Toast, useToast } from "@/components/toast"
import { useUser } from "@/components/user-context"
import {
  ArrowRight,
  Brain,
  FileText,
  FlaskRoundIcon as Flask,
  HeartPulse,
  Menu,
  Microscope,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export default function Home() {
  const { publicKey, signMessage, connected } = useWallet()
  const [isSigningUp, setIsSigningUp] = useState(false)
  const { toast, showToast, hideToast } = useToast()
  const { isSignedUp, setUserSignedUp } = useUser()
  const [isMobileView, setIsMobileView] = useState(false)

  // Check if we're in a mobile view
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobileView(window.innerWidth < 768)
    }

    // Initial check
    checkIfMobile()

    // Add event listener for window resize
    window.addEventListener("resize", checkIfMobile)

    // Cleanup
    return () => window.removeEventListener("resize", checkIfMobile)
  }, [])

  const handleSignUp = async () => {
    if (!connected || !publicKey || !signMessage) {
      showToast("Please connect your wallet first", "error")
      return
    }

    try {
      setIsSigningUp(true)

      // Create a message for the user to sign
      const message = new TextEncoder().encode(
        `Welcome to BioResearch Hub! Sign this message to verify your wallet and complete signup. Timestamp: ${Date.now()}`,
      )

      // Ask user to sign the message
      await signMessage(message)

      // If we get here, the message was signed successfully
      // Use the context to update the user state
      setUserSignedUp(true, publicKey.toString())

      showToast("Successfully signed up! Welcome to BioResearch Hub.", "success")
    } catch (error) {
      console.error("Error during sign up:", error)
      showToast("Sign up failed. Please try again.", "error")
    } finally {
      setIsSigningUp(false)
    }
  }

  const NavLinks = () => (
    <>
      {connected && isSignedUp && (
        <>
          <Link
            href="/publishpaper"
            className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
          >
            Publish Paper
          </Link>
          <Link
            href="/profile"
            className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
          >
            Profile
          </Link>
          <Link
            href="/viewpaperandfund"
            className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300 font-medium" 
          >
            View Papers
          </Link>
          <Link
            href="/mint"
            className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300 font-medium">
            Minting 
            </Link>
        </>
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
    </>
  )

  return (
    <div className="flex min-h-screen flex-col">
      <div className="dna-helix"></div>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4 sm:px-6">
          {/* Main header row */}
          <div className="flex h-14 sm:h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Microscope className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-emerald-500" />
              <span className="text-base sm:text-lg md:text-xl font-bold text-emerald-500 truncate">
                BioResearch Hub
              </span>
            </div>

            {/* Desktop Navigation - hidden on mobile */}
            <nav className="hidden lg:flex items-center gap-4 xl:gap-6 text-sm flex-1 justify-center">
              <NavLinks />
            </nav>

            {/* Right side controls */}
            <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
              {/* Desktop Sign Up Button - hidden on tablet and mobile */}
              {!isSignedUp && (
                <Button
                  className="hidden lg:flex bg-emerald-500 hover:bg-emerald-600 text-white text-xs xl:text-sm px-3 xl:px-4"
                  onClick={handleSignUp}
                  disabled={isSigningUp || !connected}
                  size="sm"
                >
                  {isSigningUp ? "Signing..." : "Sign Up"}
                </Button>
              )}
              
              <ModeToggle />
              <WalletButton />
              
              {/* Mobile Menu Button */}
              <Sheet>
                <SheetTrigger asChild className="lg:hidden">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    aria-label="Menu"
                    className="h-8 w-8 sm:h-9 sm:w-9"
                  >
                    <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] sm:w-[320px] md:w-[350px]">
                  <div className="flex flex-col h-full">
                    {/* Mobile menu header */}
                    <div className="flex items-center gap-2 pb-4 border-b">
                      <Microscope className="h-5 w-5 text-emerald-500" />
                      <span className="text-lg font-bold text-emerald-500">BioResearch Hub</span>
                    </div>
                    
                    {/* Mobile navigation */}
                    <nav className="flex flex-col space-y-4 pt-6 flex-1">
                      <NavLinks />
                    </nav>
                    
                    {/* Mobile Sign Up Button in menu */}
                    {!isSignedUp && (
                      <div className="pt-4 border-t">
                        <Button
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                          onClick={handleSignUp}
                          disabled={isSigningUp || !connected}
                          size="sm"
                        >
                          {isSigningUp ? "Signing..." : "Sign Up"}
                        </Button>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Tablet Sign Up Button - shown only on tablet screens when not signed up */}
          {!isSignedUp && (
            <div className="hidden md:block lg:hidden pb-3 pt-2">
              <Button
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm"
                onClick={handleSignUp}
                disabled={isSigningUp || !connected}
                size="sm"
              >
                {isSigningUp ? "Signing..." : "Sign Up"}
              </Button>
            </div>
          )}

          {/* Mobile Sign Up Button - shown only on mobile when not signed up */}
          {!isSignedUp && (
            <div className="block md:hidden pb-2 pt-2">
              <Button
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm"
                onClick={handleSignUp}
                disabled={isSigningUp || !connected}
                size="sm"
              >
                {isSigningUp ? "Signing..." : "Sign Up"}
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full py-8 md:py-16 lg:py-24 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-emerald-700/10 dark:from-emerald-900/20 dark:to-emerald-800/20"></div>
          </div>
          <div className="container px-4 md:px-6 relative z-10">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 xl:grid-cols-2">
              <div className="flex flex-col justify-center space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold tracking-tighter text-emerald-500 sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl/none">
                    Advancing Bio-Medical Research Together
                  </h1>
                  <p className="max-w-[600px] text-sm sm:text-base md:text-xl text-muted-foreground">
                    Publish, review, fund, and analyze bio-medical research papers in a decentralized ecosystem powered
                    by blockchain and AI.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white w-full sm:w-auto">
                    Publish Your Research
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Link href="/viewpaperandfund" className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      className="border-emerald-500 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-700 w-full"
                    >
                      Explore Papers
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex items-center justify-center mt-6 lg:mt-0">
                <div className="relative h-[250px] w-[250px] sm:h-[300px] sm:w-[300px] md:h-[350px] md:w-[350px] animate-float">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-300 to-emerald-600 dark:from-emerald-700 dark:to-emerald-500 animate-pulse-slow"></div>
                      <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
                        <Microscope className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 text-emerald-500" />
                      </div>
                      <div
                        className="absolute -top-4 -right-4 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center animate-float"
                        style={{ animationDelay: "1s" }}
                      >
                        <FileText className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-emerald-500" />
                      </div>
                      <div
                        className="absolute -bottom-4 -left-4 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center animate-float"
                        style={{ animationDelay: "1.5s" }}
                      >
                        <Brain className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-emerald-500" />
                      </div>
                      <div
                        className="absolute -bottom-4 -right-4 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center animate-float"
                        style={{ animationDelay: "2s" }}
                      >
                        <HeartPulse className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-emerald-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-8 md:py-16 lg:py-24 bg-muted/50">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center animate-fade-in">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-emerald-100 dark:bg-emerald-900 px-3 py-1 text-sm text-emerald-500">
                  Features
                </div>
                <h2 className="text-2xl font-bold tracking-tighter text-emerald-500 sm:text-3xl md:text-4xl lg:text-5xl">
                  Revolutionizing Bio-Medical Research
                </h2>
                <p className="max-w-[900px] text-sm sm:text-base md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed text-muted-foreground">
                  Our platform offers unique advantages that traditional research publishing can&apos;t match.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-center gap-4 sm:gap-6 py-8 md:py-12 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-4 sm:p-6 shadow-sm card-hover animate-fade-in animate-delay-100">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-emerald-500">Publish Research</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Publish your bio-medical research papers with full ownership and transparent attribution.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-4 sm:p-6 shadow-sm card-hover animate-fade-in animate-delay-200">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <ThumbsUp className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-emerald-500">Community Review</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Get feedback through upvotes, downvotes, and peer reviews from the scientific community.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-4 sm:p-6 shadow-sm card-hover animate-fade-in animate-delay-300">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-emerald-500">Crowdfunding</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Secure funding for your research directly from interested parties and organizations.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-4 sm:p-6 shadow-sm card-hover animate-fade-in animate-delay-100">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-emerald-500">AI Analysis</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Leverage AI to analyze your research, identify patterns, and suggest improvements.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-4 sm:p-6 shadow-sm card-hover animate-fade-in animate-delay-200">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <Flask className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-emerald-500">Collaboration</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Connect with researchers worldwide and form collaborative partnerships.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 rounded-lg border p-4 sm:p-6 shadow-sm card-hover animate-fade-in animate-delay-300">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-emerald-500">Fast Publication</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Bypass traditional lengthy publication processes while maintaining scientific rigor.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="w-full py-8 md:py-16 lg:py-24">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
              <div className="space-y-4 animate-fade-in">
                <div className="inline-block rounded-lg bg-emerald-100 dark:bg-emerald-900 px-3 py-1 text-sm text-emerald-500">
                  About Us
                </div>
                <h2 className="text-2xl font-bold tracking-tighter text-emerald-500 sm:text-3xl md:text-4xl lg:text-5xl">
                  Our Mission
                </h2>
                <p className="text-sm sm:text-base md:text-xl/relaxed text-muted-foreground">
                  BioResearch Hub was founded with a simple yet powerful mission: to democratize bio-medical research
                  and accelerate scientific discovery.
                </p>
                <p className="text-sm sm:text-base md:text-xl/relaxed text-muted-foreground">
                  We believe in a future where research is accessible, transparent, and collaborative. By leveraging
                  blockchain technology and AI, we&apos;re building a platform that eliminates barriers, reduces
                  publication bias, and empowers researchers worldwide.
                </p>
                <p className="text-sm sm:text-base md:text-xl/relaxed text-muted-foreground">
                  Our team consists of scientists, developers, and healthcare specialists who are passionate about
                  creating a more equitable research ecosystem.
                </p>
              </div>
              <div className="flex items-center justify-center animate-fade-in animate-delay-200">
                <div className="relative w-full max-w-md">
                  <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-30 blur"></div>
                  <div className="relative rounded-lg border bg-background p-4 sm:p-6 shadow-sm">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-2">
                          <ThumbsUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
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
                          <ThumbsDown className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                        </div>
                        <div className="flex-1">
                          <div className="h-2 w-full rounded-full bg-emerald-100 dark:bg-emerald-900">
                            <div className="h-2 w-1/4 rounded-full bg-emerald-500"></div>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">25% Downvoted</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-base sm:text-lg font-semibold text-emerald-500">
                          Novel CRISPR Application in Neurological Disorders
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
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
                        <div className="text-xs sm:text-sm font-medium text-emerald-500">
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

        <section id="how-it-works" className="w-full py-8 md:py-16 lg:py-24 bg-muted/50">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center animate-fade-in">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-emerald-100 dark:bg-emerald-900 px-3 py-1 text-sm text-emerald-500">
                  How It Works
                </div>
                <h2 className="text-2xl font-bold tracking-tighter text-emerald-500 sm:text-3xl md:text-4xl lg:text-5xl">
                  The Research Journey
                </h2>
                <p className="max-w-[900px] text-sm sm:text-base md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed text-muted-foreground">
                  From publication to funding, our platform streamlines the entire research process.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl gap-4 sm:gap-6 py-8 md:py-12 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col items-center space-y-2 rounded-lg border p-4 sm:p-6 shadow-sm card-hover animate-fade-in animate-delay-100">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <div className="rounded-full bg-emerald-500 text-white w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center font-bold">
                    1
                  </div>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-emerald-500">Submit Research</h3>
                <p className="text-center text-xs sm:text-sm text-muted-foreground">
                  Upload your paper, data, and methodology to our secure platform
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border p-4 sm:p-6 shadow-sm card-hover animate-fade-in animate-delay-200">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <div className="rounded-full bg-emerald-500 text-white w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center font-bold">
                    2
                  </div>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-emerald-500">Community Review</h3>
                <p className="text-center text-xs sm:text-sm text-muted-foreground">
                  Receive feedback, upvotes, and constructive criticism
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border p-4 sm:p-6 shadow-sm card-hover animate-fade-in animate-delay-300">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <div className="rounded-full bg-emerald-500 text-white w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center font-bold">
                    3
                  </div>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-emerald-500">AI Analysis</h3>
                <p className="text-center text-xs sm:text-sm text-muted-foreground">
                  Get AI-powered insights and improvement suggestions
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border p-4 sm:p-6 shadow-sm card-hover animate-fade-in animate-delay-400">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                  <div className="rounded-full bg-emerald-500 text-white w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center font-bold">
                    4
                  </div>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-emerald-500">Secure Funding</h3>
                <p className="text-center text-xs sm:text-sm text-muted-foreground">
                  Attract crowdfunding from interested parties and organizations
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="w-full py-8 md:py-16 lg:py-24">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center animate-fade-in">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-emerald-100 dark:bg-emerald-900 px-3 py-1 text-sm text-emerald-500">
                  Join Us
                </div>
                <h2 className="text-2xl font-bold tracking-tighter text-emerald-500 sm:text-3xl md:text-4xl lg:text-5xl">
                  Be Part of the Scientific Revolution
                </h2>
                <p className="max-w-[900px] text-sm sm:text-base md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed text-muted-foreground">
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
            <Microscope className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
            <span className="text-base sm:text-lg font-bold text-emerald-500">BioResearch Hub</span>
          </div>
          <p className="text-center text-xs sm:text-sm text-muted-foreground">
            © 2025 BioResearch Hub. All rights reserved. Powered by blockchain technology.
          </p>
          <div className="flex gap-4">
            <Link href="#" className="text-xs sm:text-sm text-muted-foreground hover:text-emerald-500">
              Terms
            </Link>
            <Link href="#" className="text-xs sm:text-sm text-muted-foreground hover:text-emerald-500">
              Privacy
            </Link>
            <Link href="#" className="text-xs sm:text-sm text-muted-foreground hover:text-emerald-500">
              Contact
            </Link>
          </div>
        </div>
      </footer>
      {toast.visible && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
