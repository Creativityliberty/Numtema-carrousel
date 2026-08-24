# Numtema Design — Carousel Studio

> AI-powered social media carousel creator by **Numtema Design** — built with Gemini, React 19, Vite, Express & Tailwind CSS 4.

## ✨ Features

- 🎨 **Design Architect** — analyze reference images to extract a Design DNA
- ⚡ **Flash Create** — generate full carousels from a single prompt with Gemini
- 🖼️ **AI Background Generator** — auto-generate contextual visual prompts + images per slide
- 🎭 **5 Content Intents** — Educational, Storytelling, Checklist, Promotion, Trends
- 🖌️ **Full Style Controls** — typography, layout, branding, accent, light/dark theme
- 📋 **Copy/Paste Slide Style** — copy a slide's style and paste it to all slides
- 📦 **ZIP Export** — export all slides as high-res PNG images
- 🔧 **MCP Server** — Model Context Protocol integration for agent tooling

---

## 🚀 Getting Started (Local)

### Prerequisites
- Node.js 20+
- A [Gemini API key](https://aistudio.google.com/app/apikey)

### Setup

```bash
git clone https://github.com/Creativityliberty/Numtema-carrousel.git
cd Numtema-carrousel

npm install

# Create your env file
cp .env.example .env.local
# → Edit .env.local and add your GEMINI_API_KEY

npm run dev
```

App runs at **http://localhost:3000**

---

## 🐳 Deploy with Coolify (Docker)

### Environment Variable required:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Your Google Gemini API key |

### Steps in Coolify:
1. **New Service** → **Docker** → paste your GitHub repo URL
2. **Build Pack** → `Dockerfile`
3. **Port** → `3000`
4. **Environment Variables** → add `GEMINI_API_KEY=your_key_here`
5. **Deploy** 🚀

> Projects data is persisted in the container's `os.tmpdir()`. For persistent storage across restarts, mount a volume to `/tmp` or update `PROJECTS_FILE` in `server.ts` to a mounted path.

---

## 📁 Project Structure

```
├── App.tsx              # Main React app
├── server.ts            # Express API server (Vite SSR + API routes)
├── geminiService.ts     # Gemini API client helpers
├── mcpServer.ts         # MCP server for agent tooling
├── types.ts             # TypeScript types & constants
├── src/
│   └── components/      # UI components (SlidePreview, BrandingSettings, etc.)
├── Dockerfile           # Production multi-stage Docker build
└── vite.config.ts       # Vite configuration
```

---

## 🔑 API Routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Save projects |
| `POST` | `/api/generate-carousel` | Generate carousel content with Gemini |
| `POST` | `/api/generate-image` | Generate slide background image |
| `POST` | `/api/enhance-visual-prompt` | Auto-generate visual prompt from slide context |
| `POST` | `/api/analyze-design` | Extract Design DNA from reference images |
| `POST` | `/api/edit-slide` | Retouche a slide with AI instruction |

---

## 📄 License

Private — © 2026 Numtema Design. All rights reserved.
