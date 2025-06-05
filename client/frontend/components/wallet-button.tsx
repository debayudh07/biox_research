"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

export function WalletButton() {
  const { publicKey, connecting, connected } = useWallet()
  const [mounted, setMounted] = useState(false)

  // Ensure component is mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
        Connect Wallet
      </Button>
    )
  }

  if (connecting) {
    return (
      <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" disabled>
        Connecting...
      </Button>
    )
  }

  if (connected && publicKey) {
    const walletAddress = publicKey.toString()
    const shortAddress = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    
    return (
      <WalletMultiButton className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium">
        {shortAddress}
      </WalletMultiButton>
    )
  }

  return (
    <WalletMultiButton className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium">
      Connect Wallet
    </WalletMultiButton>
  )
}
