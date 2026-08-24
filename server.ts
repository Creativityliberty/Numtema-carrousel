import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import os from "os";
import { Pool } from "pg";

// Load environment variables from .env.local or .env if they exist
if (fs.existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
} else if (fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

import { registerMcpServer } from "./mcpServer";

const app = express();
app.use(express.json({ limit: "15mb" }));
registerMcpServer(app);

const PORT = 3000;

// Gemini client initialization helper
const getAI = () => {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, '');
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required. Set it in your environment variables or .env.local file.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Storage & Database Routes ---

const PROJECTS_FILE = path.join(os.tmpdir(), "numtema_projects.json");
if (!fs.existsSync(PROJECTS_FILE)) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify([]));
}

let pgPool: Pool | null = null;
if (process.env.DATABASE_URL) {
  try {
    const isLocal = process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1");
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false }
    });
    console.log("[Numtema] PostgreSQL configured with DATABASE_URL");

    // Initialize database table automatically
    pgPool.query(`
      CREATE TABLE IF NOT EXISTS numtema_projects (
        id VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at BIGINT NOT NULL
      );
    `).then(() => {
      console.log("[Numtema] PostgreSQL table 'numtema_projects' ready.");
    }).catch(err => {
      console.error("[Numtema] PostgreSQL table creation warning:", err);
    });
  } catch (err) {
    console.error("[Numtema] PostgreSQL Pool error:", err);
    pgPool = null;
  }
} else {
  console.log("[Numtema] Using local JSON DB:", PROJECTS_FILE);
}

app.get("/api/projects", async (req, res) => {
  try {
    if (pgPool) {
      try {
        const result = await pgPool.query("SELECT data FROM numtema_projects ORDER BY updated_at DESC;");
        return res.json(result.rows.map(r => r.data));
      } catch (dbErr) {
        console.warn("[Numtema] PostgreSQL query fallback to file:", dbErr);
      }
    }
    const data = fs.readFileSync(PROJECTS_FILE, "utf-8");
    res.json(JSON.parse(data));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load projects" });
  }
});

app.post("/api/projects", async (req, res) => {
  try {
    const projects = req.body;
    if (!Array.isArray(projects)) {
      return res.status(400).json({ error: "Projects array expected" });
    }

    if (pgPool) {
      try {
        const client = await pgPool.connect();
        try {
          await client.query("BEGIN");
          await client.query("DELETE FROM numtema_projects;");
          for (const p of projects) {
            await client.query(
              "INSERT INTO numtema_projects (id, data, updated_at) VALUES ($1, $2, $3);",
              [p.id || `project-${Date.now()}`, JSON.stringify(p), p.updatedAt || Date.now()]
            );
          }
          await client.query("COMMIT");
        } catch (trxErr) {
          await client.query("ROLLBACK");
          throw trxErr;
        } finally {
          client.release();
        }
      } catch (dbErr) {
        console.warn("[Numtema] PostgreSQL save error, falling back to local file:", dbErr);
      }
    }

    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save projects" });
  }
});

/**
 * DNA Design Spec extraction helper
 */
