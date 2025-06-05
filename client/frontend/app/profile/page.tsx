"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { PublicKey } from "@solana/web3.js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Navigation } from "@/components/navigation"
import {
  initializeProgram,
  getAllPapers,
  getConnectionInfo,
  publishPaperWorkflow,
  isWalletConnected,
} from "@/lib/solana"
import { uploadProfilePhotoToPinata } from "@/lib/ipfs"
import {
  User,
  FileText,
  Calendar,
  Coins,
  TrendingUp,
  Globe,
  BookOpen,
  Edit,
  Eye,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  Star,
  Wallet,  AlertCircle,
  RefreshCw,
  Loader2,
  Camera,
  Upload,
  X,
} from "lucide-react"
import { useUser } from "@/components/user-context"

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

interface PublishingState {
  isLoading: boolean
}

interface UserStats {
  totalPapers: number
  draftPapers: number
  publishedPapers: number
  fullyFundedPapers: number
  totalFundingReceived: number
  totalFundingGoal: number
}

export default function ProfilePage() {
  const { connected, wallet, publicKey } = useWallet()
  const { isSignedUp } = useUser()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [userPapers, setUserPapers] = useState<Paper[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [publishingStates, setPublishingStates] = useState<Record<string, PublishingState>>({})
  const [activeTab, setActiveTab] = useState("overview")
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [userStats, setUserStats] = useState<UserStats>({
    totalPapers: 0,
    draftPapers: 0,
    publishedPapers: 0,
    fullyFundedPapers: 0,
    totalFundingReceived: 0,
    totalFundingGoal: 0,
  })

  const loadUserPapers = useCallback(async () => {
    if (!connected || !publicKey || !wallet) {
      return
    }

    try {
      setIsLoading(true)
      setError("")

      console.log("Loading papers for user:", publicKey.toString())
      console.log("Connection Info:", getConnectionInfo())

      const program = initializeProgram(wallet)
      const result = await getAllPapers(program)

      if (result.success && result.data) {
        if (Array.isArray(result.data)) {
          // Filter papers where the current user is the author
          const userSpecificPapers = result.data.filter((paper): paper is Paper => {
            if (!paper) return false
            return paper.author === publicKey.toString()
          })

          setUserPapers(userSpecificPapers)
          calculateStats(userSpecificPapers)
          console.log(`Loaded ${userSpecificPapers.length} papers for user`)
        } else {
          setUserPapers([])
          calculateStats([])
          console.log("No papers found for user")
        }
      } else {
        setError((result as unknown as { error: string }).error || "Failed to load papers")
      }
    } catch (err) {
      console.error("Error loading user papers:", err)
      setError(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [wallet, connected, publicKey])

  const calculateStats = (papers: Paper[]) => {
    const stats: UserStats = {
      totalPapers: papers.length,
      draftPapers: 0,
      publishedPapers: 0,
      fullyFundedPapers: 0,
      totalFundingReceived: 0,
      totalFundingGoal: 0,
    }

    papers.forEach((paper) => {
      const statusKey = Object.keys(paper.status)[0]
      const currentFunding = parseInt(paper.currentFunding) / 1_000_000 // Convert from smallest units
      const fundingGoal = parseInt(paper.fundingGoal) / 1_000_000

      stats.totalFundingReceived += currentFunding
      stats.totalFundingGoal += fundingGoal

      switch (statusKey) {
        case "draft":
          stats.draftPapers++
          break
        case "published":
          stats.publishedPapers++
          break
        case "fullyFunded":
          stats.fullyFundedPapers++
          break
      }
    })

    setUserStats(stats)
  }

  const handlePublishPaper = async (paperId: string) => {
    if (!connected || !wallet) {
      setError("Please connect your wallet to publish papers")
      return
    }

    try {
      setPublishingStates((prev) => ({
        ...prev,
        [paperId]: { isLoading: true },
      }))

      console.log(`Publishing paper ${paperId}`)

      const result = await publishPaperWorkflow(wallet, parseInt(paperId))

      if (result.success) {
        console.log("Publishing successful:", (result as any).txHash)
        // Reload papers to update the list
        await loadUserPapers()
        setError("")
      } else {
        setError(`Publishing failed: ${(result as any).error}`)
      }
    } catch (err) {
      console.error("Error publishing paper:", err)
      setError(err instanceof Error ? err.message : "Unknown error occurred while publishing paper")
    } finally {      setPublishingStates((prev) => ({
        ...prev,
        [paperId]: { isLoading: false },
      }))
    }
  }

  // Load profile photo from localStorage
  const loadProfilePhoto = useCallback(() => {
    if (publicKey) {
      const savedPhoto = localStorage.getItem(`profilePhoto_${publicKey.toString()}`)
      if (savedPhoto) {
        setProfilePhoto(savedPhoto)
      }
    }
  }, [publicKey])

  // Save profile photo to localStorage
  const saveProfilePhoto = (ipfsHash: string) => {
    if (publicKey) {
      localStorage.setItem(`profilePhoto_${publicKey.toString()}`, ipfsHash)
      setProfilePhoto(ipfsHash)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handlePhotoUpload(file)
    }
  }

  const handlePhotoUpload = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("Please select a valid image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size should be less than 5MB")
      return
    }

    try {
      setIsUploadingPhoto(true)
      setError("")

      console.log("Uploading profile photo:", file.name)
      const ipfsHash = await uploadProfilePhotoToPinata(file)
      
      console.log("Photo uploaded successfully:", ipfsHash)
      saveProfilePhoto(ipfsHash)
    } catch (err) {
      console.error("Error uploading photo:", err)
      setError(err instanceof Error ? err.message : "Failed to upload photo")
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemovePhoto = () => {
    if (publicKey) {
      localStorage.removeItem(`profilePhoto_${publicKey.toString()}`)
      setProfilePhoto(null)
    }
  }

  const getStatusBadge = (status: Record<string, unknown>) => {
    const statusKey = Object.keys(status)[0]
    switch (statusKey) {
      case "draft":
        return (
          <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-700">
            <Edit className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        )
      case "published":
        return (
          <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
            <Globe className="h-3 w-3 mr-1" />
            Published
          </Badge>
        )
      case "fullyFunded":
        return (
          <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Fully Funded
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
            <Star className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Unknown
          </Badge>
        )
    }
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000)
    return date.toLocaleDateString()
  }
  // Load papers when wallet connects
  useEffect(() => {
    if (connected && publicKey && wallet && isSignedUp) {
      loadUserPapers()
      loadProfilePhoto()
    }
  }, [connected, publicKey, wallet, isSignedUp, loadUserPapers, loadProfilePhoto])

  // If user is not signed in, show sign-in prompt
  if (!connected || !isSignedUp) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-green-100/20">
        <Navigation />
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="border-emerald-200 shadow-lg">
              <CardHeader className="pb-8">
                <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <User className="h-8 w-8 text-emerald-600" />
                </div>
                <CardTitle className="text-2xl text-slate-800">Profile Access</CardTitle>
                <CardDescription className="text-base text-slate-600">
                  Please connect your Solana wallet and sign up to view your profile and research papers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!connected && (
                    <p className="text-sm text-slate-500">
                      Step 1: Connect your wallet using the button in the top right
                    </p>
                  )}
                  {connected && !isSignedUp && (
                    <p className="text-sm text-slate-500">
                      Step 2: Complete the sign-up process on the home page
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-green-100/20">
      <Navigation />

      {/* Header Section */}
      <div className="relative overflow-hidden border-b border-emerald-100">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-green-500/10"></div>
        <div className="container mx-auto px-6 py-12 relative">
          <div className="max-w-4xl mx-auto">            <div className="flex items-start gap-6">
              {/* Profile Photo Section */}
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg border-2 border-emerald-200">
                  {profilePhoto ? (
                    <img 
                      src={`https://ipfs.io/ipfs/${profilePhoto}`}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                      <User className="h-10 w-10 text-white" />
                    </div>
                  )}
                </div>
                
                {/* Photo Upload Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-2xl flex items-center justify-center">
                  {isUploadingPhoto ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-white hover:text-white hover:bg-white/20"
                        onClick={handlePhotoClick}
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                      {profilePhoto && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-white hover:text-white hover:bg-white/20"
                          onClick={handleRemovePhoto}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Your Research Profile</h1>
                <p className="text-slate-600 mb-4">
                  Manage your research papers and track your contributions to the scientific community
                </p>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    <span className="font-mono">
                      {publicKey?.toString().slice(0, 8)}...{publicKey?.toString().slice(-8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Member since signup</span>
                  </div>
                </div>
              </div>
              <Button
                onClick={loadUserPapers}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="border-emerald-200 hover:bg-emerald-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="border-emerald-200">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600 mb-1">{userStats.totalPapers}</div>
                <div className="text-sm text-slate-600">Total Papers</div>
              </CardContent>
            </Card>
            <Card className="border-blue-200">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">{userStats.publishedPapers}</div>
                <div className="text-sm text-slate-600">Published</div>
              </CardContent>
            </Card>
            <Card className="border-yellow-200">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600 mb-1">{userStats.draftPapers}</div>
                <div className="text-sm text-slate-600">Drafts</div>
              </CardContent>
            </Card>
            <Card className="border-green-200">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {userStats.totalFundingReceived.toFixed(2)}
                </div>
                <div className="text-sm text-slate-600">Tokens Received</div>
              </CardContent>
            </Card>
          </div>

          {/* Error Display */}
          {error && (
            <Card className="border-red-200 bg-red-50 mb-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Error:</span>
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="drafts">Drafts ({userStats.draftPapers})</TabsTrigger>
              <TabsTrigger value="published">Published ({userStats.publishedPapers})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Funding Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    Funding Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Total Funding Received</span>
                      <span className="font-semibold text-emerald-600">
                        {userStats.totalFundingReceived.toFixed(2)} BIOX
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Total Funding Goal</span>
                      <span className="font-semibold text-slate-700">
                        {userStats.totalFundingGoal.toFixed(2)} BIOX
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Overall Progress</span>
                        <span>
                          {userStats.totalFundingGoal > 0
                            ? ((userStats.totalFundingReceived / userStats.totalFundingGoal) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                      <Progress
                        value={
                          userStats.totalFundingGoal > 0
                            ? (userStats.totalFundingReceived / userStats.totalFundingGoal) * 100
                            : 0
                        }
                        className="h-3"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Papers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-600" />
                    Recent Papers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : userPapers.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No research papers yet</p>
                      <p className="text-sm">Submit your first paper to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userPapers.slice(0, 5).map((paper) => (
                        <div key={paper.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-800 mb-1">{paper.title}</h4>
                            <div className="flex items-center gap-3 text-sm text-slate-500">
                              {getStatusBadge(paper.status)}
                              <span>Paper #{paper.id}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-slate-700">
                              {(parseInt(paper.currentFunding) / 1_000_000).toFixed(2)} /{" "}
                              {(parseInt(paper.fundingGoal) / 1_000_000).toFixed(2)} BIOX
                            </div>
                            <div className="text-xs text-slate-500">
                              {((parseInt(paper.currentFunding) / parseInt(paper.fundingGoal)) * 100).toFixed(1)}%
                              funded
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="drafts">
              <div className="space-y-4">
                {isLoading ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    {[...Array(4)].map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="p-6">
                          <div className="h-6 bg-slate-200 rounded w-3/4 mb-3"></div>
                          <div className="space-y-2 mb-4">
                            <div className="h-3 bg-slate-200 rounded"></div>
                            <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                          </div>
                          <div className="h-8 bg-slate-200 rounded w-24"></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <>
                    {userPapers.filter((paper) => Object.keys(paper.status)[0] === "draft").length === 0 ? (
                      <Card>
                        <CardContent className="p-12 text-center">
                          <Edit className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Draft Papers</h3>
                          <p className="text-slate-500 mb-6">
                            You don't have any draft papers yet. Create your first research paper to get started.
                          </p>
                          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            Submit New Paper
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid gap-6 md:grid-cols-2">
                        {userPapers
                          .filter((paper) => Object.keys(paper.status)[0] === "draft")
                          .map((paper) => (
                            <Card key={paper.id} className="border-yellow-200">
                              <CardHeader>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <CardTitle className="text-lg mb-2">{paper.title}</CardTitle>
                                    <CardDescription className="line-clamp-2">
                                      {paper.abstractText}
                                    </CardDescription>
                                  </div>
                                  {getStatusBadge(paper.status)}
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">Funding Goal:</span>
                                    <span className="font-medium">
                                      {(parseInt(paper.fundingGoal) / 1_000_000).toFixed(2)} BIOX
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">Authors:</span>
                                    <span className="font-medium">{paper.authors.length}</span>
                                  </div>
                                  <div className="pt-3 border-t">
                                    <Button
                                      onClick={() => handlePublishPaper(paper.id)}
                                      disabled={publishingStates[paper.id]?.isLoading}
                                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                      size="sm"
                                    >
                                      {publishingStates[paper.id]?.isLoading ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Publishing...
                                        </>
                                      ) : (
                                        <>
                                          <Globe className="h-4 w-4 mr-2" />
                                          Publish Paper
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="published">
              <div className="space-y-4">
                {isLoading ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    {[...Array(4)].map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="p-6">
                          <div className="h-6 bg-slate-200 rounded w-3/4 mb-3"></div>
                          <div className="space-y-2 mb-4">
                            <div className="h-3 bg-slate-200 rounded"></div>
                            <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                          </div>
                          <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
                          <div className="h-8 bg-slate-200 rounded w-32"></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <>
                    {userPapers.filter((paper) => {
                      const statusKey = Object.keys(paper.status)[0]
                      return statusKey === "published" || statusKey === "fullyFunded" || statusKey === "completed"
                    }).length === 0 ? (
                      <Card>
                        <CardContent className="p-12 text-center">
                          <Globe className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Published Papers</h3>
                          <p className="text-slate-500 mb-6">
                            You haven't published any papers yet. Publish your draft papers to make them visible to the
                            community.
                          </p>
                          {userStats.draftPapers > 0 && (
                            <Button
                              onClick={() => setActiveTab("drafts")}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              View Drafts
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid gap-6 md:grid-cols-2">
                        {userPapers
                          .filter((paper) => {
                            const statusKey = Object.keys(paper.status)[0]
                            return (
                              statusKey === "published" || statusKey === "fullyFunded" || statusKey === "completed"
                            )
                          })
                          .map((paper) => {
                            const fundingProgress =
                              (parseInt(paper.currentFunding) / parseInt(paper.fundingGoal)) * 100
                            const statusKey = Object.keys(paper.status)[0]

                            return (
                              <Card key={paper.id} className="border-blue-200">
                                <CardHeader>
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <CardTitle className="text-lg mb-2">{paper.title}</CardTitle>
                                      <CardDescription className="line-clamp-2">
                                        {paper.abstractText}
                                      </CardDescription>
                                    </div>
                                    {getStatusBadge(paper.status)}
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Funding Progress</span>
                                        <span className="font-medium">{fundingProgress.toFixed(1)}%</span>
                                      </div>
                                      <Progress value={fundingProgress} className="h-2" />
                                      <div className="flex justify-between text-xs text-slate-500">
                                        <span>{(parseInt(paper.currentFunding) / 1_000_000).toFixed(2)} BIOX</span>
                                        <span>{(parseInt(paper.fundingGoal) / 1_000_000).toFixed(2)} BIOX</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-slate-600">Authors:</span>
                                      <span className="font-medium">{paper.authors.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-slate-600">Paper ID:</span>
                                      <span className="font-mono text-xs">#{paper.id}</span>
                                    </div>
                                    <div className="pt-3 border-t">
                                      <Button
                                        onClick={() => {
                                          window.open(`https://ipfs.io/ipfs/${paper.ipfsHash}`, "_blank")
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-emerald-200 hover:bg-emerald-50"
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        View Paper
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
