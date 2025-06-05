# BioX Research Platform

A decentralized research publication and funding platform built on Solana blockchain, enabling transparent peer review, token-based funding, and democratic governance for biotechnology and life sciences research.

## 🌟 Overview

BioX Research Platform revolutionizes scientific research publication by combining blockchain technology with traditional peer review processes. Researchers can submit papers, receive community-driven funding, and engage in transparent voting mechanisms while maintaining intellectual property rights through IPFS storage.

## 🏗️ Architecture

### Frontend (Next.js 15 + TypeScript)
- **Framework**: Next.js 15 with React 19
- **Styling**: Tailwind CSS with custom components
- **Wallet Integration**: Solana Wallet Adapter
- **UI Components**: Radix UI primitives with custom styling
- **State Management**: React hooks and context

### Backend (Solana Smart Contract)
- **Framework**: Anchor Framework for Solana
- **Language**: Rust
- **Network**: Solana (Devnet/Mainnet)
- **Token Standard**: SPL Token for funding mechanism

### Storage
- **File Storage**: IPFS via Pinata for research papers
- **Metadata**: On-chain storage for paper metadata and funding info

## 🚀 Features

### Core Functionality
- **Paper Submission**: Submit research papers with IPFS storage
- **Peer Review**: Community-based voting system with weighted tokens
- **Funding Mechanism**: Token-based crowdfunding for research projects
- **Publication Management**: Multi-stage paper status tracking
- **Wallet Integration**: Seamless Solana wallet connectivity

### Advanced Features
- **Weighted Voting**: Token balance influences vote weight (max 10x multiplier)
- **Platform Fees**: Configurable fee structure for sustainability
- **Admin Controls**: Emergency pause and settings management
- **Real-time Updates**: Dynamic funding progress and status tracking
- **Mobile Responsive**: Optimized for all device sizes

## 🛠️ Technology Stack

### Frontend Technologies
```json
{
  "framework": "Next.js 15.1.6",
  "runtime": "React 19",
  "language": "TypeScript 5",
  "styling": "Tailwind CSS 3.4.1",
  "ui": "Radix UI",
  "icons": "Lucide React",
  "wallet": "Solana Wallet Adapter",
  "blockchain": "@solana/web3.js",
  "forms": "React Hook Form + Zod"
}
```

### Backend Technologies
```toml
[dependencies]
anchor-framework = "0.31.1"
solana-program = "1.18"
spl-token = "4.0"
```

### Development Tools
- **Package Manager**: npm/yarn
- **Linting**: ESLint
- **Testing**: Anchor Test Suite
- **Deployment**: Vercel (Frontend), Solana CLI (Contract)

## 📁 Project Structure

```
bioxhackathon/
├── client/frontend/          # Next.js frontend application
│   ├── app/                  # App router pages
│   │   ├── publishpaper/     # Paper submission interface
│   │   ├── viewpaperandfund/ # Paper browsing and funding
│   │   └── globals.css       # Global styles
│   ├── components/           # Reusable UI components
│   │   ├── ui/               # Base UI components
│   │   ├── navigation.tsx    # Main navigation
│   │   └── wallet-button.tsx # Wallet connection
│   └── lib/                  # Utility libraries
│       ├── solana.ts         # Blockchain interactions
│       ├── ipfs.ts           # IPFS operations
│       └── biox_research.*   # Generated contract types
├── contracts/                # Solana smart contracts
│   ├── programs/contracts/   # Main contract code
│   │   └── src/lib.rs        # Contract implementation
│   ├── tests/                # Contract tests
│   ├── Anchor.toml           # Anchor configuration
│   └── target/               # Build artifacts
└── README.md                 # This file
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js 18+ and npm/yarn
- Rust and Cargo
- Solana CLI tools
- Anchor Framework
- Git

### 1. Clone Repository
```bash
git clone <repository-url>
cd bioxhackathon
```

### 2. Smart Contract Setup
```bash
cd contracts
npm install
anchor build
anchor deploy --provider.cluster devnet
```

### 3. Frontend Setup
```bash
cd client/frontend
npm install
npm run dev
```

### 4. Environment Configuration
Create `.env.local` in frontend directory:
```env
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=4TsLtFAfkbpcFjesanK4ojZNTK1bsQPfPuVxt5g19hhM
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
```

## 🎯 Usage Guide

### For Researchers

#### 1. Submit a Paper
- Connect your Solana wallet
- Navigate to "Publish Paper"
- Fill in paper details (title, abstract, authors)
- Upload PDF file (stored on IPFS)
- Set funding goal and duration
- Submit to blockchain

#### 2. Publish Paper
- After submission, papers are in "Draft" status
- Authors can publish papers to make them visible
- Published papers become eligible for voting and funding

### For Community Members

#### 1. Browse Papers
- View all submitted research papers
- Filter by status, funding progress, or keywords
- Search by title, abstract, or author names

#### 2. Vote on Papers
- Upvote or downvote published papers
- Vote weight based on token balance (1-10x multiplier)
- Each user can vote once per paper

#### 3. Fund Research
- Support promising research with tokens
- Track funding progress toward goals
- Platform takes small fee for sustainability

### For Administrators
- Toggle emergency pause functionality
- Update platform fee rates
- Modify minimum funding requirements
- Monitor platform statistics

## 🔄 Smart Contract Functions

### Core Operations
```rust
// Submit new research paper
pub fn submit_paper(
    title: String,
    abstract_text: String,
    ipfs_hash: String,
    authors: Vec<String>,
    funding_goal: u64,
    funding_period_days: u64
) -> Result<()>