app.post("/api/analyze-design", async (req, res) => {
  try {
    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "Missing images. Please upload one or more references." });
    }

    const ai = getAI();

    // Prepare visual and text parts for the multimodel request
    const parts = images.map((img: string) => {
      const split = img.split(",");
      const data = split.length > 1 ? split[1] : split[0];
      const mimeType = img.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
      return {
        inlineData: { mimeType, data }
      };
    });

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: [
          ...parts,
          { text: "Analyze the uploaded visual references and extract the stylistic design DNA for the carousel template. Determine their exact typography theme, color palettes, spacing, and image generation style." }
        ],
        config: {
          systemInstruction: "You are an expert digital design and typography analyst. Your task is to output style configs corresponding to visual reference examples in perfect JSON format.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Elegant human name for this custom style preset." },
              fontFamily: { type: Type.STRING, description: "Master typography font. Choose from 'Outfit', 'Plus Jakarta Sans', 'Space Grotesk', 'Inter', 'Bebas Neue' or similar system standard sans-serif fonts corresponding to the image." },
              accentColor: { type: Type.STRING, description: "The vibrant dominant HEX accent color extracted from references." },
              margins_mm: { type: Type.NUMBER, description: "Padding/margins layout value. Range between 12 to 24." },
              headlineSize: { type: Type.NUMBER, description: "Title font size extracted from design. Range between 40 to 80." },
              bodySize: { type: Type.NUMBER, description: "Body copy font size. Range between 14 to 28." },
              textAlign: { type: Type.STRING, enum: ["left", "center", "right"] },
              overlayOpacity: { type: Type.NUMBER, description: "Gradient darkness opacity. Decimal value between 0.3 to 0.95." },
              vibe: { type: Type.STRING, description: "Short descriptive artistic prompt modifier for the background imagery (e.g., 'minimalist bauhaus clean aesthetic with subtle grain')." }
            },
            required: ["name", "fontFamily", "accentColor", "margins_mm", "headlineSize", "bodySize", "textAlign", "overlayOpacity", "vibe"]
          }
        }
      });
    } catch (modelErr: any) {
      console.warn("Fallback to gemini-2.5-flash for analyze-design:", modelErr?.message || modelErr);
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          ...parts,
          { text: "Analyze the uploaded visual references and extract the stylistic design DNA for the carousel template. Determine their exact typography theme, color palettes, spacing, and image generation style." }
        ],
        config: {
          systemInstruction: "You are an expert digital design and typography analyst. Your task is to output style configs corresponding to visual reference examples in perfect JSON format.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Elegant human name for this custom style preset." },
              fontFamily: { type: Type.STRING, description: "Master typography font. Choose from 'Outfit', 'Plus Jakarta Sans', 'Space Grotesk', 'Inter', 'Bebas Neue' or similar system standard sans-serif fonts corresponding to the image." },
              accentColor: { type: Type.STRING, description: "The vibrant dominant HEX accent color extracted from references." },
              margins_mm: { type: Type.NUMBER, description: "Padding/margins layout value. Range between 12 to 24." },
              headlineSize: { type: Type.NUMBER, description: "Title font size extracted from design. Range between 40 to 80." },
              bodySize: { type: Type.NUMBER, description: "Body copy font size. Range between 14 to 28." },
              textAlign: { type: Type.STRING, enum: ["left", "center", "right"] },
              overlayOpacity: { type: Type.NUMBER, description: "Gradient darkness opacity. Decimal value between 0.3 to 0.95." },
              vibe: { type: Type.STRING, description: "Short descriptive artistic prompt modifier for the background imagery (e.g., 'minimalist bauhaus clean aesthetic with subtle grain')." }
            },
            required: ["name", "fontFamily", "accentColor", "margins_mm", "headlineSize", "bodySize", "textAlign", "overlayOpacity", "vibe"]
          }
        }
      });
    }

    const text = response.text;
    if (!text) {
      throw new Error("No analysis response content was received from the model.");
    }

    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Analysis Error in Design DNA service:", error);
    res.status(500).json({ error: error.message || "Design analysis failed." });
  }
});

/**
 * Safely sanitizes prompt history for Gemini models to prevent role validation exceptions.
 * It removes any leading model responses and merges consecutive identical-role messages.
 */
function sanitizeContents(historyList: any[]): any[] {
  const result: any[] = [];
  for (const m of historyList) {
    if (!m.text) continue;
    const role = m.role === "user" ? "user" : "model";
    
    if (result.length === 0) {
      if (role === "user") {
        result.push({ role, parts: [{ text: m.text }] });
      }
    } else {
      const last = result[result.length - 1];
      if (last.role === role) {
        last.parts[0].text += "\n" + m.text;
      } else {
        result.push({ role, parts: [{ text: m.text }] });
      }
    }
  }
  return result;
}

/**
 * Slide Carousel Content generation helper
 */
