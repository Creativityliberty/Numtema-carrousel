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

// Enable CORS for OpenAI Custom GPTs and external clients
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: "15mb" }));
registerMcpServer(app);

const PORT = 3000;

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: Date.now() });
});

// Dynamic OpenAPI Specification for ChatGPT Custom GPT Actions
app.get("/openapi.json", (req, res) => {
  const host = req.get("host") || "numtemacarrousel.coolify.dallico.com";
  const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const serverUrl = `${protocol}://${host}`;

  res.json({
    openapi: "3.1.0",
    info: {
      title: "Numtema Carousel Studio API",
      description: "API complète de création, batch generation, retouche et consultation de carrousels pour réseaux sociaux.",
      version: "1.2.0"
    },
    servers: [{ url: serverUrl }],
    paths: {
      "/api/projects": {
        get: {
          summary: "Récupérer tous les carrousels sauvegardés",
          operationId: "getProjects",
          responses: { "200": { description: "Liste des carrousels" } }
        },
        post: {
          summary: "Sauvegarder ou mettre à jour la liste complète des projets",
          operationId: "saveProjects",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "object" } }
              }
            }
          },
          responses: { "200": { description: "Sauvegardé avec succès" } }
        }
      },
      "/api/projects/{id}": {
        get: {
          summary: "Récupérer un carrousel spécifique par son identifiant",
          operationId: "getProjectById",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "L'identifiant du projet (ex: project-178759...)"
            }
          ],
          responses: {
            "200": { description: "Détails complets du carrousel" },
            "404": { description: "Projet non trouvé" }
          }
        },
        delete: {
          summary: "Supprimer un carrousel existant par son identifiant",
          operationId: "deleteProject",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "L'identifiant du projet à supprimer"
            }
          ],
          responses: { "200": { description: "Projet supprimé" } }
        }
      },
      "/api/generate-carousel": {
        post: {
          summary: "Générer un carrousel complet et l'enregistrer dans le Studio Numtema",
          description: "Génère un carrousel sur-mesure avec slides percutants, direction artistique d'image, auto-sauvegarde dans PostgreSQL, et renvoie la liste des slides avec les liens directs d'édition (editUrl) et de téléchargement ZIP (downloadUrl).",
          operationId: "generateCarousel",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    topic: { type: "string", description: "Le sujet, titre ou plan détaillé du carrousel" },
                    count: { type: "integer", default: 6, description: "Nombre de slides à générer (ex: 5, 6, 7)" },
                    intent: { 
                      type: "string", 
                      enum: ["educational", "storytelling", "checklist", "promotion", "trends"],
                      description: "Objectif éditorial du contenu"
                    },
                    targetAudience: {
                      type: "string",
                      description: "Public cible (ex: 'Fondateurs B2B', 'Coachs & Consultants', 'E-commerce', 'Freelances tech')"
                    },
                    imageStyle: {
                      type: "string",
                      description: "Direction artistique et style des images (ex: 'Rendu 3D émeraude minimaliste', 'Photographie studio cinématique', 'Abstrait tech futuristic')"
                    },
                    accentColor: {
                      type: "string",
                      description: "Couleur d'accent HEX (ex: '#80a880', '#FF6B6B', '#3B82F6')"
                    },
                    companyName: {
                      type: "string",
                      description: "Nom de l'entreprise ou marque affiché sur les slides (ex: 'Numtema Design')"
                    },
                    companyWebsite: {
                      type: "string",
                      description: "Site web ou handle social (ex: 'numtema.design')"
                    },
                    callToAction: {
                      type: "string",
                      description: "Appel à l'action final personnalisé sur le dernier slide"
                    },
                    autoGenerateImages: {
                      type: "boolean",
                      default: false,
                      description: "Si true, génère immédiatement les images d'arrière-plan en haute définition pour chaque slide."
                    }
                  },
                  required: ["topic"]
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Carrousel généré et sauvegardé. Contient les slides, prompts d'images, editUrl et downloadUrl.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      projectUrl: { type: "string", description: "Lien d'ouverture du projet dans le Studio" },
                      editUrl: { type: "string", description: "Lien d'édition et personnalisation dans le Studio" },
                      downloadUrl: { type: "string", description: "Lien de téléchargement direct du pack ZIP d'images" },
                      accentColor: { type: "string" },
                      slides: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            headline: { type: "string" },
                            body: { type: "string" },
                            visualPrompt: { type: "string", description: "Prompt visuel pour l'image de fond" },
                            layout: { type: "string" },
                            imageUri: { type: "string" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/generate-batch": {
        post: {
          summary: "Générer un lot de plusieurs carrousels simultanément (Batch Creation)",
          description: "Permet de générer plusieurs carrousels d'un seul coup (ex: pour un calendrier de contenu hebdomadaire) et retourne la liste de tous les projets sauvegardés avec leurs liens respectifs.",
          operationId: "generateBatchCarousels",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    carousels: {
                      type: "array",
                      description: "Liste des carrousels à générer avec leurs paramètres individuels",
                      items: {
                        type: "object",
                        properties: {
                          topic: { type: "string", description: "Sujet du carrousel" },
                          count: { type: "integer", default: 6 },
                          intent: { type: "string", enum: ["educational", "storytelling", "checklist", "promotion", "trends"] },
                          imageStyle: { type: "string" },
                          targetAudience: { type: "string" },
                          accentColor: { type: "string" },
                          callToAction: { type: "string" },
                          autoGenerateImages: { type: "boolean", default: false }
                        },
                        required: ["topic"]
                      }
                    },
                    topics: {
                      type: "array",
                      items: { type: "string" },
                      description: "Alternative simple : liste des sujets sous forme de tableau de chaînes"
                    }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Lot de carrousels générés avec succès.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      count: { type: "integer" },
                      projects: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            title: { type: "string" },
                            editUrl: { type: "string" },
                            downloadUrl: { type: "string" },
                            slidesCount: { type: "integer" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/enhance-visual-prompt": {
        post: {
          summary: "Générer un prompt artistique contextualisé pour un slide",
          operationId: "enhanceVisualPrompt",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    headline: { type: "string" },
                    body: { type: "string" },
                    topic: { type: "string" }
                  },
                  required: ["headline", "body"]
                }
              }
            }
          },
          responses: { "200": { description: "Prompt visuel" } }
        }
      },
      "/api/edit-slide": {
        post: {
          summary: "Retoucher un slide spécifique avec une consigne IA",
          operationId: "editSlide",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slide: { type: "object" },
                    instruction: { type: "string", description: "Consigne d'amélioration" }
                  },
                  required: ["slide", "instruction"]
                }
              }
            }
          },
          responses: { "200": { description: "Slide retouché" } }
        }
      }
    }
  });
});

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