// Publish paper for community visibility
pub fn publish_paper(paper_id: u64) -> Result<()>

// Vote on published papers
pub fn vote_paper(
    paper_id: u64,
    is_upvote: bool
) -> Result<()>

// Fund research projects
pub fn fund_paper(
    paper_id: u64,
    amount: u64
) -> Result<()>

// Claim funds when fully funded
pub fn claim_funds(paper_id: u64) -> Result<()>
```

### Account Structure
- **ProgramState**: Global platform configuration
- **ResearchPaper**: Individual paper data and status
- **Vote**: User voting records with weights
- **Funding**: Individual funding contributions

## 🏃‍♂️ Development Commands

### Smart Contract Development
```bash
# Build contracts
anchor build

# Test contracts
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Run local validator
solana-test-validator
```

### Frontend Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint code
npm run lint
```

## 🔐 Security Features

- **Ownership Validation**: Only authors can publish their papers
- **Vote Integrity**: One vote per user per paper
- **Fund Security**: Token transfers through SPL Token program
- **Admin Controls**: Emergency pause functionality
- **Input Validation**: Comprehensive data validation on-chain

## 🌐 Token Economics

### BioX Platform Token
- **Mint Address**: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- **Decimals**: 6 (USDC standard)
- **Purpose**: Funding research and weighted voting

### Fee Structure
- **Platform Fee**: Configurable (default 2.5%)
- **Minimum Funding**: Configurable minimum amounts
- **Vote Weight**: Token balance / 1M tokens (max 10x)

## 🚀 Deployment

### Smart Contract Deployment
1. Configure Anchor.toml for target network
2. Update program ID in client code
3. Deploy using `anchor deploy`
4. Initialize program state
5. Verify deployment on Solana Explorer

### Frontend Deployment
1. Build production bundle: `npm run build`
2. Deploy to Vercel, Netlify, or similar platform
3. Configure environment variables
4. Update domain in wallet adapter settings

## 🧪 Testing

### Contract Tests
```bash
# Run full test suite
anchor test

# Run specific tests
anchor test --skip-deploy tests/contracts.ts
```

### Frontend Testing
- Component testing with React Testing Library
- E2E testing with Playwright (planned)
- Wallet integration testing on devnet

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests for new features
- Update documentation for API changes
- Use conventional commit messages

## 📈 Roadmap

### Phase 1: Core Platform ✅
- [x] Paper submission and storage
- [x] Basic voting mechanism
- [x] Token-based funding
- [x] Wallet integration

### Phase 2: Enhanced Features 🔄
- [ ] Advanced search and filtering
- [ ] Reputation system for reviewers
- [ ] Multi-token support
- [ ] Mobile app development

### Phase 3: Ecosystem Growth 📋
- [ ] Integration with academic institutions
- [ ] NFT certificates for published papers
- [ ] Cross-chain bridge implementation
- [ ] DAO governance structure

## 🐛 Known Issues

- IPFS gateway timeouts on large files
- Wallet connection persistence across sessions
- Mobile wallet adapter compatibility

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check inline code comments and function descriptions
- **Issues**: Report bugs via GitHub Issues
- **Community**: Join our Discord server for discussions
- **Email**: support@bioxresearch.com

## 🙏 Acknowledgments

- Solana Foundation for blockchain infrastructure
- Anchor framework for development tools
- Pinata for IPFS hosting services
- Open source community for various libraries

---

**Built with ❤️ for the future of decentralized scientific research**