import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenAI, Type } from "@google/genai";
import express from "express";
import fs from "fs";
import path from "path";
import os from "os";

// Initialize Gemini Client
const getAI = () => {
  let apiKey = (process.env.GEMINI_API_KEY || "AIzaSyCaQPMwGJg6VfKJt0Q8VEA3UJ9bjvrCiTA").trim().replace(/^["']|["']$/g, '');
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required. Please set GEMINI_API_KEY in your environment.");
  }
  return new GoogleGenAI({ apiKey });
};

// Clean prompt history helper
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

// Instantiate MCP Server
const server = new Server(
  {
    name: "numtema-design-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "analyze_design_dna",
        description: "Analyze visual design screenshots to extract a structured style config (typography, colors, padding, margins, visual vibe).",
        inputSchema: {
          type: "object",
          properties: {
            images: {
              type: "array",
              items: { type: "string" },
              description: "Array of design reference images (base64 data URIs or raw base64)."
            }
          },
          required: ["images"]
        }
      },
      {
        name: "generate_carousel",
        description: "Generates high-conversion structured social media carousel slides about a specific topic, conforming to design specifications.",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "The topic or concept of the carousel."
            },
            history: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string", enum: ["user", "model"] },
                  text: { type: "string" }
                },
                required: ["role", "text"]
              },
              description: "Optional chat history for progressive assistant dialogue."
            },
            spec: {
              type: "object",
              description: "Optional design DNA specification (Hex accent color, margins, font family, vibe)."
            },
            count: {
              type: "number",
              description: "Number of slides to generate (default: 7)."
            },
            intent: {
              type: "string",
              enum: ["educational", "storytelling", "checklist", "promotion", "trends"],
              description: "Optional copywriting intent preset."
            }
          },
          required: ["topic"]
        }
      },
      {
        name: "generate_image",
        description: "Generates a premium illustration/background for a presentation slide using Imagen/Gemini.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Visual description prompt for the image (under 15 words)."
            },
            aspectRatio: {
              type: "string",
              enum: ["1:1", "4:5"],
              description: "Target aspect ratio."
            },
            vibe: {
              type: "string",
              description: "Optional style vibe/aesthetic descriptor."
            }
          },
          required: ["prompt", "aspectRatio"]
        }
      },
      {
        name: "generate_caption",
        description: "Generate ready-to-publish social media captions (LinkedIn post, Instagram caption, hashtags) for a carousel.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Title of the carousel." },
            slides: { type: "array", items: { type: "object" }, description: "Array of slides." },
            targetAudience: { type: "string", description: "Target audience." },
            callToAction: { type: "string", description: "Call to action." }
          },
          required: ["title"]
        }
      },
      {
        name: "translate_carousel",
        description: "Translate all slides of a carousel into a target language (en, es, de, fr, it, pt) while preserving emphasis tags.",
        inputSchema: {
          type: "object",
          properties: {
            slides: { type: "array", items: { type: "object" }, description: "Array of slides to translate." },
            targetLanguage: { type: "string", enum: ["en", "es", "de", "fr", "it", "pt"], description: "Target ISO language code." }
          },
          required: ["slides", "targetLanguage"]
        }
      },
      {
        name: "delete_project",
        description: "Delete a saved carousel project by ID.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "The ID of the project to delete." }
          },
          required: ["projectId"]
        }
      },
      {
        name: "list_projects",
        description: "Retrieve a list of all saved carousel projects, including their names, IDs, and slide counts.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "get_project",
        description: "Get the full configuration, slides, branding, and chat history of a specific carousel project by ID.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "The unique ID of the project." }
          },
          required: ["projectId"]
        }
      },
      {
        name: "update_project",
        description: "Update the configuration, slides, or metadata of an existing project. Can update variables in bulk.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "The ID of the project to update." },
            updates: {
              type: "object",
              properties: {
                name: { type: "string" },
                config: { type: "object" }
              }
            }
          },
          required: ["projectId", "updates"]
        }
      }
    ]
  };
});

