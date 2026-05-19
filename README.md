# 🎙️ WisperFlow — Voice to Text That Sounds Like You

A free, self-hosted voice transcription app deployed on **Vercel** with **GitHub** CI/CD.

---

## 🚀 Tech Stack (All Free)

| Tool | Purpose | Cost |
|------|---------|------|
| Next.js 14 | Framework | Free |
| Web Speech API | Browser-native STT | Free |
| Anthropic Claude API | Style correction | Free tier |
| Vercel | Hosting + Deploy | Free |
| GitHub | Source control + CI/CD | Free |
| localStorage | Style memory | Free |

---

## 📁 Project Structure

```
wisperflow/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
│       └── stylize/
│           └── route.ts        ← Claude API route
├── components/
│   ├── VoiceRecorder.tsx       ← Main recorder component
│   ├── TranscriptEditor.tsx    ← Editable transcript
│   ├── StyleLearner.tsx        ← Your writing style trainer
│   └── WaveAnimation.tsx       ← Audio visualizer
├── lib/
│   ├── speechRecognition.ts    ← Web Speech API wrapper
│   └── styleProfile.ts         ← Style profile storage
├── public/
├── .env.local.example
├── package.json
└── vercel.json
```

---

## ⚙️ Setup Instructions

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/wisperflow.git
cd wisperflow
npm install
```

### 2. Environment Variables

Create `.env.local`:
```env
ANTHROPIC_API_KEY=your_key_here
```

Get your free API key at: https://console.anthropic.com

### 3. Run Locally

```bash
npm run dev
```

Open http://localhost:3000

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add env variable in Vercel dashboard:
# ANTHROPIC_API_KEY = your_key
```

Or connect GitHub repo directly at vercel.com — auto-deploys on every push!

---

## 🎯 Features

- ✅ Real-time voice transcription (Web Speech API — 100% free)
- ✅ "Sounds like you" style correction via Claude
- ✅ Style profile — learns your vocab, tone, punctuation habits
- ✅ Copy, export, edit transcripts
- ✅ Works offline for basic transcription
- ✅ Mobile-friendly

---

## 🔑 API Key Note

The free Anthropic API tier gives you enough credits to use style correction daily. The app works without it too — just without style personalization.
