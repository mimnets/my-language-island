# 🇫🇷 AI Language Island (French for Apparel Pros)

This is a **Vercel-hosted AI Skill** designed to help language learners (like Sabbir) build a "Language Island" using the AI-driven sentence method.

## 🚀 Features
- **Auto-Sync:** Saves sentences directly to GitHub using API.
- **AI Ready:** Can be used as an MCP Skill for Claude Code or OpenClaw.
- **Custom UI:** A clean dashboard to manage your learning progress.

## 🛠️ How to Setup
1. **Fork this Repo.**
2. **Vercel Deployment:** Connect your GitHub repo to Vercel.
3. **Environment Variable:** Add `GITHUB_TOKEN` in Vercel settings (your Personal Access Token).
4. **Data File:** Ensure `data.json` exists in your root folder with `[]`.

## 🤖 Use as an AI Skill
Point your AI agent to `https://your-vercel-link.vercel.app/api/island` to feed it your personal context.
