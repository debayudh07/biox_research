"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type SignupData = {
  walletAddress: string
  signature: number[]
  message: string
  name: string
  email: string
  institution: string
  field?: string
}

type UserContextType = {
  isSignedUp: boolean
  publicKey: string | null
  setUserSignedUp: (status: boolean, publicKey?: string) => void
  signOut: () => void
  signUp: (data: SignupData) => Promise<boolean>
  checkUserExists: (walletAddress: string) => Promise<boolean>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [isSignedUp, setIsSignedUp] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)

  useEffect(() => {
    // Check localStorage on mount
    const storedSignUp = localStorage.getItem('userSignedUp')
    const storedPublicKey = localStorage.getItem('userPublicKey')
    
    if (storedSignUp === 'true' && storedPublicKey) {
      setIsSignedUp(true)
      setPublicKey(storedPublicKey)
    }
  }, [])

  const setUserSignedUp = (status: boolean, walletPublicKey?: string) => {
    setIsSignedUp(status)
    
    if (status && walletPublicKey) {
      setPublicKey(walletPublicKey)
      localStorage.setItem('userSignedUp', 'true')
      localStorage.setItem('userPublicKey', walletPublicKey)
    } else if (!status) {
      setPublicKey(null)
      localStorage.removeItem('userSignedUp')
      localStorage.removeItem('userPublicKey')
    }
  }

  const signOut = () => {
    setUserSignedUp(false)
  }

  const signUp = async (data: SignupData): Promise<boolean> => {
    try {
      // Here you would typically send the data to your backend API
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        
        
        // Store user data in localStorage
        localStorage.setItem('userSignedUp', 'true')
        localStorage.setItem('userPublicKey', data.walletAddress)
        localStorage.setItem('userData', JSON.stringify({
          name: data.name,
          email: data.email,
          institution: data.institution,
          field: data.field,
          walletAddress: data.walletAddress,
          signupDate: new Date().toISOString()
        }))
        
        setIsSignedUp(true)
        setPublicKey(data.walletAddress)
        
        return true
      } else {
        console.error('Signup failed:', await response.text())
        return false
      }
    } catch (error) {
      console.error('Signup error:', error)
      return false
    }
  }

  const checkUserExists = async (walletAddress: string): Promise<boolean> => {
    try {
      // First check localStorage
      const storedPublicKey = localStorage.getItem('userPublicKey')
      const storedSignUp = localStorage.getItem('userSignedUp')
      
      if (storedSignUp === 'true' && storedPublicKey === walletAddress) {
        setIsSignedUp(true)
        setPublicKey(walletAddress)
        return true
      }

      // Then check with backend API
      const response = await fetch(`/api/auth/check-user?wallet=${walletAddress}`)
      
      if (response.ok) {
        const result = await response.json()
        
        if (result.exists) {
          // Update localStorage if user exists on backend but not locally
          localStorage.setItem('userSignedUp', 'true')
          localStorage.setItem('userPublicKey', walletAddress)
          
          if (result.userData) {
            localStorage.setItem('userData', JSON.stringify(result.userData))
          }
          
          setIsSignedUp(true)
          setPublicKey(walletAddress)
          return true
        }
        
        return false
      } else {
        console.error('Check user failed:', await response.text())
        return false
      }
    } catch (error) {
      console.error('Check user error:', error)
      // Fall back to localStorage check on network error
      const storedPublicKey = localStorage.getItem('userPublicKey')
      const storedSignUp = localStorage.getItem('userSignedUp')
      
      if (storedSignUp === 'true' && storedPublicKey === walletAddress) {
        setIsSignedUp(true)
        setPublicKey(walletAddress)
        return true
      }
      
      return false
    }
  }

  return (
    <UserContext.Provider value={{ 
      isSignedUp, 
      publicKey, 
      setUserSignedUp, 
      signOut, 
      signUp, 
      checkUserExists 
    }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  
  return context
}
