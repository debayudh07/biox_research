"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Navigation } from "@/components/navigation"
import { uploadToPinata } from "@/lib/ipfs"
import {
  submitPaperWorkflow,
  isWalletConnected,
  getAllPapers,
  initializeProgram,
  publishPaperWorkflow,
} from "@/lib/solana"
import {
  FileUp,
  Plus,
  Trash2,
  Sparkles,
  FileText,
  Users,
  Coins,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit3,
  Upload,
  RefreshCw,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface FormData {
  title: string
  abstract: string
  authors: string[]
  fundingGoal: string
  fundingPeriodDays: string
  paperFile: File | null
}

interface Paper {
  id: string
  title: string
  abstractText: string
  authors: string[]
  status: any
  pda: string
}

interface PublishingState {
  isLoading: boolean
}

export default function PublishPaperPage() {
  const { connected, wallet } = useWallet()
  const [formData, setFormData] = useState<FormData>({
    title: "",
    abstract: "",
    authors: [""],
    fundingGoal: "",
    fundingPeriodDays: "30",
    paperFile: null,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitProgress, setSubmitProgress] = useState(0)
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null
    message: string
    txHash?: string
    paperId?: string
  }>({ type: null, message: "" })

  // New state for managing draft papers
  const [draftPapers, setDraftPapers] = useState<Paper[]>([])
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false)
  const [publishingStates, setPublishingStates] = useState<Record<string, PublishingState>>({})
  const [activeTab, setActiveTab] = useState("submit")
  const [fileName, setFileName] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Load draft papers when wallet connects
  useEffect(() => {
    if (connected && wallet) {
      loadDraftPapers()
    }
  }, [connected, wallet])

  // Simulate progress during submission
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isSubmitting) {
      setSubmitProgress(0)
      interval = setInterval(() => {
        setSubmitProgress((prev) => {
          if (prev >= 95) {
            clearInterval(interval)
            return prev
          }
          return prev + 5
        })
      }, 300)
    } else {
      setSubmitProgress(0)
    }

    return () => clearInterval(interval)
  }, [isSubmitting])

  const loadDraftPapers = async () => {
    if (!wallet) return

    try {
      setIsLoadingDrafts(true)
      const program = initializeProgram(wallet)
      const result = await getAllPapers(program)

      if (result.success && result.data) {
        // Filter only draft papers by the current user
        const userDraftPapers = result.data
          .filter((paper: any) => {
            if (!paper) return false
            const statusKey = Object.keys(paper.status)[0]
            const walletPubkey = wallet.adapter?.publicKey?.toString() || ""
            return statusKey === "draft" && (paper.authors.includes(walletPubkey) || paper.author === walletPubkey)
          })
          .map((paper: any) => ({
            id: paper.id,
            title: paper.title,
            abstractText: paper.abstractText,
            authors: paper.authors,
            status: paper.status,
            pda: paper.pda,
          }))
        setDraftPapers(userDraftPapers)
      }
    } catch (error) {
      console.error("Error loading draft papers:", error)
    } finally {
      setIsLoadingDrafts(false)
    }
  }

  const handlePublishDraftPaper = async (paperId: string) => {
    if (!connected || !wallet) {
      setSubmitStatus({
        type: "error",
        message: "Please connect your wallet to publish papers",
      })
      return
    }

    try {
      setPublishingStates((prev) => ({
        ...prev,
        [paperId]: { isLoading: true },
      }))

      console.log(`Publishing paper ${paperId}`)

      const result = await publishPaperWorkflow(wallet, Number.parseInt(paperId))

      if (result.success) {
        console.log("Publishing successful:", (result as any).txHash)
        // Reload draft papers to update the list
        await loadDraftPapers()
        setSubmitStatus({
          type: "success",
          message: "Paper published successfully!",
          txHash: (result as any).txHash,
        })
      } else {
        setSubmitStatus({
          type: "error",
          message: `Publishing failed: ${(result as any).error}`,
        })
      }
    } catch (err) {
      console.error("Error publishing paper:", err)
      setSubmitStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Unknown error occurred while publishing",
      })
    } finally {
      setPublishingStates((prev) => ({
        ...prev,
        [paperId]: { isLoading: false },
      }))
    }
  }

  const getStatusBadge = (status: any) => {
    const statusKey = Object.keys(status)[0]
    const statusConfig = {
      draft: {
        color: "bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 border-slate-300",
        icon: <FileText className="h-3 w-3 mr-1" />,
      },
      published: {
        color: "bg-gradient-to-r from-emerald-100 to-green-200 text-emerald-800 border-emerald-300",
        icon: <Sparkles className="h-3 w-3 mr-1" />,
      },
      fullyFunded: {
        color: "bg-gradient-to-r from-green-100 to-emerald-200 text-green-800 border-green-300",
        icon: <Coins className="h-3 w-3 mr-1" />,
      },
      completed: {
        color: "bg-gradient-to-r from-purple-100 to-violet-200 text-purple-800 border-purple-300",
        icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
      },
      rejected: {
        color: "bg-gradient-to-r from-red-100 to-rose-200 text-red-800 border-red-300",
        icon: <XCircle className="h-3 w-3 mr-1" />,
      },
    }

    const config = statusConfig[statusKey as keyof typeof statusConfig] || statusConfig.draft

    return (
      <Badge className={`${config.color} border shadow-sm font-medium px-3 py-1 text-xs flex items-center`}>
        {config.icon}
        {statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
      </Badge>
    )
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field if it exists
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleAuthorChange = (index: number, value: string) => {
    const newAuthors = [...formData.authors]
    newAuthors[index] = value
    setFormData((prev) => ({ ...prev, authors: newAuthors }))
    // Clear author errors
    if (formErrors[`author-${index}`]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[`author-${index}`]
        return newErrors
      })
    }
  }

  const addAuthor = () => {
    setFormData((prev) => ({ ...prev, authors: [...prev.authors, ""] }))
  }

  const removeAuthor = (index: number) => {
    if (formData.authors.length > 1) {
      const newAuthors = formData.authors.filter((_, i) => i !== index)
      setFormData((prev) => ({ ...prev, authors: newAuthors }))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file) {
      setFileName(file.name)
      setFormData((prev) => ({ ...prev, paperFile: file }))
      // Clear file error
      if (formErrors.paperFile) {
        setFormErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors.paperFile
          return newErrors
        })
      }
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.title.trim()) {
      errors.title = "Title is required"
    }

    if (!formData.abstract.trim()) {
      errors.abstract = "Abstract is required"
    }

    if (!formData.paperFile) {
      errors.paperFile = "Please upload a paper file"
    }

    if (!formData.fundingGoal.trim()) {
      errors.fundingGoal = "Funding goal is required"
    } else if (isNaN(Number(formData.fundingGoal)) || Number(formData.fundingGoal) <= 0) {
      errors.fundingGoal = "Funding goal must be a positive number"
    }

    if (!formData.fundingPeriodDays.trim()) {
      errors.fundingPeriodDays = "Funding period is required"
    } else if (isNaN(Number(formData.fundingPeriodDays)) || Number(formData.fundingPeriodDays) <= 0) {
      errors.fundingPeriodDays = "Funding period must be a positive number"
    }

    formData.authors.forEach((author, index) => {
      if (!author.trim()) {
        errors[`author-${index}`] = "Author name is required"
      }
    })

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!connected || !wallet || !isWalletConnected(wallet)) {
      setSubmitStatus({
        type: "error",
        message: "Please connect your wallet first",
      })
      return
    }

    if (!validateForm()) {
      setSubmitStatus({
        type: "error",
        message: "Please fix the errors in the form",
      })
      return
    }

    setIsSubmitting(true)
    setSubmitStatus({ type: null, message: "" })

    try {
      // Step 1: Upload paper to IPFS
      setSubmitStatus({
        type: null,
        message: "Uploading paper to IPFS...",
      })

      const ipfsHash = await uploadToPinata(formData.paperFile!)
      // Step 2: Submit to Solana contract
      setSubmitStatus({
        type: null,
        message: "Submitting to blockchain...",
      })

      // Convert funding goal to smallest token units (assuming 6 decimals like USDC)
      const fundingGoalInSmallestUnits = Math.floor(Number(formData.fundingGoal) * 1_000_000)

      const result = await submitPaperWorkflow(wallet, {
        title: formData.title,
        abstractText: formData.abstract,
        ipfsHash,
        authors: formData.authors.filter((author) => author.trim()),
        fundingGoal: fundingGoalInSmallestUnits,
        fundingPeriodDays: Number(formData.fundingPeriodDays),
      })
      if (result.success) {
        setSubmitStatus({
          type: "success",
          message: "Paper submitted successfully!",
          txHash: (result as any).txHash,
          paperId: (result as any).paperId,
        })

        // Reset form
        setFormData({
          title: "",
          abstract: "",
          authors: [""],
          fundingGoal: "",
          fundingPeriodDays: "30",
          paperFile: null,
        })
        setFileName(null)

        // Reset file input
        const fileInput = document.getElementById("paper-file") as HTMLInputElement
        if (fileInput) fileInput.value = ""

        // Reload drafts
        await loadDraftPapers()
      } else {
        setSubmitStatus({
          type: "error",
          message: result.error || "Failed to submit paper",
        })
      }
    } catch (error) {
      console.error("Submission error:", error)
      setSubmitStatus({
        type: "error",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
      })
    } finally {
      setIsSubmitting(false)
      setSubmitProgress(100)
    }
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-green-100/20">
        <Navigation />
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-md mx-auto">
            <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="text-center pb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <FileUp className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  Connect Your Wallet
                </CardTitle>
                <CardDescription className="text-slate-600 text-base mt-2">
                  Connect your Solana wallet to publish your research paper and get funding from the community.
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
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 bg-clip-text text-transparent">
            Publish Your Research
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Share your groundbreaking research with the scientific community and secure funding for your work
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto mb-8">
            <TabsTrigger
              value="submit"
              className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-800"
            >
              <FileUp className="h-4 w-4 mr-2" />
              Submit New Paper
            </TabsTrigger>
            <TabsTrigger
              value="drafts"
              className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-800"
            >
              <FileText className="h-4 w-4 mr-2" />
              Your Drafts ({draftPapers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="mt-0">
            <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-slate-800">Submit Research Paper</CardTitle>
                <CardDescription className="text-slate-600">
                  Fill out the form below to submit your research paper for peer review and funding
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-slate-700 font-medium flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-emerald-600" />
                      Paper Title
                    </Label>
                    <Input
                      id="title"
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      placeholder="Enter your research paper title"
                      className={`border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400/20 ${
                        formErrors.title ? "border-red-300" : ""
                      }`}
                    />
                    {formErrors.title && <p className="text-red-500 text-sm">{formErrors.title}</p>}
                  </div>

                  {/* Abstract */}
                  <div className="space-y-2">
                    <Label htmlFor="abstract" className="text-slate-700 font-medium flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-emerald-600" />
                      Abstract
                    </Label>
                    <Textarea
                      id="abstract"
                      value={formData.abstract}
                      onChange={(e) => handleInputChange("abstract", e.target.value)}
                      placeholder="Provide a comprehensive abstract of your research..."
                      rows={6}
                      className={`border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400/20 ${
                        formErrors.abstract ? "border-red-300" : ""
                      }`}
                    />
                    {formErrors.abstract && <p className="text-red-500 text-sm">{formErrors.abstract}</p>}
                  </div>

                  {/* Authors */}
                  <div className="space-y-3">
                    <Label className="text-slate-700 font-medium flex items-center">
                      <Users className="h-4 w-4 mr-2 text-emerald-600" />
                      Authors
                    </Label>
                    <div className="space-y-3">
                      {formData.authors.map((author, index) => (
                        <div key={index} className="flex gap-2 items-center group">
                          <div className="flex-1">
                            <Input
                              type="text"
                              value={author}
                              onChange={(e) => handleAuthorChange(index, e.target.value)}
                              placeholder={`Author ${index + 1} name or wallet address`}
                              className={`border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400/20 ${
                                formErrors[`author-${index}`] ? "border-red-300" : ""
                              }`}
                            />
                            {formErrors[`author-${index}`] && (
                              <p className="text-red-500 text-sm mt-1">{formErrors[`author-${index}`]}</p>
                            )}
                          </div>
                          {formData.authors.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => removeAuthor(index)}
                              className="border-emerald-200 hover:bg-red-50 hover:border-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAuthor}
                      className="border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Author
                    </Button>
                  </div>

                  {/* Paper File Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="paper-file" className="text-slate-700 font-medium flex items-center">
                      <Upload className="h-4 w-4 mr-2 text-emerald-600" />
                      Research Paper File
                    </Label>
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-emerald-50/50 transition-colors ${
                        formErrors.paperFile ? "border-red-300 bg-red-50/30" : "border-emerald-200"
                      }`}
                      onClick={() => document.getElementById("paper-file")?.click()}
                    >
                      <input
                        id="paper-file"
                        type="file"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                      />
                      <div className="flex flex-col items-center justify-center space-y-2">
                        {fileName ? (
                          <>
                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                              <FileText className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-emerald-700">{fileName}</p>
                              <p className="text-xs text-slate-500 mt-1">Click to change file</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                              <Upload className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700">
                                Drag and drop or click to upload your paper
                              </p>
                              <p className="text-xs text-slate-500 mt-1">PDF, DOC, or DOCX (Max 10MB)</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {formErrors.paperFile && <p className="text-red-500 text-sm">{formErrors.paperFile}</p>}
                  </div>

                  {/* Funding Goal */}
                  <div className="space-y-2">
                    <Label htmlFor="funding-goal" className="text-slate-700 font-medium flex items-center">
                      <Coins className="h-4 w-4 mr-2 text-emerald-600" />
                      Funding Goal (Tokens)
                    </Label>
                    <Input
                      id="funding-goal"
                      type="number"
                      step="0.000001"
                      min="0"
                      value={formData.fundingGoal}
                      onChange={(e) => handleInputChange("fundingGoal", e.target.value)}
                      placeholder="Enter funding goal in tokens"
                      className={`border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400/20 ${
                        formErrors.fundingGoal ? "border-red-300" : ""
                      }`}
                    />
                    {formErrors.fundingGoal ? (
                      <p className="text-red-500 text-sm">{formErrors.fundingGoal}</p>
                    ) : (
                      <p className="text-sm text-slate-500">Amount of tokens needed to fund this research</p>
                    )}
                  </div>

                  {/* Funding Period */}
                  <div className="space-y-2">
                    <Label htmlFor="funding-period" className="text-slate-700 font-medium flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-emerald-600" />
                      Funding Period (Days)
                    </Label>
                    <Input
                      id="funding-period"
                      type="number"
                      min="1"
                      max="365"
                      value={formData.fundingPeriodDays}
                      onChange={(e) => handleInputChange("fundingPeriodDays", e.target.value)}
                      placeholder="Number of days for funding"
                      className={`border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400/20 ${
                        formErrors.fundingPeriodDays ? "border-red-300" : ""
                      }`}
                    />
                    {formErrors.fundingPeriodDays ? (
                      <p className="text-red-500 text-sm">{formErrors.fundingPeriodDays}</p>
                    ) : (
                      <p className="text-sm text-slate-500">How long should the funding period last? (1-365 days)</p>
                    )}
                  </div>

                  {/* Status Messages */}
                  {submitStatus.type && (
                    <Alert
                      className={`${
                        submitStatus.type === "success"
                          ? "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200"
                          : "bg-gradient-to-r from-red-50 to-rose-50 border-red-200"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          submitStatus.type === "success" ? "bg-emerald-100" : "bg-red-100"
                        }`}
                      >
                        {submitStatus.type === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <AlertTitle
                        className={`${
                          submitStatus.type === "success" ? "text-emerald-800" : "text-red-800"
                        } font-semibold`}
                      >
                        {submitStatus.type === "success" ? "Success!" : "Error"}
                      </AlertTitle>
                      <AlertDescription
                        className={submitStatus.type === "success" ? "text-emerald-700" : "text-red-700"}
                      >
                        {submitStatus.message}
                        {submitStatus.txHash && (
                          <div className="mt-2 text-sm">
                            <span className="font-medium">Transaction Hash:</span>
                            <code className="ml-1 px-2 py-0.5 bg-white/50 rounded text-xs font-mono">
                              {submitStatus.txHash}
                            </code>
                          </div>
                        )}
                        {submitStatus.paperId && (
                          <div className="mt-1 text-sm">
                            <span className="font-medium">Paper ID:</span>{" "}
                            <span className="font-mono bg-white/50 px-2 py-0.5 rounded">{submitStatus.paperId}</span>
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {!submitStatus.type && isSubmitting && (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>{submitStatus.message || "Processing submission..."}</span>
                        <span>{submitProgress}%</span>
                      </div>
                      <Progress value={submitProgress} className="h-2 bg-emerald-100" />
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white border-0 shadow-md hover:shadow-lg transition-all duration-300"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Upload className="h-4 w-4 mr-2" />
                        Submit Paper
                      </div>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drafts" className="mt-0">
            <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-slate-800">Your Draft Papers</CardTitle>
                <CardDescription className="text-slate-600">
                  Manage your draft papers and publish them when ready
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDrafts ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-12 h-12 relative">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-500"></div>
                      <RefreshCw className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-emerald-600" />
                    </div>
                    <p className="text-slate-600 mt-4">Loading your draft papers...</p>
                  </div>
                ) : draftPapers.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Draft Papers Found</h3>
                    <p className="text-slate-500 mb-6 max-w-md mx-auto">
                      You don't have any draft papers yet. Start by submitting a new research paper.
                    </p>
                    <Button
                      onClick={() => setActiveTab("submit")}
                      className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white border-0 shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      <FileUp className="h-4 w-4 mr-2" />
                      Submit New Paper
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {draftPapers.map((paper) => (
                      <Card
                        key={paper.id}
                        className="group border border-emerald-200 hover:border-emerald-300 bg-gradient-to-br from-white to-emerald-50/30 hover:shadow-md transition-all duration-300"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
                                {paper.title}
                              </CardTitle>
                              <CardDescription className="text-sm text-slate-500 mt-1">
                                Paper #{paper.id} • {paper.authors.length} Authors
                              </CardDescription>
                            </div>
                            {getStatusBadge(paper.status)}
                          </div>
                        </CardHeader>
                        <CardContent className="pb-3">
                          <p className="text-sm text-slate-600 line-clamp-2">{paper.abstractText}</p>
                        </CardContent>
                        <CardFooter className="flex gap-3 pt-2 border-t border-emerald-100">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => handlePublishDraftPaper(paper.id)}
                                  disabled={publishingStates[paper.id]?.isLoading}
                                  className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white border-0 shadow-sm hover:shadow-md transition-all duration-300"
                                >
                                  {publishingStates[paper.id]?.isLoading ? (
                                    <div className="flex items-center">
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Publishing...
                                    </div>
                                  ) : (
                                    <div className="flex items-center">
                                      <Sparkles className="h-4 w-4 mr-2" />
                                      Publish Paper
                                    </div>
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Publish your paper to make it available for funding</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="flex-1 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-300"
                                  onClick={() => {
                                    setFormData({
                                      title: paper.title,
                                      abstract: paper.abstractText,
                                      authors: paper.authors,
                                      fundingGoal: "",
                                      fundingPeriodDays: "30",
                                      paperFile: null,
                                    })
                                    setFileName(null)
                                    setActiveTab("submit")
                                  }}
                                >
                                  <Edit3 className="h-4 w-4 mr-2" />
                                  Edit Draft
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Load this draft into the editor to make changes</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </CardFooter>
                      </Card>
                    ))}

                    <Button
                      onClick={() => loadDraftPapers()}
                      variant="outline"
                      className="w-full border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-300"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Drafts
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
