import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY
if (!API_KEY) {
  throw new Error('NEXT_PUBLIC_GEMINI_API_KEY is not defined in environment variables')
}
const genAI = new GoogleGenerativeAI(API_KEY)

// Initialize the Gemini 2.0 Flash model
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

interface PaperAnalysis {
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

interface AuthorSuggestions {
  suggestedCollaborators?: string[]
  expertiseAreas?: string[]
  institutionRecommendations?: string[]
}

interface ProjectDescription {
  executiveSummary: string
  technicalOverview: string
  marketAnalysis: string
  timeline: string
  budget: string
  impact: string
}

export class GeminiAIService {
  
  /**
   * Analyze and enhance a research paper submission
   */
  static async analyzePaper(paperData: {
    title?: string
    abstract?: string
    authors?: string[]
    researchField?: string
  }): Promise<PaperAnalysis> {
    try {
      const prompt = `
        As an AI research assistant, analyze the following research paper data and provide comprehensive suggestions:

        Title: ${paperData.title || 'Not provided'}
        Abstract: ${paperData.abstract || 'Not provided'}
        Authors: ${paperData.authors?.join(', ') || 'Not provided'}
        Research Field: ${paperData.researchField || 'Not specified'}

        Please provide analysis in the following JSON format:
        {
          "suggestedTitle": "Enhanced version of the title if needed",
          "improvedAbstract": "Enhanced version of the abstract with better clarity and impact",
          "keywords": ["keyword1", "keyword2", "keyword3"],
          "researchDomain": "Primary research domain",
          "estimatedFundingGoal": "Estimated funding needed in USD (number only)",
          "suggestedFundingPeriod": "Suggested funding period in days (number only)",
          "targetAudience": ["audience1", "audience2"],
          "innovationScore": "Innovation score out of 10 (number only)",
          "marketPotential": "Brief market potential assessment",
          "risks": ["risk1", "risk2"],
          "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
        }

        Focus on biotechnology, life sciences, and research publication standards. Be specific and actionable.
      `

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      // Extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      throw new Error('Invalid response format')
    } catch (error) {
      console.error('Error analyzing paper:', error)
      throw new Error('Failed to analyze paper with AI')
    }
  }

  /**
   * Generate a comprehensive project description
   */
  static async generateProjectDescription(paperData: {
    title: string
    abstract: string
    authors: string[]
    fundingGoal: number
    researchField?: string
  }): Promise<ProjectDescription> {
    try {
      const prompt = `
        Create a comprehensive project description for this research paper:

        Title: ${paperData.title}
        Abstract: ${paperData.abstract}
        Authors: ${paperData.authors.join(', ')}
        Funding Goal: $${paperData.fundingGoal}
        Research Field: ${paperData.researchField || 'Life Sciences'}

        Generate a detailed project description in JSON format:
        {
          "executiveSummary": "2-3 sentence executive summary highlighting the key innovation and impact",
          "technicalOverview": "Detailed technical description of the research methodology and approach",
          "marketAnalysis": "Analysis of the market opportunity and competitive landscape",
          "timeline": "Suggested project timeline and key milestones",
          "budget": "Budget breakdown and justification for the funding request",
          "impact": "Expected impact on the field, society, and potential applications"
        }

        Make it compelling for potential funders while maintaining scientific accuracy.
      `

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      throw new Error('Invalid response format')
    } catch (error) {
      console.error('Error generating project description:', error)
      throw new Error('Failed to generate project description')
    }
  }

  /**
   * Suggest potential collaborators and expertise areas
   */
  static async suggestCollaborators(paperData: {
    title: string
    abstract: string
    researchField?: string
  }): Promise<AuthorSuggestions> {
    try {
      const prompt = `
        Based on this research paper, suggest potential collaborators and expertise areas:

        Title: ${paperData.title}
        Abstract: ${paperData.abstract}
        Research Field: ${paperData.researchField || 'Life Sciences'}

        Provide suggestions in JSON format:
        {
          "suggestedCollaborators": ["Type of expert/researcher 1", "Type of expert/researcher 2"],
          "expertiseAreas": ["expertise area 1", "expertise area 2", "expertise area 3"],
          "institutionRecommendations": ["type of institution 1", "type of institution 2"]
        }

        Focus on realistic collaboration opportunities in biotechnology and life sciences.
      `

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      throw new Error('Invalid response format')
    } catch (error) {
      console.error('Error suggesting collaborators:', error)
      throw new Error('Failed to suggest collaborators')
    }
  }