// Helper to save a single project in DB and local file
async function persistProject(project: any) {
  if (pgPool) {
    try {
      await pgPool.query(
        "INSERT INTO numtema_projects (id, data, updated_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = $3;",
        [project.id, JSON.stringify(project), project.updatedAt || Date.now()]
      );
    } catch (dbErr) {
      console.warn("[Numtema] PostgreSQL persist warning:", dbErr);
    }
  }

  try {
    const existing = fs.existsSync(PROJECTS_FILE) ? JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf-8")) : [];
    const filtered = existing.filter((p: any) => p.id !== project.id);
    filtered.unshift(project);
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(filtered, null, 2));
  } catch (fErr) {
    console.warn("[Numtema] File persist warning:", fErr);
  }
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

app.get("/api/projects/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (pgPool) {
      try {
        const result = await pgPool.query("SELECT data FROM numtema_projects WHERE id = $1 LIMIT 1;", [id]);
        if (result.rows.length > 0) {
          return res.json(result.rows[0].data);
        }
      } catch (dbErr) {
        console.warn("[Numtema] PostgreSQL get by id fallback to file:", dbErr);
      }
    }
    const data: any[] = fs.existsSync(PROJECTS_FILE) ? JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf-8")) : [];
    const found = data.find(p => p.id === id);
    if (found) return res.json(found);
    res.status(404).json({ error: "Project not found" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load project" });
  }
});

