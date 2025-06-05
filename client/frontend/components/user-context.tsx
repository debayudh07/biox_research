"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { PublicKey } from '@solana/web3.js'

type UserContextType = {
  isSignedUp: boolean
  publicKey: string | null
  setUserSignedUp: (status: boolean, publicKey?: string) => void
  signOut: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [isSignedUp, setIsSignedUp] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)

  useEffect(() => {
    // Check session storage on mount
    const storedSignUp = sessionStorage.getItem('userSignedUp')
    const storedPublicKey = sessionStorage.getItem('userPublicKey')
    
    if (storedSignUp === 'true') {
      setIsSignedUp(true)
      if (storedPublicKey) {
        setPublicKey(storedPublicKey)
      }
    }
  }, [])

  const setUserSignedUp = (status: boolean, walletPublicKey?: string) => {
    setIsSignedUp(status)
    
    if (status && walletPublicKey) {
      setPublicKey(walletPublicKey)
      sessionStorage.setItem('userSignedUp', 'true')
      sessionStorage.setItem('userPublicKey', walletPublicKey)
    } else if (!status) {
      setPublicKey(null)
      sessionStorage.removeItem('userSignedUp')
      sessionStorage.removeItem('userPublicKey')
    }
  }

  const signOut = () => {
    setUserSignedUp(false)
  }

  return (
    <UserContext.Provider value={{ isSignedUp, publicKey, setUserSignedUp, signOut }}>
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