  /**
   * Enhance abstract with AI suggestions
   */
  static async enhanceAbstract(abstract: string, title: string): Promise<{
    enhancedAbstract: string
    improvements: string[]
    readabilityScore: number
  }> {
    try {
      const prompt = `
        Enhance this research abstract for better clarity, impact, and funding appeal:

        Title: ${title}
        Abstract: ${abstract}

        Provide enhancement in JSON format:
        {
          "enhancedAbstract": "Improved version of the abstract",
          "improvements": ["improvement 1", "improvement 2", "improvement 3"],
          "readabilityScore": "Score from 1-10 for readability (number only)"
        }

        Focus on scientific accuracy while making it more compelling for peer reviewers and funders.
      `

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      throw new Error('Invalid response format')
    } catch (error) {
      console.error('Error enhancing abstract:', error)
      throw new Error('Failed to enhance abstract')
    }
  }

  /**
   * Generate funding strategy recommendations
   */
  static async generateFundingStrategy(paperData: {
    title: string
    abstract: string
    fundingGoal: number
    researchField?: string
  }): Promise<{
    strategy: string
    milestones: string[]
    riskMitigation: string[]
    alternativeFunding: string[]
  }> {
    try {
      const prompt = `
        Create a funding strategy for this research project:

        Title: ${paperData.title}
        Abstract: ${paperData.abstract}
        Funding Goal: $${paperData.fundingGoal}
        Research Field: ${paperData.researchField || 'Life Sciences'}

        Provide strategy in JSON format:
        {
          "strategy": "Overall funding strategy and approach",
          "milestones": ["milestone 1", "milestone 2", "milestone 3"],
          "riskMitigation": ["risk mitigation 1", "risk mitigation 2"],
          "alternativeFunding": ["alternative source 1", "alternative source 2"]
        }

        Focus on practical, actionable funding strategies for research projects.
      `

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      throw new Error('Invalid response format')
    } catch (error) {
      console.error('Error generating funding strategy:', error)
      throw new Error('Failed to generate funding strategy')
    }
  }

  /**
   * Smart form auto-completion
   */
  static async autoCompleteForm(partialData: {
    title?: string
    abstract?: string
    researchField?: string
  }): Promise<{
    suggestedTitle?: string
    suggestedAbstract?: string
    suggestedAuthors?: string[]
    suggestedFundingGoal?: number
    suggestedKeywords?: string[]
  }> {
    try {
      const prompt = `
        Help auto-complete this research paper form based on the provided information:

        Title: ${partialData.title || 'Not provided'}
        Abstract: ${partialData.abstract || 'Not provided'}
        Research Field: ${partialData.researchField || 'Not provided'}

        Provide auto-completion suggestions in JSON format:
        {
          "suggestedTitle": "Complete/improved title if partial title provided",
          "suggestedAbstract": "Suggested abstract if title is provided but abstract is missing",
          "suggestedAuthors": ["researcher type 1", "researcher type 2"],
          "suggestedFundingGoal": "Estimated funding goal in USD (number only)",
          "suggestedKeywords": ["keyword1", "keyword2", "keyword3"]
        }

        Only provide suggestions for missing or incomplete fields.
      `

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      throw new Error('Invalid response format')
    } catch (error) {
      console.error('Error auto-completing form:', error)
      throw new Error('Failed to auto-complete form')
    }
  }

  /**
   * Extract text from PDF content (if you have PDF text)
   */
  static async analyzePDFContent(pdfText: string): Promise<{
    extractedTitle?: string
    extractedAbstract?: string
    extractedAuthors?: string[]
    researchField?: string
    keyFindings?: string[]
  }> {
    try {
      const prompt = `
        Analyze this PDF content and extract key information:

        PDF Content: ${pdfText.substring(0, 4000)}...

        Extract information in JSON format:
        {
          "extractedTitle": "Main title of the research paper",
          "extractedAbstract": "Abstract section if found",
          "extractedAuthors": ["author1", "author2"],
          "researchField": "Primary research field/domain",
          "keyFindings": ["finding1", "finding2", "finding3"]
        }

        Focus on accurate extraction of bibliographic information.
      `

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      throw new Error('Invalid response format')
    } catch (error) {
      console.error('Error analyzing PDF content:', error)
      throw new Error('Failed to analyze PDF content')
    }
  }
}

export default GeminiAIService