app.post("/api/generate-carousel", async (req, res) => {
  try {
    const { topic, history, spec, count = 7, intent } = req.body;
    const ai = getAI();

    // Perform clean, robust sanitization on history
    const contents = sanitizeContents(history || []);

    let intentGuideline = "";
    if (intent === "educational") {
      intentGuideline = "\nStructure the copy as a step-by-step tutorial or educational guide. Walk the reader logically from problem to solution with clear action items.";
    } else if (intent === "storytelling") {
      intentGuideline = "\nWrite in a storytelling framework. Start with a hook/anecdote, share the struggle/journey, and reveal a breakthrough lesson at the end.";
    } else if (intent === "checklist") {
      intentGuideline = "\nCreate a handy checklist, summary, or cheat sheet format. Focus on high-value tools, tips, or resource lists that are highly bookmarkable.";
    } else if (intent === "promotion") {
      intentGuideline = "\nStructure the copy for marketing conversion and product launching. Highlight pain points, introduce the product/service as the solution, and end with a strong Call-To-Action (CTA).";
    } else if (intent === "trends") {
      intentGuideline = "\nFocus on industry news, market trends, or recent updates. Provide insightful analysis or commentary on why this matters right now.";
    }

    // Add immediate request part
    const promptMessage = `Create exactly ${count} social media slides for a creative carousel about the topic: "${topic}". Ensure high conversion copywriting.${intentGuideline}
${spec ? `Adhere precisely to this Design DNA spec constraint: ${JSON.stringify(spec)}` : ""}`;

    if (contents.length > 0 && contents[contents.length - 1].role === "user") {
      // If the last message is from user, merge the final prompt design instructions with it
      contents[contents.length - 1].parts[0].text += "\n" + promptMessage;
    } else {
      // Otherwise list as a new user entry
      contents.push({
        role: "user",
        parts: [{ text: promptMessage }]
      });
    }

    let response;
    const carouselConfig = {
      systemInstruction: "You are an award-winning content marketer, social media copywriter, and digital slide deck architecture expert. Your goal is to deliver perfectly structured carousel config properties matching requested subjects.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          accentColor: { type: Type.STRING },
          fontFamily: { type: Type.STRING },
          aspectRatio: { type: Type.STRING, enum: ["1:1", "4:5"] },
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING, description: "Punchy slide title. Use curly braces around one or two key words for accent highlight (e.g. 'How to {Scale} Fast')." },
                body: { type: Type.STRING, description: "Detailed slide body text. Use curly braces around key phrases to underline (e.g. 'Use {automated workflows}')." },
                visualPrompt: { type: Type.STRING, description: "Specific vivid prompt describing background art matching the content tone." },
                layout: { type: Type.STRING, enum: ["center", "bottom-left", "split-vertical", "minimal", "bold-title"] }
              },
              required: ["headline", "body", "visualPrompt", "layout"]
            }
          }
        },
        required: ["title", "accentColor", "slides"]
      }
    };

    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents,
        config: carouselConfig
      });
    } catch (modelErr: any) {
      console.warn("Fallback to gemini-2.5-flash for generate-carousel:", modelErr?.message || modelErr);
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: carouselConfig
      });
    }

    const text = response.text;
    if (!text) {
      throw new Error("Empty response received from content generation model.");
    }

    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Carousel generation failed:", error);
    res.status(500).json({ error: error.message || "Failed to generate carousel contents." });
  }
});

/**
 * Smart Visual Prompt Builder — uses cheap text model to auto-generate
 * an optimised image generation prompt from the slide's content context.
 */
