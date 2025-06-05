/*eslint-disable*/
"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
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
  Brain,
  Wand2,
  Target,
  TrendingUp,
  Lightbulb,
  Search,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GeminiAIService } from "@/lib/gemini"

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
  status: Record<string, unknown>
  pda: string
}

interface PublishingState {
  isLoading: boolean
}

// AI-related interfaces
interface AIAnalysis {
  suggestedTitle?: string
  improvedAbstract?: string
  keywords?: string[]
  researchDomain?: string
  estimatedFundingGoal?: number
  suggestedFundingPeriod?: number
  targetAudience?: string[]
  innovationScore?: number
  marketPotential?: string
  risks?: string[]
  suggestions?: string[]
}

interface FundingStrategy {
  estimatedAmount?: number
  timeline?: string
  milestones?: string[]
  riskFactors?: string[]
  strategy?: string
  riskMitigation?: string[]
  alternativeFunding?: string[]
}

interface AuthorSuggestions {
  suggestedCollaborators?: string[]
  expertiseAreas?: string[]
  institutionRecommendations?: string[]
}

interface EnhancedAbstract {
  enhancedAbstract?: string
  improvements?: string[]
  readabilityScore?: number
}

interface AIAssistant {
  isAnalyzing: boolean
  isEnhancing: boolean
  isGeneratingStrategy: boolean
  isSuggestingCollaborators: boolean
  showAnalysis: boolean
  showStrategy: boolean
  showCollaborators: boolean
  analysis: AIAnalysis | null
  strategy: FundingStrategy | null
  collaborators: AuthorSuggestions | null
  enhancedAbstract: EnhancedAbstract | null
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

  // AI state management
  const [aiAssistant, setAiAssistant] = useState<AIAssistant>({
    isAnalyzing: false,
    isEnhancing: false,
    isGeneratingStrategy: false,
    isSuggestingCollaborators: false,
    showAnalysis: false,
    showStrategy: false,
    showCollaborators: false,
    analysis: null,
    strategy: null,
    collaborators: null,
    enhancedAbstract: null,
  })
  const [autoCompleteSuggestions, setAutoCompleteSuggestions] = useState<any>(null)
  const loadDraftPapers = useCallback(async () => {
    if (!wallet) return

    try {    setIsLoadingDrafts(true)
      const program = initializeProgram(wallet)
      const result = await getAllPapers(program)
      
      if (result.success && result.data) {
        // Filter only draft papers by the current user
        const userDraftPapers = result.data
          .filter((paper) => {
            if (!paper) return false
            const statusKey = Object.keys(paper.status)[0]
            const walletPubkey = wallet.adapter?.publicKey?.toString() || ""
            return statusKey === "draft" && (paper.authors.includes(walletPubkey) || paper.author === walletPubkey)
          })
          .map((paper) => {
            if (!paper) throw new Error("Invalid paper data")
            return {
              id: paper.id as string,
              title: paper.title as string,
              abstractText: paper.abstractText as string,
              authors: paper.authors as string[],
              status: paper.status as Record<string, unknown>,
              pda: paper.pda as string,
            }
          })
        setDraftPapers(userDraftPapers)
      }
    } catch (error) {
      console.error("Error loading draft papers:", error)
    } finally {
      setIsLoadingDrafts(false)
    }
  }, [wallet])

