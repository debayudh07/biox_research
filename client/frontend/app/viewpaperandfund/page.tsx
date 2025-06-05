/*eslint-disable*/
"use client"

import { useState, useEffect, useCallback } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { PublicKey } from "@solana/web3.js"
import { getAssociatedTokenAddressSync } from "@solana/spl-token"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Navigation } from "@/components/navigation"
import {
  initializeProgram,
  getAllPapers,
  votePaperWorkflow,
  getConnectionInfo,
  fundPaperWorkflow,
  getUserTokenBalance,
  getCurrentTokenMint,
  BIOX_TOKEN_MINT,
} from "@/lib/solana"
import {
  ExternalLink,
  FileText,
  Download,
  AlertCircle,
  TrendingUp,
  Users,
  Zap,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Search,
  RefreshCw,
  Coins,
} from "lucide-react"

interface Paper {
  id: string
  title: string
  abstractText: string
  ipfsHash: string
  authors: string[]
  author: string
  fundingGoal: string
  currentFunding: string
  fundingDeadline: string
  status: Record<string, unknown>
  pda: string
}

interface FundingState {
  amount: string
  isLoading: boolean
}

interface VotingState {
  isLoading: boolean
}

interface VotingInfo {
  hasVoted: boolean
  voteType?: "upvote" | "downvote"
  isLoading: boolean
}

interface PreviewState {
  isOpen: boolean
  isLoading: boolean
  content: string | null
  error: string | null
  contentType: "pdf" | "text" | "json" | "unknown"
}