app.delete("/api/projects/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (pgPool) {
      try {
        await pgPool.query("DELETE FROM numtema_projects WHERE id = $1;", [id]);
      } catch (dbErr) {
        console.warn("[Numtema] PostgreSQL delete warning:", dbErr);
      }
    }
    const data: any[] = fs.existsSync(PROJECTS_FILE) ? JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf-8")) : [];
    const filtered = data.filter(p => p.id !== id);
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(filtered, null, 2));
    res.json({ success: true, message: `Project ${id} deleted` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete project" });
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
 * Internal helper to generate a high quality slide image via Gemini or Pollinations fallback
 */
async function generateSlideImageInternal(prompt: string, aspectRatio: string = "4:5", vibe?: string): Promise<string> {
  const imageRatio = aspectRatio === "4:5" ? "3:4" : "1:1";
  const [w, h] = aspectRatio === "4:5" ? [1080, 1350] : [1080, 1080];
  const cleanPrompt = encodeURIComponent(`${prompt}, ${vibe || "modern aesthetic background, minimalist, high resolution"}`);
  const fallbackUri = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${w}&height=${h}&nologo=true`;

  try {
    const ai = getAI();
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

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          }
        }
      }
    }
    return fallbackUri;
  } catch (err) {
    return fallbackUri;
  }
}

/**
 * Core internal carousel generator function (used by both single and batch endpoints)
 */
async function generateCarouselInternal(params: {
  topic: string;
  history?: any[];
  spec?: any;
  count?: number;
  intent?: string;
  targetAudience?: string;
  imageStyle?: string;
  visualVibe?: string;
  accentColor?: string;
  companyName?: string;
  companyWebsite?: string;
  callToAction?: string;
  autoGenerateImages?: boolean;
}, serverUrl: string) {
  const {
    topic,
    history,
    spec,
    count = 6,
    intent,
    targetAudience,
    imageStyle,
    visualVibe,
    accentColor = "#80a880",
    companyName = "Numtema Design",
    companyWebsite = "numtema.design",
    callToAction,
    autoGenerateImages = false
  } = params;

  const effectiveVibe = imageStyle || visualVibe || spec?.vibe || "minimalist dark studio with elegant emerald green neon reflections, abstract 3D geometry, commercial aesthetic, 8k";
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

  const audienceGuideline = targetAudience ? `\nTarget Audience: Speak specifically to "${targetAudience}" using their vocabulary and addressing their daily friction points.` : "";
  const vibeInstruction = `\nBackground Visual Art Direction: "${effectiveVibe}". For each slide, write a rich visualPrompt describing background visuals adhering strictly to this aesthetic.`;
  const ctaInstruction = callToAction ? `\nFinal Slide Call-To-Action: Ensure the final slide concludes with this specific CTA: "${callToAction}".` : "";

  const promptMessage = `Create exactly ${count} social media slides for a creative carousel about the topic: "${topic}". Ensure high conversion copywriting.${intentGuideline}${audienceGuideline}${vibeInstruction}${ctaInstruction}
${spec ? `Adhere precisely to this Design DNA spec constraint: ${JSON.stringify(spec)}` : ""}`;

  if (contents.length > 0 && contents[contents.length - 1].role === "user") {
    contents[contents.length - 1].parts[0].text += "\n" + promptMessage;
  } else {
    contents.push({ role: "user", parts: [{ text: promptMessage }] });
  }

  let carouselData: any = null;

  try {
    const ai = getAI();
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
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents,
        config: carouselConfig
      });
      const text = response.text;
      if (text) carouselData = JSON.parse(text.trim());
    } catch (modelErr: any) {
      console.warn("Fallback to gemini-2.5-flash for generate-carousel:", modelErr?.message || modelErr);
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents,
          config: carouselConfig
        });
        const text = response.text;
        if (text) carouselData = JSON.parse(text.trim());
      } catch (fErr) {
        console.warn("Gemini model error, using resilient fallback template.");
      }
    }
  } catch (e) {
    console.warn("Gemini initialization warning, activating resilient smart generator fallback.");
  }

  // Resilient fallback if AI service was unavailable
  if (!carouselData) {
    const cleanTopic = topic.replace(/[{}"]/g, "").trim();
    const fallbackSlides = [
      {
        headline: `5 signes que ta {présence en ligne} te fait perdre des clients`,
        body: `Un prospect se fait un avis en 3 secondes. Si ton système digital a des failles, tes {opportunités s'envolent}.`,
        visualPrompt: `Minimalist dark studio with elegant emerald green neon reflections, abstract 3D geometry, commercial aesthetic, 8k.`,
        layout: "center"
      },
      {
        headline: `1. Ton site n'est pas {adapté au mobile}`,
        body: `Plus de 70% de tes visiteurs sont sur téléphone. Un design non responsive ou lent détruit instantanément {ta crédibilité}.`,
        visualPrompt: `Modern smartphone mockup showcasing ultra-clean UI design in a soft studio lighting atmosphere.`,
        layout: "bottom-left"
      },
      {
        headline: `2. Ton offre est {trop complexe}`,
        body: `Si un visiteur doit réfléchir plus de 5 secondes pour comprendre ce que tu vends, {il quitte la page}.`,
        visualPrompt: `Abstract minimalist maze resolving into a single glowing direct path, architectural lighting.`,
        layout: "split-vertical"
      },
      {
        headline: `3. Tu es invisible sur {Google}`,
        body: `Tes futurs clients recherchent activement tes compétences, mais ce sont {tes concurrents} qu'ils trouvent.`,
        visualPrompt: `Digital search analytics interface with illuminated metrics and high contrast tech aesthetic.`,
        layout: "bold-title"
      },
      {
        headline: `4. Aucun {parcours clair} pour te contacter`,
        body: `Formulaire à rallonge, absence de bouton d'action ou WhatsApp caché = {90% de prospects perdus}.`,
        visualPrompt: `Futuristic luminous doorway leading to an open modern terrace, warm ambient lighting.`,
        layout: "bottom-left"
      },
      {
        headline: `Fais passer ton business au {niveau supérieur}`,
        body: callToAction || `Ton activité mérite un écosystème qui convertit. {Numtema Design} construit ta présence sur-mesure.`,
        visualPrompt: `Sleek high-end creative agency workspace with panoramic windows, minimalist luxury aesthetic.`,
        layout: "center"
      }
    ];

    carouselData = {
      title: cleanTopic || "Carrousel Numtema",
      accentColor: accentColor || spec?.accentColor || "#80a880",
      fontFamily: spec?.fontFamily || "Outfit",
      aspectRatio: "4:5",
      slides: fallbackSlides.slice(0, count || 6)
    };
  }

  const projectId = `project-${Date.now()}-${Math.floor(Math.random()*1000)}`;

  // Process slides
  const processedSlides = (carouselData.slides || []).map((s: any, idx: number) => ({
    id: `slide-${idx}-${Date.now()}`,
    headline: s.headline,
    body: s.body,
    visualPrompt: s.visualPrompt,
    layout: s.layout || "center",
    overlayOpacity: 0.8,
    headlineSize: 34,
    bodySize: 16,
    contentPadding: 44,
    textAlign: s.layout === "center" ? "center" : "left",
    imageUri: s.imageUri
  }));

  // Auto-generate images in background if requested
  if (autoGenerateImages) {
    console.log(`[Numtema] Auto-generating ${processedSlides.length} images for project ${projectId}...`);
    for (let i = 0; i < processedSlides.length; i++) {
      if (processedSlides[i].visualPrompt) {
        processedSlides[i].imageUri = await generateSlideImageInternal(
          processedSlides[i].visualPrompt,
          carouselData.aspectRatio || "4:5",
          effectiveVibe
        );
      }
    }
  }

  const fullProject = {
    id: projectId,
    name: carouselData.title || topic,
    updatedAt: Date.now(),
    config: {
      id: projectId,
      title: carouselData.title || topic,
      accentColor: carouselData.accentColor || accentColor || "#80a880",
      fontFamily: carouselData.fontFamily || spec?.fontFamily || "Outfit",
      aspectRatio: (carouselData.aspectRatio as '1:1' | '4:5') || "4:5",
      theme: "light",
      branding: {
        companyName: companyName || "Numtema Design",
        companyWebsite: companyWebsite || "numtema.design",
        showBranding: true,
        logoSize: 27,
        fontSize: 13
      },
      slides: processedSlides
    },
    chatHistory: [{ role: "user", text: topic }]
  };

  await persistProject(fullProject);

  const projectUrl = `${serverUrl}/?project=${projectId}`;
  const editUrl = projectUrl;
  const downloadUrl = `${projectUrl}&export=true`;

  return {
    id: projectId,
    projectId,
    title: fullProject.name,
    accentColor: fullProject.config.accentColor,
    fontFamily: fullProject.config.fontFamily,
    aspectRatio: fullProject.config.aspectRatio,
    slides: fullProject.config.slides,
    slidesCount: fullProject.config.slides.length,
    projectUrl,
    editUrl,
    downloadUrl,
    exportUrl: downloadUrl,
    directLink: projectUrl,
    viewUrl: projectUrl,
    project: fullProject,
    message: `Carrousel créé et enregistré dans le Studio Numtema ! Lien pour modifier : ${editUrl} | Lien pour télécharger en ZIP : ${downloadUrl}`
  };
}

