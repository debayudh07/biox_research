"use client";

import Link from "next/link";
import { Microscope } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { WalletButton } from "@/components/wallet-button";
import { useWallet } from "@solana/wallet-adapter-react";
import { useUser } from "@/components/user-context";

export function Navigation() {
  const { connected } = useWallet();
  const { isSignedUp } = useUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Microscope className="h-6 w-6 text-emerald-500" />
          <span className="text-xl font-bold text-emerald-500">BioResearch Hub</span>
        </Link>        <nav className="hidden md:flex items-center gap-6 text-sm">
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
            </>
          )}
          <Link
            href="/#features"
            className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Features
          </Link>
          <Link
            href="/#about"
            className="text-emerald-600 hover:text-emerald-500 transition-colors dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            About
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <ModeToggle />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