// Handle Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const ai = getAI();

  try {
    if (name === "analyze_design_dna") {
      const { images } = args as { images: string[] };
      if (!images || images.length === 0) {
        throw new Error("Missing images array.");
      }

      const parts = images.map((img: string) => {
        const split = img.split(",");
        const data = split.length > 1 ? split[1] : split[0];
        const mimeType = img.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
        return {
          inlineData: { mimeType, data }
        };
      });

      let response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          ...parts,
          { text: "Analyze the uploaded visual references and extract the stylistic design DNA. Determine their typography, dominant colors, and spacing." }
        ],
        config: {
          systemInstruction: "You are an expert digital design analyst. Output style configs in perfect JSON format.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              fontFamily: { type: Type.STRING },
              accentColor: { type: Type.STRING },
              margins_mm: { type: Type.NUMBER },
              headlineSize: { type: Type.NUMBER },
              bodySize: { type: Type.NUMBER },
              textAlign: { type: Type.STRING },
              overlayOpacity: { type: Type.NUMBER },
              vibe: { type: Type.STRING }
            },
            required: ["name", "fontFamily", "accentColor"]
          }
        }
      });

      return {
        content: [{ type: "text", text: response.text || "{}" }]
      };
    }

    if (name === "generate_carousel") {
      const { topic, history, spec, count = 7, intent } = args as { topic: string; history?: any[]; spec?: any; count?: number; intent?: string };
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

      const promptMessage = `Create exactly ${count} social media slides for a creative carousel about: "${topic}".${intentGuideline}
${spec ? `Adhere precisely to this Design DNA spec: ${JSON.stringify(spec)}` : ""}`;

      if (contents.length > 0 && contents[contents.length - 1].role === "user") {
        contents[contents.length - 1].parts[0].text += "\n" + promptMessage;
      } else {
        contents.push({ role: "user", parts: [{ text: promptMessage }] });
      }

      let response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: "You are an expert content copywriter and social media architect. Output carousel slide decks in perfect JSON format.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              accentColor: { type: Type.STRING },
              fontFamily: { type: Type.STRING },
              aspectRatio: { type: Type.STRING },
              slides: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    headline: { type: Type.STRING },
                    body: { type: Type.STRING },
                    visualPrompt: { type: Type.STRING },
                    layout: { type: Type.STRING }
                  },
                  required: ["headline", "body", "visualPrompt", "layout"]
                }
              }
            },
            required: ["title", "accentColor", "fontFamily", "aspectRatio", "slides"]
          }
        }
      });

      return {
        content: [{ type: "text", text: response.text || "{}" }]
      };
    }

    if (name === "generate_image") {
      const { prompt, aspectRatio, vibe } = args as { prompt: string; aspectRatio: string; vibe?: string };
      const imageRatio = aspectRatio === "4:5" ? "3:4" : "1:1";

      let response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: `A professional, premium digital illustration background: ${prompt}. Style: ${vibe || "modern gradient clean tech"}` }]
        },
        config: {
          imageConfig: {
            aspectRatio: imageRatio as any,
            imageSize: "1K"
          }
        }
      });

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

      return {
        content: [{ type: "text", text: JSON.stringify({ imageUri: imageUri || "" }) }]
      };
    }

    const PROJECTS_FILE = path.join(os.tmpdir(), "numtema_projects.json");
    const loadProjects = (): any[] => {
      if (!fs.existsSync(PROJECTS_FILE)) return [];
      try {
        const raw = fs.readFileSync(PROJECTS_FILE, "utf-8");
        return JSON.parse(raw) || [];
      } catch {
        return [];
      }
    };
    const saveProjects = (projects: any[]) => {
      fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
    };

    if (name === "list_projects") {
      const projects = loadProjects();
      const summary = projects.map((p: any) => ({
        id: p.id,
        name: p.name,
        slideCount: p.config?.slides?.length || 0,
        updatedAt: p.updatedAt
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }]
      };
    }

    if (name === "get_project") {
      const { projectId } = args as { projectId: string };
      const projects = loadProjects();
      const project = projects.find((p: any) => p.id === projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(project, null, 2) }]
      };
    }

    if (name === "update_project") {
      const { projectId, updates } = args as { projectId: string; updates: any };
      const projects = loadProjects();
      const index = projects.findIndex((p: any) => p.id === projectId);
      if (index === -1) {
        throw new Error(`Project not found: ${projectId}`);
      }
      
      const project = projects[index];
      const updatedProject = {
        ...project,
        ...updates,
        config: {
          ...project.config,
          ...updates.config
        },
        updatedAt: Date.now()
      };
      
      projects[index] = updatedProject;
      saveProjects(projects);

      return {
    if (name === "delete_project") {
      const { projectId } = args as { projectId: string };
      const projects = loadProjects();
      const filtered = projects.filter((p: any) => p.id !== projectId);
      saveProjects(filtered);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, message: `Project ${projectId} deleted.` }) }]
      };
    }

    if (name === "generate_caption") {
      const { title, slides = [], targetAudience, callToAction } = args as any;
      const slideSummaries = slides.map((s: any, idx: number) => `Slide ${idx+1}: ${s.headline} - ${s.body}`).join("\n");
      const prompt = `You are a social media copywriter. Generate LinkedIn and Instagram post copy for this carousel: Title: "${title}". Target: "${targetAudience || 'B2B'}". CTA: "${callToAction || ''}". Slides:\n${slideSummaries}. Return JSON with linkedin, instagram, hashtags.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });
      return {
        content: [{ type: "text", text: response.text || "{}" }]
      };
    }

    if (name === "translate_carousel") {
      const { slides = [], targetLanguage = "en" } = args as any;
      const prompt = `Translate each slide headline and body into language ${targetLanguage}, preserving curly braces {tags}. Slides: ${JSON.stringify(slides)}. Return JSON with array of translatedSlides.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });
      return {
        content: [{ type: "text", text: response.text || "{}" }]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: error.message || "Execution failed." }]
    };
  }
});

// Express route registration helper for SSE connection (remote)
export function registerMcpServer(app: express.Express) {
  let transport: SSEServerTransport | null = null;

  app.get("/sse", async (req, res) => {
    console.log("MCP SSE: Client connected");
    transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send("No active SSE session.");
    }
  });
}

// Running as a standalone CLI script for local stdio connection
if (process.argv[1] && (process.argv[1].endsWith("mcpServer.ts") || process.argv[1].endsWith("mcpServer.js"))) {
  console.error("Starting Numtema Design MCP Server in STDIO mode...");
  const stdioTransport = new StdioServerTransport();
  server.connect(stdioTransport).catch((err) => {
    console.error("MCP Server Error:", err);
  });
}
