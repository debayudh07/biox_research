import type React from "react"
import "@/app/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SolanaProvider } from "./solprovider"
import { UserProvider } from "@/components/user-context"

export const metadata = {
  title: "BioResearch Hub - Decentralized Bio-Medical Research Platform",
  description: "Publish, review, fund, and analyze bio-medical research papers in a decentralized ecosystem.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <SolanaProvider>
            <UserProvider>
              {children}
            </UserProvider>
          </SolanaProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