export default function ViewAndFundPapersPage() {
  const { connected, wallet, publicKey } = useWallet()
  const [papers, setPapers] = useState<Paper[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [fundingStates, setFundingStates] = useState<Record<string, FundingState>>({})
  const [votingStates, setVotingStates] = useState<Record<string, VotingState>>({})
  const [votingInfo, setVotingInfo] = useState<Record<string, VotingInfo>>({})
  const [previewStates, setPreviewStates] = useState<Record<string, PreviewState>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [sortBy, setSortBy] = useState("newest")
  const [userTokenBalance, setUserTokenBalance] = useState<number>(0)
  const [isCheckingBalance, setIsCheckingBalance] = useState(false)
  
  const loadPapers = useCallback(async () => {
    try {
      setIsLoading(true)
      setError("")

      if (!wallet) {
        setError("Wallet is required to view papers")
        return
      }

      console.log("Loading papers...")
      console.log("Connection Info:", getConnectionInfo())

      const program = initializeProgram(wallet)
      const result = await getAllPapers(program)

      if (result.success && result.data) {
        if (Array.isArray(result.data)) {
          const validPapers = result.data.filter((paper): paper is Paper => paper !== undefined)
          setPapers(validPapers)
          console.log(`Loaded ${validPapers.length} papers`)

          for (const paper of validPapers) {
            await checkVotingStatus(paper.id)
          }
        } else {
          setPapers([])
          console.log("No papers found")
        }
      } else {
        setError((result as unknown as { error: string }).error || "Failed to load papers")
      }
    } catch (err) {
      console.error("Error loading papers:", err)
      setError(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [wallet, connected, publicKey])

  // Check user's token balance
  const checkUserBalance = useCallback(async () => {
    if (!connected || !publicKey) {
      setUserTokenBalance(0)
      return
    }

    try {
      setIsCheckingBalance(true)
      const balanceResult = await getUserTokenBalance(
        { publicKey },
        getCurrentTokenMint()
      )

      if (balanceResult.success) {
        setUserTokenBalance(balanceResult.balance)
      } else {
        console.error("Failed to get token balance:", balanceResult.error)
        setUserTokenBalance(0)
      }
    } catch (error) {
      console.error("Error checking balance:", error)
      setUserTokenBalance(0)
    } finally {
      setIsCheckingBalance(false)
    }
  }, [connected, publicKey])

  // Load papers on component mount and when wallet connects
  useEffect(() => {
    loadPapers()
  }, [loadPapers])

  // Check balance when wallet connects
  useEffect(() => {
    checkUserBalance()
  }, [checkUserBalance])

  const checkVotingStatus = async (paperId: string) => {
    if (!connected || !publicKey || !wallet) return

    try {
      const program = initializeProgram(wallet)
      const { hasUserVoted, getVoteDetails } = await import("@/lib/solana")

      setVotingInfo((prev) => ({
        ...prev,
        [paperId]: {
          hasVoted: false,
          voteType: undefined,
          isLoading: true,
        },
      }))

      const hasVoted = await hasUserVoted(program, Number.parseInt(paperId), publicKey)

      let voteType: "upvote" | "downvote" | undefined
      if (hasVoted) {
        const voteResult = await getVoteDetails(program, Number.parseInt(paperId), publicKey)
        if (voteResult.success && voteResult.data) {
          voteType = voteResult.data.isUpvote ? "upvote" : "downvote"
        }
      }

      setVotingInfo((prev) => ({
        ...prev,
        [paperId]: {
          hasVoted,
          voteType,
          isLoading: false,
        },
      }))
    } catch (error) {
      console.error("Error checking voting status:", error)
      setVotingInfo((prev) => ({
        ...prev,
        [paperId]: {
          hasVoted: false,
          voteType: undefined,
          isLoading: false,
        },
      }))
    }
  }

  const handleFundPaper = async (paperId: string) => {
    if (!connected || !publicKey || !wallet) {
      setError("Please connect your wallet to fund papers")
      return
    }

    const amount = fundingStates[paperId]?.amount
    if (!amount || Number.parseFloat(amount) <= 0) {
      setError("Please enter a valid token amount")
      return
    }

    try {
      setFundingStates((prev) => ({
        ...prev,
        [paperId]: { ...prev[paperId], isLoading: true },
      }))
      setError("")

      const amountInTokens = Number.parseFloat(amount)
      console.log(`Funding paper ${paperId} with ${amountInTokens} BIOX tokens`)

      // Check if user has sufficient balance
      if (amountInTokens > userTokenBalance) {
        setError(`Insufficient BIOX token balance. You have ${userTokenBalance.toFixed(2)} BIOX, but need ${amountInTokens} BIOX.`)
        return
      }

      // Use the enhanced funding workflow that handles token account creation
      const result = await fundPaperWorkflow(
        wallet, 
        Number.parseInt(paperId), 
        amountInTokens,
        getCurrentTokenMint() // Use the current BIOX token mint
      )

      if (result.success) {
        console.log("Funding successful:", 'signature' in result ? result.signature : "Transaction completed")
        
        // Refresh papers and balance
        await loadPapers()
        await checkUserBalance()
        
        // Clear the form
        setFundingStates((prev) => ({
          ...prev,
          [paperId]: { amount: "", isLoading: false },
        }))
        
        setError("")
        
        // Show success message
        const successMessage = `Successfully funded ${amountInTokens} BIOX tokens to paper #${paperId}!`
        console.log(successMessage)
        
        // Show success animation
        const successElement = document.getElementById(`success-${paperId}`)
        if (successElement) {
          successElement.classList.add("animate-pulse")
          setTimeout(() => successElement.classList.remove("animate-pulse"), 2000)
        }
      } else {
        let errorMessage = `Funding failed: ${result.error}`
        
        // Handle specific error cases
        if (result.error?.includes("insufficient")) {
          errorMessage = "Insufficient BIOX token balance or SOL for transaction fees."
        } else if (result.error?.includes("token account")) {
          errorMessage = "Token account setup failed. Please ensure you have set up your BIOX token account."
        } else if (result.error?.includes("not published")) {
          errorMessage = "This paper must be published before it can be funded."
        }
        
        setError(errorMessage)
      }
    } catch (err) {
      console.error("Error funding paper:", err)
      setError(err instanceof Error ? err.message : "Unknown error occurred while funding")
    } finally {
      setFundingStates((prev) => ({
        ...prev,
        [paperId]: { ...prev[paperId], isLoading: false },
      }))
    }
  }

  const handleVotePaper = async (paperId: string, isUpvote: boolean) => {
    if (!connected || !publicKey || !wallet) {
      setError("Please connect your wallet to vote")
      return
    }

    try {
      setVotingStates((prev) => ({
        ...prev,
        [paperId]: { isLoading: true },
      }))
      setError("")

      console.log(`Voting on paper ${paperId}: ${isUpvote ? "upvote" : "downvote"}`)

      // Use the voting workflow which handles token account creation
      const result = await votePaperWorkflow(
        wallet, 
        Number.parseInt(paperId), 
        isUpvote
        // No need to pass voterTokenAccount - the workflow will handle it
      )
      
      if (result.success) {
        console.log("Voting successful:", 'txHash' in result ? result.txHash : "Transaction completed")
        
        // Refresh papers and voting status
        await loadPapers()
        await checkVotingStatus(paperId)
        
        setError("")
        
        const voteType = isUpvote ? "upvote" : "downvote"
        console.log(`Successfully ${voteType}d paper #${paperId}!`)
      } else {
        let errorMessage = `Voting failed: ${result.error}`
        
        // Handle specific error cases
        if (result.error?.includes("already voted")) {
          errorMessage = "You have already voted on this paper. Each user can only vote once per paper."
        } else if (result.error?.includes("not published")) {
          errorMessage = "This paper must be published before it can receive votes."
        } else if (result.error?.includes("token account")) {
          errorMessage = "Token account setup failed. Please ensure you have set up your BIOX token account."
        }
        
        setError(errorMessage)
      }
    } catch (err) {
      console.error("Error voting on paper:", err)
      setError(err instanceof Error ? err.message : "Unknown error occurred while voting")
    } finally {
      setVotingStates((prev) => ({
        ...prev,
        [paperId]: { isLoading: false },
      }))
    }
  }

  const formatAmount = (amount: string) => {
    const num = Number.parseInt(amount)
    return (num / Math.pow(10, 9)).toFixed(2) // BIOX token has 9 decimals
  }

  const getStatusBadge = (status: Record<string, unknown>) => {
    const statusKey = Object.keys(status)[0]
    const statusConfig = {
      draft: { color: "bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 border-slate-300", icon: "📝" },
      published: {
        color: "bg-gradient-to-r from-emerald-100 to-green-200 text-emerald-800 border-emerald-300",
        icon: "🌟",
      },
      fullyFunded: {
        color: "bg-gradient-to-r from-green-100 to-emerald-200 text-green-800 border-green-300",
        icon: "💰",
      },
      completed: {
        color: "bg-gradient-to-r from-purple-100 to-violet-200 text-purple-800 border-purple-300",
        icon: "✅",
      },
      rejected: { color: "bg-gradient-to-r from-red-100 to-rose-200 text-red-800 border-red-300", icon: "❌" },
    }

    const config = statusConfig[statusKey as keyof typeof statusConfig] || statusConfig.draft

    return (
      <Badge className={`${config.color} border shadow-sm font-medium px-3 py-1 text-xs`}>
        <span className="mr-1">{config.icon}</span>
        {statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
      </Badge>
    )
  }

  const handlePreviewPaper = async (paperId: string, ipfsHash: string) => {
    try {
      setPreviewStates((prev) => ({
        ...prev,
        [paperId]: {
          isOpen: true,
          isLoading: true,
          content: null,
          error: null,
          contentType: "unknown",
        },
      }))

      const gateways = [
        `https://ipfs.io/ipfs/${ipfsHash}`,
        `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
        `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
        `https://dweb.link/ipfs/${ipfsHash}`,
      ]

      let content = null
      let contentType: "pdf" | "text" | "json" | "unknown" = "unknown"
      let fetchError = null

      for (const gateway of gateways) {
        try {
          console.log(`Trying to fetch from: ${gateway}`)

          const response = await fetch(gateway, {
            method: "GET",
            headers: {
              Accept: "*/*",
            },
            signal: AbortSignal.timeout(10000),
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const contentTypeHeader = response.headers.get("content-type") || ""

          if (contentTypeHeader.includes("application/pdf")) {
            contentType = "pdf"
            content = gateway
            break
          } else if (contentTypeHeader.includes("application/json")) {
            contentType = "json"
            const jsonData = await response.json()
            content = JSON.stringify(jsonData, null, 2)
            break
          } else {
            contentType = "text"
            content = await response.text()

            try {
              const parsed = JSON.parse(content)
              contentType = "json"
              content = JSON.stringify(parsed, null, 2)
            } catch {
              // Keep as text
            }
            break
          }
        } catch (err) {
          console.warn(`Failed to fetch from ${gateway}:`, err)
          fetchError = err
          continue
        }
      }

      if (!content) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : "Unknown error"
        throw new Error(`Failed to fetch content from all gateways. Last error: ${errorMessage}`)
      }

      setPreviewStates((prev) => ({
        ...prev,
        [paperId]: {
          isOpen: true,
          isLoading: false,
          content,
          error: null,
          contentType,
        },
      }))
    } catch (err) {
      console.error("Error previewing paper:", err)
      setPreviewStates((prev) => ({
        ...prev,
        [paperId]: {
          isOpen: true,
          isLoading: false,
          content: null,
          error: err instanceof Error ? err.message : "Failed to load paper preview",
          contentType: "unknown",
        },
      }))
    }
  }

  const closePreview = (paperId: string) => {
    setPreviewStates((prev) => ({
      ...prev,
      [paperId]: {
        ...prev[paperId],
        isOpen: false,
      },
    }))
  }

  const renderPreviewContent = (paperId: string, preview: PreviewState) => {
    if (preview.isLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-500 mx-auto mb-4"></div>
              <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-emerald-500 animate-pulse" />
            </div>
            <p className="text-slate-600 font-medium">Loading paper preview...</p>
            <p className="text-sm text-slate-400 mt-1">Fetching from IPFS network</p>
          </div>
        </div>
      )
    }

    if (preview.error) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="relative mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-rose-200 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <p className="text-red-600 font-semibold mb-2">Failed to load preview</p>
            <p className="text-sm text-slate-500 mb-6 max-w-md">{preview.error}</p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-200 hover:bg-emerald-50"
                onClick={() => {
                  const paper = papers.find((p) => p.id === paperId)
                  if (paper) {
                    window.open(`https://ipfs.io/ipfs/${paper.ipfsHash}`, "_blank")
                  }
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-200 hover:bg-emerald-50"
                onClick={() => {
                  const paper = papers.find((p) => p.id === paperId)
                  if (paper) {
                    handlePreviewPaper(paperId, paper.ipfsHash)
                  }
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )
    }

    switch (preview.contentType) {
      case "pdf":
        return (
          <div className="h-96 w-full rounded-lg overflow-hidden border border-emerald-200">
            <iframe src={preview.content!} className="w-full h-full" title="Paper Preview" />
          </div>
        )

      case "json":
      case "text":
        return (
          <ScrollArea className="h-96 w-full border border-emerald-200 rounded-lg">
            <div className="p-6 bg-gradient-to-br from-slate-50 to-emerald-50">
              <pre className="text-sm whitespace-pre-wrap font-mono text-slate-700 leading-relaxed">
                {preview.content}
              </pre>
            </div>
          </ScrollArea>
        )

      default:
        return (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-slate-600 font-medium mb-4">Unable to preview this file type</p>
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-200 hover:bg-emerald-50"
                onClick={() => {
                  const paper = papers.find((p) => p.id === paperId)
                  if (paper) {
                    window.open(`https://ipfs.io/ipfs/${paper.ipfsHash}`, "_blank")
                  }
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
            </div>
          </div>
        )
    }
  }

  // Filter and sort papers
  const filteredAndSortedPapers = papers
    .filter((paper) => {
      const matchesSearch =
        paper.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.abstractText.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.authors.some((author) => author.toLowerCase().includes(searchTerm.toLowerCase()))

      if (filterStatus === "all") return matchesSearch

      const statusKey = Object.keys(paper.status)[0]
      return matchesSearch && statusKey === filterStatus
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "funding":
          return Number.parseInt(b.currentFunding) - Number.parseInt(a.currentFunding)
        case "goal":
          return Number.parseInt(b.fundingGoal) - Number.parseInt(a.fundingGoal)
        case "progress":
          const progressA = (Number.parseInt(a.currentFunding) / Number.parseInt(a.fundingGoal)) * 100
          const progressB = (Number.parseInt(b.currentFunding) / Number.parseInt(b.fundingGoal)) * 100
          return progressB - progressA
        default:
          return Number.parseInt(b.id) - Number.parseInt(a.id)
      }
    })

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-green-100/20">
        <Navigation />
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-md mx-auto">
            <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="text-center pb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Zap className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  Connect Your Wallet
                </CardTitle>
                <CardDescription className="text-slate-600 text-base mt-2">
                  Connect your Solana wallet to explore and fund cutting-edge research papers in biotechnology.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-green-100/20">
      <Navigation />

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-green-500/10"></div>
        <div className="container mx-auto px-6 py-16 relative">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 bg-clip-text text-transparent leading-tight">
              Research Papers
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Discover, fund, and vote on groundbreaking research in biotechnology and life sciences
            </p>
            <div className="flex items-center justify-center gap-6 mt-8 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500" />
                <span>{papers.length} Active Papers</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span>Growing Community</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <span>Cutting-edge Research</span>
              </div>
            </div>
          </div>

          {/* User Balance Display */}
          <div className="max-w-md mx-auto mb-8">
            <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center">
                      <Coins className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Your BIOX Balance</p>
                      <p className="text-xl font-bold text-emerald-600">
                        {isCheckingBalance ? (
                          <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin inline-block"></div>
                        ) : (
                          `${userTokenBalance.toFixed(2)} BIOX`
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={checkUserBalance}
                    disabled={isCheckingBalance}
                    variant="outline"
                    size="sm"
                    className="border-emerald-200 hover:bg-emerald-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isCheckingBalance ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter Controls */}
          <div className="max-w-4xl mx-auto mb-8">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search papers, authors, or keywords..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400/20"
                    />
                  </div>
                  <div className="flex gap-3">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-4 py-2 border border-emerald-200 rounded-md bg-white focus:border-emerald-400 focus:ring-emerald-400/20 text-sm"
                    >
                      <option value="all">All Status</option>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="fullyFunded">Fully Funded</option>
                      <option value="completed">Completed</option>
                    </select>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-4 py-2 border border-emerald-200 rounded-md bg-white focus:border-emerald-400 focus:ring-emerald-400/20 text-sm"
                    >
                      <option value="newest">Newest First</option>
                      <option value="funding">Most Funded</option>
                      <option value="goal">Highest Goal</option>
                      <option value="progress">Most Progress</option>
                    </select>
                    <Button
                      onClick={loadPapers}
                      disabled={isLoading}
                      variant="outline"
                      size="sm"
                      className="border-emerald-200 hover:bg-emerald-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error Display */}
          {error && (
            <Card className="mb-8 border-red-200 bg-gradient-to-r from-red-50 to-rose-50 max-w-4xl mx-auto">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 font-medium">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Bar */}
          <div className="flex justify-between items-center mb-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/80 border-emerald-200 text-emerald-700">
                {filteredAndSortedPapers.length} papers found
              </Badge>
              {searchTerm && (
                <Badge variant="outline" className="bg-white/80 border-slate-200 text-slate-600">
                  Searching: &quot;{searchTerm}&quot;
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Papers Grid */}
      <div className="container mx-auto px-6 pb-16">
        {isLoading ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm animate-pulse">
                <CardHeader className="pb-4">
                  <div className="h-6 bg-gradient-to-r from-slate-200 to-emerald-200 rounded-md w-3/4 mb-2"></div>
                  <div className="h-4 bg-gradient-to-r from-slate-200 to-emerald-200 rounded-md w-1/2"></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="h-3 bg-gradient-to-r from-slate-200 to-emerald-200 rounded-md"></div>
                    <div className="h-3 bg-gradient-to-r from-slate-200 to-emerald-200 rounded-md"></div>
                    <div className="h-3 bg-gradient-to-r from-slate-200 to-emerald-200 rounded-md w-2/3"></div>
                  </div>
                  <div className="h-2 bg-gradient-to-r from-slate-200 to-emerald-200 rounded-full"></div>
                  <div className="flex gap-2">
                    <div className="h-8 bg-gradient-to-r from-slate-200 to-emerald-200 rounded-md flex-1"></div>
                    <div className="h-8 bg-gradient-to-r from-slate-200 to-emerald-200 rounded-md w-20"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAndSortedPapers.length === 0 ? (
          <Card className="max-w-2xl mx-auto border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-16 pb-16 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText className="h-10 w-10 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No Papers Found</h3>
              <p className="text-slate-500 mb-6">
                {searchTerm || filterStatus !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "Be the first to submit a groundbreaking research paper!"}
              </p>
              {(searchTerm || filterStatus !== "all") && (
                <Button
                  onClick={() => {
                    setSearchTerm("")
                    setFilterStatus("all")
                  }}
                  variant="outline"
                  className="border-emerald-200 hover:bg-emerald-50"
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            {filteredAndSortedPapers.map((paper) => {
              const fundingProgress = (Number.parseInt(paper.currentFunding) / Number.parseInt(paper.fundingGoal)) * 100
              const isFullyFunded = fundingProgress >= 100
              const statusKey = Object.keys(paper.status)[0]

              return (
                <Card
                  key={paper.id}
                  id={`success-${paper.id}`}
                  className="group border border-emerald-200/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/95 backdrop-blur-sm hover:scale-[1.01] overflow-hidden relative rounded-xl"
                >
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/3 to-green-500/3 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  <CardHeader className="relative pb-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-bold text-emerald-600 leading-tight group-hover:text-emerald-700 transition-colors flex-1 mr-2">
                        {paper.title}
                      </h3>
                      {getStatusBadge(paper.status)}
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">{paper.abstractText}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-2">
                      <span>By {paper.authors.join(", ")}</span>
                    </div>
                  </CardHeader>

                  <CardContent className="relative space-y-4">
                    {/* Funding Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Funding Progress</span>
                        <span className="font-medium text-emerald-600">
                          {Math.min(100, fundingProgress).toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={Math.min(100, fundingProgress)} className="h-2 bg-emerald-100" />
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>
                          {formatAmount(paper.currentFunding)} / {formatAmount(paper.fundingGoal)} BIOX
                        </span>
                        {isFullyFunded && (
                          <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0 text-xs">
                            🎉 Fully Funded!
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Dialog
                        open={previewStates[paper.id]?.isOpen || false}
                        onOpenChange={(open: boolean) => {
                          if (!open) {
                            closePreview(paper.id)
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            onClick={() => handlePreviewPaper(paper.id, paper.ipfsHash)}
                            variant="outline"
                            size="sm"
                            className="flex-1 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-200"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Paper
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-3 text-xl">
                              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-500 rounded-lg flex items-center justify-center">
                                <FileText className="h-4 w-4 text-white" />
                              </div>
                              <span className="bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                                {paper.title}
                              </span>
                            </DialogTitle>
                            <DialogDescription className="text-slate-600">
                              Paper #{paper.id} by {paper.authors.join(", ")}
                            </DialogDescription>
                          </DialogHeader>
                          {previewStates[paper.id] && renderPreviewContent(paper.id, previewStates[paper.id])}
                          <div className="flex justify-between items-center pt-6 border-t border-emerald-100">
                            <Badge
                              variant="outline"
                              className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700"
                            >
                              IPFS: {paper.ipfsHash.substring(0, 12)}...
                            </Badge>
                            <div className="flex gap-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`https://ipfs.io/ipfs/${paper.ipfsHash}`, "_blank")}
                                className="border-emerald-200 hover:bg-emerald-50"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open in New Tab
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const link = document.createElement("a")
                                  link.href = `https://ipfs.io/ipfs/${paper.ipfsHash}`
                                  link.download = `${paper.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`
                                  link.click()
                                }}
                                className="border-emerald-200 hover:bg-emerald-50"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Funding Section - Only show for published papers */}
                    {statusKey === 'published' && !isFullyFunded && (
                      <div className="space-y-3 pt-3 border-t border-emerald-100">
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="BIOX amount"
                            step="0.01"
                            min="0"
                            value={fundingStates[paper.id]?.amount || ""}
                            onChange={(e) =>
                              setFundingStates((prev) => ({
                                ...prev,
                                [paper.id]: { ...prev[paper.id], amount: e.target.value },
                              }))
                            }
                            disabled={fundingStates[paper.id]?.isLoading}
                            className="flex-1 border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400/20 text-sm"
                          />
                          <Button
                            onClick={() => handleFundPaper(paper.id)}
                            disabled={
                              fundingStates[paper.id]?.isLoading || 
                              !fundingStates[paper.id]?.amount ||
                              Number.parseFloat(fundingStates[paper.id]?.amount || "0") <= 0
                            }
                            size="sm"
                            className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white border-0 px-6"
                          >
                            {fundingStates[paper.id]?.isLoading ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <Coins className="h-4 w-4 mr-2" />
                                Fund
                              </>
                            )}
                          </Button>
                        </div>
                        
                        {/* Balance warning */}
                        {fundingStates[paper.id]?.amount && 
                         Number.parseFloat(fundingStates[paper.id].amount) > userTokenBalance && (
                          <p className="text-xs text-red-600">
                            Insufficient balance. You need {Number.parseFloat(fundingStates[paper.id].amount).toFixed(2)} BIOX but have {userTokenBalance.toFixed(2)} BIOX.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Voting Section - Only show for published papers */}
                    {statusKey === 'published' && !votingInfo[paper.id]?.hasVoted && (
                      <div className="flex gap-2 pt-3 border-t border-emerald-100">
                        <Button
                          onClick={() => handleVotePaper(paper.id, true)}
                          disabled={votingStates[paper.id]?.isLoading}
                          variant="outline"
                          size="sm"
                          className="flex-1 border-emerald-200 hover:bg-emerald-50 text-xs"
                        >
                          {votingStates[paper.id]?.isLoading ? (
                            <div className="w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              Upvote
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleVotePaper(paper.id, false)}
                          disabled={votingStates[paper.id]?.isLoading}
                          variant="outline"
                          size="sm"
                          className="flex-1 border-slate-200 hover:bg-slate-50 text-xs"
                        >
                          {votingStates[paper.id]?.isLoading ? (
                            <div className="w-3 h-3 border border-slate-400/30 border-t-slate-400 rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <ThumbsDown className="h-3 w-3 mr-1" />
                              Downvote
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Show voting status if user has voted */}
                    {votingInfo[paper.id]?.hasVoted && (
                      <div className="pt-3 border-t border-emerald-100">
                        <Badge 
                          variant="outline" 
                          className={`${
                            votingInfo[paper.id]?.voteType === 'upvote' 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          } text-xs`}
                        >
                          {votingInfo[paper.id]?.voteType === 'upvote' ? (
                            <>
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              You upvoted this paper
                            </>
                          ) : (
                            <>
                              <ThumbsDown className="h-3 w-3 mr-1" />
                              You downvoted this paper
                            </>
                          )}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