  // Load draft papers when wallet connects
  useEffect(() => {
    if (connected && wallet) {
      loadDraftPapers()
    }
  }, [connected, wallet, loadDraftPapers])

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
    }    return () => clearInterval(interval)
  }, [isSubmitting])

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

  const getStatusBadge = (status: Record<string, unknown>) => {
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
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      // Try to analyze PDF content if it's a PDF file
      if (file.type === 'application/pdf' && file.size < 5 * 1024 * 1024) { // Less than 5MB
        try {
          const reader = new FileReader()
          reader.onload = async (event) => {
            const text = event.target?.result as string
            if (text && text.length > 100) {
              try {
                const analysis = await GeminiAIService.analyzePDFContent(text)
                
                // Auto-populate form fields if they're empty
                if (analysis.extractedTitle && !formData.title) {
                  setFormData(prev => ({ ...prev, title: analysis.extractedTitle! }))
                }
                if (analysis.extractedAbstract && !formData.abstract) {
                  setFormData(prev => ({ ...prev, abstract: analysis.extractedAbstract! }))
                }
                if (analysis.extractedAuthors && analysis.extractedAuthors.length > 0 && formData.authors.length === 1 && !formData.authors[0]) {
                  setFormData(prev => ({ ...prev, authors: analysis.extractedAuthors! }))
                }

                setSubmitStatus({
                  type: "success",
                  message: "PDF analyzed successfully! Form fields have been auto-populated.",
                })
              } catch (error) {
                console.error("PDF analysis error:", error)
              }
            }
          }
          reader.readAsText(file)
        } catch (error) {
          console.error("PDF reading error:", error)
        }
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
      })    } finally {
      setIsSubmitting(false)
      setSubmitProgress(100)
    }
  }

  // AI Functions
  const analyzePaperWithAI = async () => {
    if (!formData.title && !formData.abstract) {
      setSubmitStatus({
        type: "error",
        message: "Please provide at least a title or abstract for AI analysis",
      })
      return
    }

    setAiAssistant(prev => ({ ...prev, isAnalyzing: true }))
    
    try {
      const analysis = await GeminiAIService.analyzePaper({
        title: formData.title,
        abstract: formData.abstract,
        authors: formData.authors.filter(author => author.trim()),
        researchField: "Life Sciences"
      })

      setAiAssistant(prev => ({
        ...prev,
        analysis,
        showAnalysis: true,
        isAnalyzing: false
      }))

      // Auto-populate suggested values if fields are empty
      if (!formData.fundingGoal && analysis.estimatedFundingGoal) {
        setFormData(prev => ({
          ...prev,
          fundingGoal: analysis.estimatedFundingGoal!.toString()
        }))
      }

      if (analysis.suggestedFundingPeriod) {
        setFormData(prev => ({
          ...prev,
          fundingPeriodDays: analysis.suggestedFundingPeriod!.toString()
        }))
      }

    } catch (error) {
      console.error("AI Analysis error:", error)
      setSubmitStatus({
        type: "error",
        message: "Failed to analyze paper with AI. Please try again.",
      })
      setAiAssistant(prev => ({ ...prev, isAnalyzing: false }))
    }
  }

  const enhanceAbstractWithAI = async () => {
    if (!formData.abstract.trim()) {
      setSubmitStatus({
        type: "error",
        message: "Please provide an abstract to enhance",
      })
      return
    }

    setAiAssistant(prev => ({ ...prev, isEnhancing: true }))
    
    try {
      const enhanced = await GeminiAIService.enhanceAbstract(formData.abstract, formData.title)
      setAiAssistant(prev => ({
        ...prev,
        enhancedAbstract: enhanced,
        isEnhancing: false
      }))
    } catch (error) {
      console.error("AI Enhancement error:", error)
      setSubmitStatus({
        type: "error",
        message: "Failed to enhance abstract with AI. Please try again.",
      })
      setAiAssistant(prev => ({ ...prev, isEnhancing: false }))
    }
  }

  const generateFundingStrategy = async () => {
    if (!formData.title || !formData.abstract || !formData.fundingGoal) {
      setSubmitStatus({
        type: "error",
        message: "Please provide title, abstract, and funding goal for strategy generation",
      })
      return
    }

    setAiAssistant(prev => ({ ...prev, isGeneratingStrategy: true }))
    
    try {
      const strategy = await GeminiAIService.generateFundingStrategy({
        title: formData.title,
        abstract: formData.abstract,
        fundingGoal: Number(formData.fundingGoal),
        researchField: "Life Sciences"
      })

      setAiAssistant(prev => ({
        ...prev,
        strategy,
        showStrategy: true,
        isGeneratingStrategy: false
      }))
    } catch (error) {
      console.error("AI Strategy error:", error)
      setSubmitStatus({
        type: "error",
        message: "Failed to generate funding strategy. Please try again.",
      })
      setAiAssistant(prev => ({ ...prev, isGeneratingStrategy: false }))
    }
  }

  const suggestCollaborators = async () => {
    if (!formData.title || !formData.abstract) {
      setSubmitStatus({
        type: "error",
        message: "Please provide title and abstract for collaborator suggestions",
      })
      return
    }

    setAiAssistant(prev => ({ ...prev, isSuggestingCollaborators: true }))
    
    try {
      const collaborators = await GeminiAIService.suggestCollaborators({
        title: formData.title,
        abstract: formData.abstract,
        researchField: "Life Sciences"
      })

      setAiAssistant(prev => ({
        ...prev,
        collaborators,
        showCollaborators: true,
        isSuggestingCollaborators: false
      }))
    } catch (error) {
      console.error("AI Collaborators error:", error)
      setSubmitStatus({
        type: "error",
        message: "Failed to suggest collaborators. Please try again.",
      })
      setAiAssistant(prev => ({ ...prev, isSuggestingCollaborators: false }))
    }
  }

  const applyAISuggestion = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear any errors for this field
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }
  // Auto-completion effect
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (formData.title.length > 3 || formData.abstract.length > 10) {
        try {
          const suggestions = await GeminiAIService.autoCompleteForm({
            title: formData.title,
            abstract: formData.abstract,
            researchField: "Life Sciences"
          })
          setAutoCompleteSuggestions(suggestions)
        } catch (error) {
          console.error("Auto-complete error:", error)
        }
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [formData.title, formData.abstract])

  // Keyboard shortcuts for AI features
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'a':
            if (!aiAssistant.isAnalyzing && (formData.title || formData.abstract)) {
              event.preventDefault()
              analyzePaperWithAI()
            }
            break
          case 'e':
            if (!aiAssistant.isEnhancing && formData.abstract.trim()) {
              event.preventDefault()
              enhanceAbstractWithAI()
            }
            break
          case 's':
            if (!aiAssistant.isGeneratingStrategy && formData.title && formData.abstract && formData.fundingGoal) {
              event.preventDefault()
              generateFundingStrategy()
            }
            break
          case 'c':
            if (!aiAssistant.isSuggestingCollaborators && formData.title && formData.abstract) {
              event.preventDefault()
              suggestCollaborators()
            }
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [formData, aiAssistant])

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
      <div className="container mx-auto px-4 py-12 max-w-5xl">        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 bg-clip-text text-transparent">
            Publish Your Research
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-4">
            Share your groundbreaking research with the scientific community and secure funding for your work
          </p>
          <div className="flex items-center justify-center space-x-6 text-sm text-slate-500">
            <div className="flex items-center">
              <Brain className="h-4 w-4 mr-1 text-purple-500" />
              <span>AI-Powered Analysis</span>
            </div>
            <div className="flex items-center">
              <Zap className="h-4 w-4 mr-1 text-blue-500" />
              <span>Smart Auto-Complete</span>
            </div>
            <div className="flex items-center">
              <Target className="h-4 w-4 mr-1 text-green-500" />
              <span>Funding Strategies</span>
            </div>
            <div className="flex items-center">
              <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Ctrl</kbd>
              <span className="mx-1">+</span>
              <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">A</kbd>
              <span className="ml-1">for AI Analysis</span>
            </div>
          </div>
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
            <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">              <CardHeader>
                <CardTitle className="text-2xl font-bold text-slate-800">Submit Research Paper</CardTitle>
                <CardDescription className="text-slate-600">
                  Fill out the form below to submit your research paper for peer review and funding
                </CardDescription>
              </CardHeader>
              
              {/* AI Assistant Panel */}
              <div className="px-6 pb-6">
                <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-purple-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center text-purple-800">
                      <Brain className="h-5 w-5 mr-2" />
                      AI Research Assistant
                    </CardTitle>
                    <CardDescription className="text-purple-600">
                      Let AI help you optimize your research paper submission
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={analyzePaperWithAI}
                        disabled={aiAssistant.isAnalyzing || (!formData.title && !formData.abstract)}
                        className="border-purple-200 hover:bg-purple-50 text-purple-700"
                      >
                        {aiAssistant.isAnalyzing ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Search className="h-3 w-3 mr-1" />
                        )}
                        Analyze Paper
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={enhanceAbstractWithAI}
                        disabled={aiAssistant.isEnhancing || !formData.abstract.trim()}
                        className="border-purple-200 hover:bg-purple-50 text-purple-700"
                      >
                        {aiAssistant.isEnhancing ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Wand2 className="h-3 w-3 mr-1" />
                        )}
                        Enhance Abstract
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateFundingStrategy}
                        disabled={aiAssistant.isGeneratingStrategy || !formData.title || !formData.abstract || !formData.fundingGoal}
                        className="border-purple-200 hover:bg-purple-50 text-purple-700"
                      >
                        {aiAssistant.isGeneratingStrategy ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Target className="h-3 w-3 mr-1" />
                        )}
                        Funding Strategy
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={suggestCollaborators}
                        disabled={aiAssistant.isSuggestingCollaborators || !formData.title || !formData.abstract}
                        className="border-purple-200 hover:bg-purple-50 text-purple-700"
                      >
                        {aiAssistant.isSuggestingCollaborators ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Users className="h-3 w-3 mr-1" />
                        )}
                        Find Collaborators
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-slate-700 font-medium flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-emerald-600" />
                      Paper Title
                      {aiAssistant.analysis?.suggestedTitle && (
                        <Badge variant="secondary" className="ml-2 text-xs bg-blue-100 text-blue-700">
                          <Lightbulb className="h-3 w-3 mr-1" />
                          AI Suggestion Available
                        </Badge>
                      )}
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
                    {aiAssistant.analysis?.suggestedTitle && aiAssistant.analysis.suggestedTitle !== formData.title && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-800 mb-1">AI Suggested Title:</p>
                            <p className="text-sm text-blue-700">{aiAssistant.analysis.suggestedTitle}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => applyAISuggestion("title", aiAssistant.analysis!.suggestedTitle!)}
                            className="ml-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            Apply
                          </Button>
                        </div>
                      </div>
                    )}
                    {autoCompleteSuggestions?.suggestedTitle && !formData.title && (
                      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        <span className="text-yellow-800">Auto-suggestion: </span>
                        <button
                          type="button"
                          className="text-yellow-700 underline hover:text-yellow-900"
                          onClick={() => applyAISuggestion("title", autoCompleteSuggestions.suggestedTitle)}
                        >
                          {autoCompleteSuggestions.suggestedTitle}
                        </button>
                      </div>
                    )}
                    {formErrors.title && <p className="text-red-500 text-sm">{formErrors.title}</p>}
                  </div>                  {/* Abstract */}
                  <div className="space-y-2">
                    <Label htmlFor="abstract" className="text-slate-700 font-medium flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-emerald-600" />
                      Abstract
                      {(aiAssistant.analysis?.improvedAbstract || aiAssistant.enhancedAbstract) && (
                        <Badge variant="secondary" className="ml-2 text-xs bg-blue-100 text-blue-700">
                          <Lightbulb className="h-3 w-3 mr-1" />
                          AI Enhancement Available
                        </Badge>
                      )}
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
                    
                    {/* Enhanced Abstract Suggestion */}
                    {aiAssistant.enhancedAbstract && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-sm font-medium text-green-800">Enhanced Abstract:</h4>
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              Readability: {aiAssistant.enhancedAbstract.readabilityScore}/10
                            </Badge>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => applyAISuggestion("abstract", aiAssistant.enhancedAbstract?.enhancedAbstract || "")}
                              className="border-green-300 text-green-700 hover:bg-green-100"
                            >
                              <Zap className="h-3 w-3 mr-1" />
                              Apply
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-green-700 mb-3">{aiAssistant.enhancedAbstract.enhancedAbstract}</p>
                        {aiAssistant.enhancedAbstract.improvements && (
                          <div>
                            <p className="text-xs font-medium text-green-800 mb-1">Key Improvements:</p>
                            <ul className="text-xs text-green-700 space-y-1">
                              {aiAssistant.enhancedAbstract.improvements.map((improvement: string, index: number) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-green-500 mr-1">•</span>
                                  {improvement}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* AI Analysis Improved Abstract */}
                    {aiAssistant.analysis?.improvedAbstract && aiAssistant.analysis.improvedAbstract !== formData.abstract && !aiAssistant.enhancedAbstract && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-800 mb-1">AI Improved Abstract:</p>
                            <p className="text-sm text-blue-700">{aiAssistant.analysis.improvedAbstract}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => applyAISuggestion("abstract", aiAssistant.analysis!.improvedAbstract!)}
                            className="ml-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            Apply
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {autoCompleteSuggestions?.suggestedAbstract && !formData.abstract && (
                      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        <span className="text-yellow-800">Auto-suggestion: </span>
                        <button
                          type="button"
                          className="text-yellow-700 underline hover:text-yellow-900"
                          onClick={() => applyAISuggestion("abstract", autoCompleteSuggestions.suggestedAbstract)}
                        >
                          Click to apply suggested abstract
                        </button>
                      </div>
                    )}
                    
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
                  </div>                  {/* Funding Goal */}
                  <div className="space-y-2">
                    <Label htmlFor="funding-goal" className="text-slate-700 font-medium flex items-center">
                      <Coins className="h-4 w-4 mr-2 text-emerald-600" />
                      Funding Goal (Tokens)
                      {aiAssistant.analysis?.estimatedFundingGoal && (
                        <Badge variant="secondary" className="ml-2 text-xs bg-blue-100 text-blue-700">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          AI Estimated
                        </Badge>
                      )}
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
                    {aiAssistant.analysis?.estimatedFundingGoal && !formData.fundingGoal && (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                        <span className="text-blue-800">AI Estimated Funding: </span>
                        <button
                          type="button"
                          className="text-blue-700 underline hover:text-blue-900 font-medium"
                          onClick={() => applyAISuggestion("fundingGoal", aiAssistant.analysis!.estimatedFundingGoal!.toString())}
                        >
                          ${aiAssistant.analysis.estimatedFundingGoal.toLocaleString()} tokens
                        </button>
                      </div>
                    )}
                    {autoCompleteSuggestions?.suggestedFundingGoal && !formData.fundingGoal && (
                      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        <span className="text-yellow-800">Suggested Funding: </span>
                        <button
                          type="button"
                          className="text-yellow-700 underline hover:text-yellow-900"
                          onClick={() => applyAISuggestion("fundingGoal", autoCompleteSuggestions.suggestedFundingGoal.toString())}
                        >
                          ${autoCompleteSuggestions.suggestedFundingGoal.toLocaleString()} tokens
                        </button>
                      </div>
                    )}
                    {formErrors.fundingGoal ? (
                      <p className="text-red-500 text-sm">{formErrors.fundingGoal}</p>
                    ) : (
                      <p className="text-sm text-slate-500">Amount of tokens needed to fund this research</p>
                    )}
                  </div>                  {/* Funding Period */}
                  <div className="space-y-2">
                    <Label htmlFor="funding-period" className="text-slate-700 font-medium flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-emerald-600" />
                      Funding Period (Days)
                      {aiAssistant.analysis?.suggestedFundingPeriod && (
                        <Badge variant="secondary" className="ml-2 text-xs bg-blue-100 text-blue-700">
                          <Calendar className="h-3 w-3 mr-1" />
                          AI Suggested
                        </Badge>
                      )}
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
                    {aiAssistant.analysis?.suggestedFundingPeriod && formData.fundingPeriodDays === "30" && (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                        <span className="text-blue-800">AI Suggested Period: </span>
                        <button
                          type="button"
                          className="text-blue-700 underline hover:text-blue-900 font-medium"
                          onClick={() => applyAISuggestion("fundingPeriodDays", aiAssistant.analysis!.suggestedFundingPeriod!.toString())}
                        >
                          {aiAssistant.analysis.suggestedFundingPeriod} days
                        </button>
                      </div>
                    )}
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
                  </Button>                </form>
              </CardContent>
            </Card>

            {/* AI Analysis Results */}
            {aiAssistant.showAnalysis && aiAssistant.analysis && (
              <Card className="mt-6 border-0 shadow-xl bg-gradient-to-br from-purple-50 to-blue-50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-purple-800 flex items-center">
                    <Brain className="h-5 w-5 mr-2" />
                    AI Paper Analysis
                  </CardTitle>
                  <CardDescription className="text-purple-600">
                    Comprehensive analysis and suggestions for your research paper
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Innovation Score */}
                    {aiAssistant.analysis.innovationScore && (
                      <div className="p-4 bg-white/60 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-purple-800">Innovation Score</h4>
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                            {aiAssistant.analysis.innovationScore}/10
                          </Badge>
                        </div>
                        <div className="w-full bg-purple-200 rounded-full h-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full" 
                            style={{ width: `${(aiAssistant.analysis.innovationScore / 10) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Research Domain */}
                    {aiAssistant.analysis.researchDomain && (
                      <div className="p-4 bg-white/60 rounded-lg border border-purple-200">
                        <h4 className="font-medium text-purple-800 mb-2">Research Domain</h4>
                        <p className="text-sm text-purple-700">{aiAssistant.analysis.researchDomain}</p>
                      </div>
                    )}

                    {/* Market Potential */}
                    {aiAssistant.analysis.marketPotential && (
                      <div className="p-4 bg-white/60 rounded-lg border border-purple-200">
                        <h4 className="font-medium text-purple-800 mb-2">Market Potential</h4>
                        <p className="text-sm text-purple-700">{aiAssistant.analysis.marketPotential}</p>
                      </div>
                    )}
                  </div>

                  {/* Keywords */}
                  {aiAssistant.analysis.keywords && aiAssistant.analysis.keywords.length > 0 && (
                    <div className="p-4 bg-white/60 rounded-lg border border-purple-200">
                      <h4 className="font-medium text-purple-800 mb-3">Suggested Keywords</h4>
                      <div className="flex flex-wrap gap-2">
                        {aiAssistant.analysis.keywords.map((keyword, index) => (
                          <Badge key={index} variant="secondary" className="bg-purple-100 text-purple-700">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Target Audience */}
                  {aiAssistant.analysis.targetAudience && aiAssistant.analysis.targetAudience.length > 0 && (
                    <div className="p-4 bg-white/60 rounded-lg border border-purple-200">
                      <h4 className="font-medium text-purple-800 mb-3">Target Audience</h4>
                      <div className="space-y-2">
                        {aiAssistant.analysis.targetAudience.map((audience, index) => (
                          <div key={index} className="flex items-center text-sm text-purple-700">
                            <Users className="h-3 w-3 mr-2" />
                            {audience}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risks */}
                  {aiAssistant.analysis.risks && aiAssistant.analysis.risks.length > 0 && (
                    <div className="p-4 bg-white/60 rounded-lg border border-purple-200">
                      <h4 className="font-medium text-purple-800 mb-3">Potential Risks</h4>
                      <div className="space-y-2">
                        {aiAssistant.analysis.risks.map((risk, index) => (
                          <div key={index} className="flex items-start text-sm text-purple-700">
                            <span className="text-red-500 mr-2 mt-1">•</span>
                            {risk}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {aiAssistant.analysis.suggestions && aiAssistant.analysis.suggestions.length > 0 && (
                    <div className="p-4 bg-white/60 rounded-lg border border-purple-200">
                      <h4 className="font-medium text-purple-800 mb-3">AI Suggestions</h4>
                      <div className="space-y-2">
                        {aiAssistant.analysis.suggestions.map((suggestion, index) => (
                          <div key={index} className="flex items-start text-sm text-purple-700">
                            <Lightbulb className="h-3 w-3 mr-2 mt-1 text-yellow-500" />
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* AI Funding Strategy */}
            {aiAssistant.showStrategy && aiAssistant.strategy && (
              <Card className="mt-6 border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-green-800 flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    AI Funding Strategy
                  </CardTitle>
                  <CardDescription className="text-green-600">
                    Strategic recommendations for securing research funding
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Strategy Overview */}
                  <div className="p-4 bg-white/60 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-800 mb-2">Strategy Overview</h4>
                    <p className="text-sm text-green-700">{aiAssistant.strategy.strategy}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Milestones */}
                    {aiAssistant.strategy.milestones && aiAssistant.strategy.milestones.length > 0 && (
                      <div className="p-4 bg-white/60 rounded-lg border border-green-200">
                        <h4 className="font-medium text-green-800 mb-3">Key Milestones</h4>
                        <div className="space-y-2">
                          {aiAssistant.strategy.milestones.map((milestone: string, index: number) => (
                            <div key={index} className="flex items-start text-sm text-green-700">
                              <CheckCircle2 className="h-3 w-3 mr-2 mt-1 text-green-500" />
                              {milestone}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Risk Mitigation */}
                    {aiAssistant.strategy.riskMitigation && aiAssistant.strategy.riskMitigation.length > 0 && (
                      <div className="p-4 bg-white/60 rounded-lg border border-green-200">
                        <h4 className="font-medium text-green-800 mb-3">Risk Mitigation</h4>
                        <div className="space-y-2">
                          {aiAssistant.strategy.riskMitigation.map((mitigation: string, index: number) => (
                            <div key={index} className="flex items-start text-sm text-green-700">
                              <span className="text-green-500 mr-2 mt-1">•</span>
                              {mitigation}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Alternative Funding */}
                  {aiAssistant.strategy.alternativeFunding && aiAssistant.strategy.alternativeFunding.length > 0 && (
                    <div className="p-4 bg-white/60 rounded-lg border border-green-200">
                      <h4 className="font-medium text-green-800 mb-3">Alternative Funding Sources</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {aiAssistant.strategy.alternativeFunding.map((source: string, index: number) => (
                          <div key={index} className="flex items-center text-sm text-green-700 p-2 bg-green-100 rounded">
                            <Coins className="h-3 w-3 mr-2" />
                            {source}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* AI Collaborator Suggestions */}
            {aiAssistant.showCollaborators && aiAssistant.collaborators && (
              <Card className="mt-6 border-0 shadow-xl bg-gradient-to-br from-blue-50 to-indigo-50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-blue-800 flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    AI Collaborator Suggestions
                  </CardTitle>
                  <CardDescription className="text-blue-600">
                    Find the right expertise and institutions for your research
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Suggested Collaborators */}
                    {aiAssistant.collaborators.suggestedCollaborators && aiAssistant.collaborators.suggestedCollaborators.length > 0 && (
                      <div className="p-4 bg-white/60 rounded-lg border border-blue-200">
                        <h4 className="font-medium text-blue-800 mb-3">Suggested Collaborators</h4>
                        <div className="space-y-2">
                          {aiAssistant.collaborators.suggestedCollaborators.map((collaborator: string, index: number) => (
                            <div key={index} className="flex items-center text-sm text-blue-700 p-2 bg-blue-100 rounded">
                              <Users className="h-3 w-3 mr-2" />
                              {collaborator}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expertise Areas */}
                    {aiAssistant.collaborators.expertiseAreas && aiAssistant.collaborators.expertiseAreas.length > 0 && (
                      <div className="p-4 bg-white/60 rounded-lg border border-blue-200">
                        <h4 className="font-medium text-blue-800 mb-3">Required Expertise</h4>
                        <div className="space-y-2">
                          {aiAssistant.collaborators.expertiseAreas.map((expertise: string, index: number) => (
                            <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-700 mr-1 mb-1">
                              {expertise}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Institution Recommendations */}
                    {aiAssistant.collaborators.institutionRecommendations && aiAssistant.collaborators.institutionRecommendations.length > 0 && (
                      <div className="p-4 bg-white/60 rounded-lg border border-blue-200">
                        <h4 className="font-medium text-blue-800 mb-3">Institution Types</h4>
                        <div className="space-y-2">
                          {aiAssistant.collaborators.institutionRecommendations.map((institution: string, index: number) => (
                            <div key={index} className="flex items-center text-sm text-blue-700 p-2 bg-blue-100 rounded">
                              <span className="text-blue-500 mr-2">🏢</span>
                              {institution}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
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
          </TabsContent>        </Tabs>

        {/* Floating AI Assistant Button */}
        {activeTab === "submit" && (
          <div className="fixed bottom-6 right-6 z-50">
            <div className="relative">
              {(aiAssistant.analysis || aiAssistant.enhancedAbstract || aiAssistant.strategy || aiAssistant.collaborators) && (
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">!</span>
                </div>
              )}
              <Button
                onClick={analyzePaperWithAI}
                disabled={aiAssistant.isAnalyzing || (!formData.title && !formData.abstract)}
                className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                title="Quick AI Analysis (Ctrl+A)"
              >
                {aiAssistant.isAnalyzing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Brain className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* AI Summary Panel */}
        {(aiAssistant.analysis || aiAssistant.enhancedAbstract || aiAssistant.strategy || aiAssistant.collaborators) && (
          <div className="fixed bottom-6 left-6 max-w-sm z-40">
            <Card className="bg-white/95 backdrop-blur-sm border-purple-200 shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-800 flex items-center">
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Insights Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-xs text-purple-700">
                  {aiAssistant.analysis && (
                    <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                      <span>Paper Analysis</span>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
                        {aiAssistant.analysis.innovationScore ? `${aiAssistant.analysis.innovationScore}/10` : 'Complete'}
                      </Badge>
                    </div>
                  )}
                  {aiAssistant.enhancedAbstract && (
                    <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                      <span>Abstract Enhancement</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                        {aiAssistant.enhancedAbstract.readabilityScore}/10
                      </Badge>
                    </div>
                  )}
                  {aiAssistant.strategy && (
                    <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                      <span>Funding Strategy</span>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                        Ready
                      </Badge>
                    </div>
                  )}
                  {aiAssistant.collaborators && (
                    <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                      <span>Collaborator Suggestions</span>
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                        {aiAssistant.collaborators.suggestedCollaborators?.length || 0} Found
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