app.post("/api/enhance-visual-prompt", async (req, res) => {
  try {
    const { headline, body, visualPrompt, topic, intent, accentColor } = req.body;
    const ai = getAI();

    const systemInstruction = `You are a world-class art director and AI image prompt engineer.
Your role is to craft a concise, vivid, ultra-detailed image generation prompt for a slide background.
The image must:
- Work as a full-bleed, atmospheric background for a social media carousel slide
- Be abstract, non-literal, visual — no text, no faces unless specified
- Match the emotional tone and topic of the slide content
- Be optimised for the Gemini image generation model
- Output ONLY the raw prompt text. No explanation. No quotes. No markdown.`;

    const userMessage = `Generate an image background prompt for this slide:

TOPIC: ${topic || ""}
INTENT: ${intent || "educational"}
HEADLINE: ${headline || ""}
BODY: ${body || ""}
CURRENT PROMPT (to improve or replace): ${visualPrompt || "none"}
ACCENT COLOR HEX: ${accentColor || "#80a880"}

Generate a single, rich, detailed visual prompt (max 80 words) that perfectly matches this slide's content and emotional tone.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction,
        temperature: 0.85,
        maxOutputTokens: 200
      }
    });

    const enhanced = (response.text || "").trim();
    if (!enhanced) throw new Error("Empty response from model");

    res.json({ prompt: enhanced });
  } catch (error: any) {
    console.error("Visual prompt enhancement failed:", error);
    res.status(500).json({ error: error.message || "Failed to enhance visual prompt." });
  }
});

/**
 * Runtime Slide Visual Arts Image generation proxy
 */
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, aspectRatio, vibe } = req.body;
    const ai = getAI();

    // Mapping aspect ratio from standard slider sizes to supported gemini-2.5-flash-image ones
    const imageRatio = aspectRatio === "4:5" ? "3:4" : "1:1";

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: {
          parts: [{ text: `A professional, premium digital illustration, background or visual asset suitable for a high-quality presentation slide: ${prompt}. Esthetic style vibe: ${vibe || "modern gradient clean tech vector art style"}` }]
        },
        config: {
          imageConfig: {
            aspectRatio: imageRatio as any,
            imageSize: "1K"
          }
        }
      });
    } catch (errLite) {
      console.warn("Falling back to gemini-2.5-flash-image:", errLite);
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: `A professional, premium digital illustration, background or visual asset suitable for a high-quality presentation slide: ${prompt}. Esthetic style vibe: ${vibe || "modern gradient clean tech vector art style"}` }]
        },
        config: {
          imageConfig: {
            aspectRatio: imageRatio as any,
            imageSize: "1K"
          }
        }
      });
    }

    let imageUri = null;
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            imageUri = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
            break;
          }
        }
      }
    }

    if (!imageUri) {
      // Robust beautiful artistic placeholder fallback
      imageUri = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop";
    }

    res.json({ imageUri });
  } catch (error: any) {
    console.error("AI Slide Image draw failed:", error);
    // Graceful fallback response on error so the application never hangs
    res.json({ imageUri: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop" });
  }
});

/**
 * Slide Edit with AI Instruction helper
 */
app.post("/api/edit-slide", async (req, res) => {
  try {
    const { slide, instruction } = req.body;
    if (!slide || !instruction) {
      return res.status(400).json({ error: "Missing slide data or instruction." });
    }

    const ai = getAI();

    const prompt = `You are a social media copywriter and slide editor.
Given this current slide:
- Headline: "${slide.headline}"
- Body: "${slide.body}"
- Visual Concept: "${slide.visualPrompt}"
- Layout: "${slide.layout}"

Apply this user instruction: "${instruction}"

Rules:
- In the headline, surround 1-2 powerful accent words with curly braces, e.g. "Les 3 {Secrets}".
- In the body, surround key phrases with curly braces to underline, e.g. "Utilisez {l'automatisation}".
- Update the visualPrompt if relevant to the new content.
- Keep the response strictly JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are an expert presentation and social media copy editor. Output strictly JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING, description: "Updated headline with {accent} tags." },
            body: { type: Type.STRING, description: "Updated body with {accent} tags." },
            visualPrompt: { type: Type.STRING, description: "Updated visual prompt." },
            layout: { type: Type.STRING, enum: ["center", "bottom-left", "split-vertical", "minimal", "bold-title"] }
          },
          required: ["headline", "body", "visualPrompt", "layout"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response received from edit model.");
    }

    const updated = JSON.parse(text);
    res.json({
      ...slide,
      headline: updated.headline || slide.headline,
      body: updated.body || slide.body,
      visualPrompt: updated.visualPrompt || slide.visualPrompt,
      layout: updated.layout || slide.layout
    });
  } catch (error: any) {
    console.error("Edit slide AI failed:", error);
    res.status(500).json({ error: error.message || "Failed to edit slide." });
  }
});

// Vite SSR / Static Server setup
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        watch: {
          ignored: [
            "**/projects.json",
            "**/.projects.json",
            "**/numtema_projects.json",
            "**/*.log"
          ]
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA fallback — app.use() bypasses path-to-regexp entirely (Express 5 safe)
    app.use((req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully running on http://localhost:${PORT}`);
  });
}

startServer();