/**
 * Slide Carousel Content generation endpoint
 */
app.post("/api/generate-carousel", async (req, res) => {
  try {
    const host = req.get("host") || "numtemacarrousel.coolify.dallico.com";
    const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const serverUrl = `${protocol}://${host}`;

    const result = await generateCarouselInternal(req.body, serverUrl);
    res.json(result);
  } catch (error: any) {
    console.error("Carousel generation fatal error:", error);
    res.status(500).json({ error: error.message || "Failed to generate carousel contents." });
  }
});

/**
 * Batch Carousel Generation endpoint (generates multiple carousels at once)
 */
app.post("/api/generate-batch", async (req, res) => {
  try {
    const { carousels = [], topics = [] } = req.body;
    const host = req.get("host") || "numtemacarrousel.coolify.dallico.com";
    const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const serverUrl = `${protocol}://${host}`;

    let itemsToProcess: any[] = [];

    if (Array.isArray(carousels) && carousels.length > 0) {
      itemsToProcess = carousels;
    } else if (Array.isArray(topics) && topics.length > 0) {
      itemsToProcess = topics.map((t: string) => ({ topic: t }));
    }

    if (itemsToProcess.length === 0) {
      return res.status(400).json({ error: "Please provide an array of 'carousels' or 'topics'." });
    }

    console.log(`[Numtema] Generating batch of ${itemsToProcess.length} carousels...`);
    const results = [];

    for (const item of itemsToProcess) {
      try {
        const result = await generateCarouselInternal(item, serverUrl);
        results.push(result);
      } catch (err: any) {
        console.error(`Failed to generate carousel for topic "${item.topic}":`, err);
      }
    }

    res.json({
      success: true,
      count: results.length,
      projects: results
    });
  } catch (error: any) {
    console.error("Batch generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate batch carousels." });
  }
});

/**
 * Smart Visual Prompt Builder
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
    const imageUri = await generateSlideImageInternal(prompt, aspectRatio, vibe);
    res.json({ imageUri });
  } catch (error: any) {
    console.error("AI Slide Image draw failed:", error);
    res.status(500).json({ error: error.message || "Image generation failed" });
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
