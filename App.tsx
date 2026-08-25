import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, Settings, Image as ImageIcon, Download, Plus, Trash2, 
  ChevronLeft, ChevronRight, Cpu, Loader2, Zap, Camera, Upload, X, 
  CheckCircle2, Share2, Sun, Moon, Maximize2, FileJson, 
  MousePointer2, Layout as LayoutIcon, AlignLeft, AlignCenter, AlignRight,
  Building2, Send, RotateCw, Copy, Check, Grid, Briefcase, History,
  ArrowRight, Layers, Palette, Type as TypeIcon, Link as LinkIcon, Globe,
  FileText, MessageSquare, ExternalLink, Play, Film, Flame, BarChart2, Radio
} from 'lucide-react';
import { CarouselConfig, Slide, GenerationState, LayoutType, TextAlign, ChatMessage, Project, DesignSpec, DEFAULT_BRANDING, CarouselIntent, SocialCaptions } from './types';
import { generateCarouselContent, generateSlideImage, analyzeDesignADN, editSlideWithAI } from './geminiService';
import JSZip from 'jszip';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';

// Components
import { Button } from './src/components/CoreButton';
import { SlidePreview } from './src/components/SlidePreview';
import { ProjectExplorer } from './src/components/ProjectExplorer';
import { BrandingSettings } from './src/components/BrandingSettings';
import { DesignSpecsSettings } from './src/components/DesignSpecsSettings';

const normalizeProject = (p: any): Project => ({
  ...p,
  config: {
    accentColor: p.config?.accentColor || "#80a880",
    fontFamily: p.config?.fontFamily || "Outfit",
    theme: p.config?.theme || "light",
    aspectRatio: p.config?.aspectRatio || "4:5",
    branding: {
      ...DEFAULT_BRANDING,
      ...p.config?.branding
    },
    ...p.config,
    slides: (p.config?.slides || []).map((s: any) => ({
      layout: 'center',
      overlayOpacity: 0.8,
      headlineSize: 34,
      bodySize: 16,
      contentPadding: 44,
      textAlign: 'left',
      ...s
    }))
  }
});

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('carouselfuzz_projects');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeProject) : [];
    } catch (e) {
      return [];
    }
  });

  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [copiedStyle, setCopiedStyle] = useState<{
    headlineSize: number;
    bodySize: number;
    contentPadding: number;
    layout: LayoutType;
    overlayOpacity: number;
  } | null>(null);

  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [selectedIntent, setSelectedIntent] = useState<CarouselIntent>('educational');
  const [slideInstruction, setSlideInstruction] = useState('');
  const [isEditingSlide, setIsEditingSlide] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isArchitectFlow, setIsArchitectFlow] = useState(false);
  const [architectImages, setArchitectImages] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [customSpec, setCustomSpec] = useState<DesignSpec | undefined>();
  
  // Advanced features state
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isCaptionModalOpen, setIsCaptionModalOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCopiedText, setIsCopiedText] = useState<string | null>(null);
  const [captions, setCaptions] = useState<SocialCaptions | null>(null);

  // Viral Auditor state
  const [isViralModalOpen, setIsViralModalOpen] = useState(false);
  const [viralAudit, setViralAudit] = useState<any>(null);
  const [isAuditingViral, setIsAuditingViral] = useState(false);

  // Repurposer state
  const [isRepurposeModalOpen, setIsRepurposeModalOpen] = useState(false);
  const [repurposeForm, setRepurposeForm] = useState({
    sourceType: 'url' as 'url' | 'youtube' | 'text',
    sourceValue: '',
    targetAudience: 'Fondateurs & Créateurs B2B',
    tone: 'educational' as any
  });
  const [isRepurposing, setIsRepurposing] = useState(false);

  // Webhook / Publish state
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('numtema_webhook_url') || '');
  const [isPublishingWebhook, setIsPublishingWebhook] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);

  const [genState, setGenState] = useState<GenerationState>({
    isGeneratingContent: false,
    isGeneratingImages: false,
    isAnalyzingDesign: false,
    progress: 0
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Persistence & URL routing
  useEffect(() => {
    fetch("/api/projects")
      .then(res => res.json())
      .then(data => {
         if (Array.isArray(data) && data.length > 0) {
            const normalized = data.map(normalizeProject);
            setProjects(normalized);
            localStorage.setItem('carouselfuzz_projects', JSON.stringify(normalized));

            const params = new URLSearchParams(window.location.search);
            const targetId = params.get('project') || params.get('id');
            const previewRequested = params.get('mode') === 'preview' || params.get('preview') === 'true';
            
            if (targetId) {
              const matched = normalized.find(p => p.id === targetId);
              if (matched) {
                setCurrentProject(matched);
                setChatHistory(matched.chatHistory || []);
                if (matched.config?.captions) {
                  setCaptions(matched.config.captions);
                }
                if (previewRequested) {
                  setIsPreviewMode(true);
                }
                if (params.get('export') === 'true') {
                  setTimeout(() => {
                    const btn = document.getElementById('btn-export-pack');
                    if (btn) btn.click();
                  }, 1200);
                } else if (params.get('export') === 'pdf') {
                  setTimeout(() => {
                    const btn = document.getElementById('btn-export-pdf');
                    if (btn) btn.click();
                  }, 1200);
                }
              }
            }
         }
      })
      .catch(err => console.error("Error loading backend projects:", err));
  }, []);

  useEffect(() => {
    if (currentProject) {
      const modeParam = isPreviewMode ? '&mode=preview' : '';
      window.history.replaceState(null, '', `?project=${currentProject.id}${modeParam}`);
    } else {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [currentProject?.id, isPreviewMode]);

  useEffect(() => {
    localStorage.setItem('carouselfuzz_projects', JSON.stringify(projects));
    fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projects)
    }).catch(err => console.error("Error syncing projects to backend:", err));
  }, [projects]);

  useEffect(() => {
    if (currentProject) {
      setProjects(prev => prev.map(p => p.id === currentProject.id ? currentProject : p));
    }
  }, [currentProject?.config, currentProject?.chatHistory]);

  const saveProject = useCallback((config: CarouselConfig, history: ChatMessage[]) => {
    const newProject: Project = { 
      id: config.id, 
      name: config.title, 
      updatedAt: Date.now(), 
      config, 
      chatHistory: history 
    };
    setProjects(prev => [newProject, ...prev.filter(p => p.id !== config.id)]);
    setCurrentProject(newProject);
  }, []);

  const handleCreateNew = (type: 'flash' | 'architect') => {
    setChatHistory([]);
    setCustomSpec(undefined);
    setArchitectImages([]);
    setIsArchitectFlow(type === 'architect');
    setIsAgentOpen(true);
  };

  const handleCopyStyle = () => {
    if (!currentProject) return;
    const slide = currentProject.config.slides[currentIdx];
    setCopiedStyle({
      headlineSize: slide.headlineSize ?? 34,
      bodySize: slide.bodySize ?? 16,
      contentPadding: slide.contentPadding ?? 44,
      layout: slide.layout || 'center',
      overlayOpacity: slide.overlayOpacity ?? 0.8
    });
  };

  const handlePasteStyleToAll = () => {
    if (!currentProject || !copiedStyle) return;
    const updatedSlides = currentProject.config.slides.map(s => ({
      ...s,
      headlineSize: copiedStyle.headlineSize,
      bodySize: copiedStyle.bodySize,
      contentPadding: copiedStyle.contentPadding,
      layout: copiedStyle.layout,
      overlayOpacity: copiedStyle.overlayOpacity
    }));
    setCurrentProject({
      ...currentProject,
      config: { ...currentProject.config, slides: updatedSlides }
    });
  };

  const handleApplyToAll = () => {
    if (!currentProject) return;
    const srcConfig = currentProject.config;
    const activeSlide = srcConfig.slides[currentIdx] || srcConfig.slides[0];

    const targetHeadlineSize = activeSlide?.headlineSize ?? 34;
    const targetBodySize = activeSlide?.bodySize ?? 16;
    const targetPadding = activeSlide?.contentPadding ?? 44;
    const targetLayout = activeSlide?.layout || 'center';
    const targetOpacity = activeSlide?.overlayOpacity ?? 0.8;

    const updatedProjects = projects.map(p => {
      const updatedSlides = (p.config.slides || []).map(s => ({
        ...s,
        headlineSize: targetHeadlineSize,
        bodySize: targetBodySize,
        contentPadding: targetPadding,
        layout: targetLayout,
        overlayOpacity: targetOpacity
      }));

      return {
        ...p,
        config: {
          ...p.config,
          accentColor: srcConfig.accentColor,
          fontFamily: srcConfig.fontFamily,
          theme: srcConfig.theme,
          branding: { ...srcConfig.branding },
          slides: updatedSlides
        }
      };
    });

    setProjects(updatedProjects);
    const updatedActive = updatedProjects.find(p => p.id === currentProject.id);
    if (updatedActive) {
      setCurrentProject(updatedActive);
    }
  };

  const handleGenerate = async () => {
    if (!currentPrompt.trim()) return;
    const history: ChatMessage[] = [...chatHistory, { role: 'user', text: currentPrompt }];
    setChatHistory(history);
    const topic = currentPrompt;
    setCurrentPrompt('');
    setGenState(p => ({ ...p, isGeneratingContent: true }));
    
    try {
      const config = await generateCarouselContent(topic, history, customSpec, 6, selectedIntent);
      saveProject(config, history);
      setIsAgentOpen(false);
    } catch (e: any) {
      const errMsg = e?.message || e?.toString() || "Unknown error.";
      setChatHistory(prev => [...prev, { role: 'model', text: `Erreur : ${errMsg}` }]);
    } finally {
      setGenState(p => ({ ...p, isGeneratingContent: false }));
    }
  };

  // Repurposer submission
  const handleRepurposeSubmit = async () => {
    if (!repurposeForm.sourceValue.trim()) return;
    setIsRepurposing(true);
    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(repurposeForm)
      });
      const data = await res.json();
      if (data.project) {
        setProjects(prev => [normalizeProject(data.project), ...prev]);
        setCurrentProject(normalizeProject(data.project));
        setIsRepurposeModalOpen(false);
      } else {
        throw new Error(data.error || "Échec de l'extraction");
      }
    } catch (e: any) {
      alert("Erreur repurposer : " + (e?.message || e));
    } finally {
      setIsRepurposing(false);
    }
  };

  // Viral Score Auditor
  const handleRunViralAudit = async () => {
    if (!currentProject) return;
    setIsAuditingViral(true);
    setIsViralModalOpen(true);
    try {
      const res = await fetch("/api/audit-viral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: currentProject.config.title,
          slides: currentProject.config.slides
        })
      });
      const data = await res.json();
      setViralAudit(data);
    } catch (e: any) {
      alert("Erreur audit viral : " + (e?.message || e));
    } finally {
      setIsAuditingViral(false);
    }
  };

  const handleApplyHookVariation = (newHeadline: string) => {
    if (!currentProject) return;
    const slides = [...currentProject.config.slides];
    slides[0] = { ...slides[0], headline: newHeadline };
    setCurrentProject({
      ...currentProject,
      config: { ...currentProject.config, title: newHeadline.replace(/[{}]/g, ''), slides }
    });
    alert("Accroche mise à jour avec succès sur le premier slide !");
  };

  // Webhook Dispatcher
  const handleDispatchWebhook = async () => {
    if (!currentProject || !webhookUrl.trim()) return;
    setIsPublishingWebhook(true);
    setPublishStatus(null);
    localStorage.setItem('numtema_webhook_url', webhookUrl);
    try {
      const res = await fetch("/api/publish-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl,
          project: currentProject,
          platform: "linkedin"
        })
      });
      const data = await res.json();
      if (data.success) {
        setPublishStatus("✅ Carrousel & Captions transmis avec succès au webhook !");
      } else {
        setPublishStatus(`⚠️ Statut webhook : ${data.statusCode} (${data.message})`);
      }
    } catch (e: any) {
      setPublishStatus("❌ Erreur : " + (e?.message || e));
    } finally {
      setIsPublishingWebhook(false);
    }
  };

  // Animated Motion Video MP4 Export
  const handleExportVideo = async () => {
    if (!currentProject || isExportingVideo) return;
    setIsExportingVideo(true);
    setVideoProgress(0);

    try {
      const slides = currentProject.config.slides;
      const isSquare = currentProject.config.aspectRatio === '1:1';
      const canvasWidth = 1080;
      const canvasHeight = isSquare ? 1080 : 1350;

      // Capture all slide images first
      const slideImages: HTMLImageElement[] = [];
      const originalIdx = currentIdx;

      for (let i = 0; i < slides.length; i++) {
        setCurrentIdx(i);
        await new Promise(r => setTimeout(r, 500));
        const el = document.getElementById(`capture-${slides[i].id}`);
        if (el) {
          const dataUrl = await htmlToImage.toPng(el, { quality: 1, pixelRatio: 1.5 });
          const img = new Image();
          await new Promise<void>(resolve => {
            img.onload = () => resolve();
            img.src = dataUrl;
          });
          slideImages.push(img);
        }
        setVideoProgress(Math.round(((i + 1) / (slides.length * 2)) * 100));
      }
      setCurrentIdx(originalIdx);

      // Create offscreen video canvas
      const videoCanvas = document.createElement('canvas');
      videoCanvas.width = canvasWidth;
      videoCanvas.height = canvasHeight;
      const ctx = videoCanvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context error");

      const stream = videoCanvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.start();

      const slideDurationMs = 3000;
      const transitionDurationMs = 600;
      const totalSlides = slideImages.length;
      const totalDurationMs = totalSlides * slideDurationMs;
      const startTime = performance.now();

      await new Promise<void>((resolve) => {
        const drawFrame = (now: number) => {
          const elapsed = now - startTime;
          if (elapsed >= totalDurationMs) {
            recorder.stop();
            resolve();
            return;
          }

          const currentSlideIdx = Math.min(Math.floor(elapsed / slideDurationMs), totalSlides - 1);
          const slideElapsed = elapsed % slideDurationMs;
          const nextSlideIdx = (currentSlideIdx + 1) % totalSlides;

          ctx.clearRect(0, 0, canvasWidth, canvasHeight);

          // Draw current slide image
          const currentImg = slideImages[currentSlideIdx];
          ctx.drawImage(currentImg, 0, 0, canvasWidth, canvasHeight);

          // Draw transition to next slide if near the end of slide
          if (slideElapsed > slideDurationMs - transitionDurationMs && currentSlideIdx < totalSlides - 1) {
            const progress = (slideElapsed - (slideDurationMs - transitionDurationMs)) / transitionDurationMs;
            ctx.save();
            ctx.globalAlpha = progress;
            const nextImg = slideImages[nextSlideIdx];
            ctx.drawImage(nextImg, 0, 0, canvasWidth, canvasHeight);
            ctx.restore();
          }

          // Top progress bar
          const overallProgress = elapsed / totalDurationMs;
          ctx.fillStyle = currentProject.config.accentColor || "#80a880";
          ctx.fillRect(0, 0, canvasWidth * overallProgress, 14);

          setVideoProgress(50 + Math.round(overallProgress * 50));
          requestAnimationFrame(drawFrame);
        };
        requestAnimationFrame(drawFrame);
      });

      recorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: 'video/webm' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(videoBlob);
        const cleanTitle = (currentProject.config.title || "Carrousel_Numtema").replace(/[^a-zA-Z0-9_-]/g, "_");
        a.download = `${cleanTitle}_Motion_Video.webm`;
        a.click();
        setIsExportingVideo(false);
      };
    } catch (e: any) {
      alert("Erreur export vidéo : " + (e?.message || e));
      setIsExportingVideo(false);
    }
  };

  // ZIP Image Pack Export
  const handleExport = async () => {
    if (!currentProject) return;
    setIsExporting(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`${currentProject.name.replace(/\s+/g, '_')}`);
      const originalIdx = currentIdx;
      
      for (let i = 0; i < currentProject.config.slides.length; i++) {
        setCurrentIdx(i);
        await new Promise(r => setTimeout(r, 600));
        const el = document.getElementById(`capture-${currentProject.config.slides[i].id}`);
        if (el) {
          const dataUrl = await htmlToImage.toPng(el, { quality: 1, pixelRatio: 2 });
          folder?.file(`slide-${i+1}.png`, dataUrl.split(',')[1], { base64: true });
        }
      }
      
      setCurrentIdx(originalIdx);
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${currentProject.name}_carousel.zip`;
      a.click();
    } catch (e: any) { 
      console.error("Export failed:", e);
    } finally { 
      setIsExporting(false); 
    }
  };

  // Multi-page LinkedIn PDF Export
  const handleExportPdf = async () => {
    if (!currentProject || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const slides = currentProject.config.slides;
      const isSquare = currentProject.config.aspectRatio === '1:1';
      const pdfWidth = 1080;
      const pdfHeight = isSquare ? 1080 : 1350;

      const pdf = new jsPDF({
        orientation: isSquare ? 'landscape' : 'portrait',
        unit: 'px',
        format: [pdfWidth, pdfHeight]
      });

      const originalIdx = currentIdx;
      for (let i = 0; i < slides.length; i++) {
        setCurrentIdx(i);
        await new Promise(r => setTimeout(r, 600));
        const el = document.getElementById(`capture-${slides[i].id}`);
        if (el) {
          const dataUrl = await htmlToImage.toPng(el, { quality: 0.95, pixelRatio: 1.5 });
          if (i > 0) {
            pdf.addPage([pdfWidth, pdfHeight], isSquare ? 'landscape' : 'portrait');
          }
          pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
        }
      }

      setCurrentIdx(originalIdx);
      const cleanTitle = (currentProject.config.title || "Carrousel_Numtema").replace(/[^a-zA-Z0-9_-]/g, "_");
      pdf.save(`${cleanTitle}_LinkedIn.pdf`);
    } catch (e: any) {
      alert("Erreur export PDF : " + (e?.message || e));
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Social Captions Generator
  const handleOpenCaptions = async () => {
    if (!currentProject) return;
    setIsCaptionModalOpen(true);
    if (!captions) {
      try {
        const res = await fetch("/api/generate-caption", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: currentProject.config.title,
            slides: currentProject.config.slides
          })
        });
        const data = await res.json();
        setCaptions(data);
      } catch (err) {
        console.error("Caption generation error:", err);
      }
    }
  };

  // 1-Click Multilingual Translator
  const handleTranslate = async (targetLang: string) => {
    if (!currentProject || isTranslating) return;
    setIsTranslating(true);
    try {
      const res = await fetch("/api/translate-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slides: currentProject.config.slides,
          targetLanguage: targetLang
        })
      });
      const data = await res.json();
      if (data.slides) {
        setCurrentProject(prev => prev ? {
          ...prev,
          config: { ...prev.config, slides: data.slides }
        } : null);
      }
    } catch (e: any) {
      alert("Erreur traduction : " + (e?.message || e));
    } finally {
      setIsTranslating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setIsCopiedText(label);
    setTimeout(() => setIsCopiedText(null), 2000);
  };

  const updateSlide = (updates: Partial<Slide>) => {
    if (!currentProject) return;
    const slides = [...currentProject.config.slides];
    slides[currentIdx] = { ...slides[currentIdx], ...updates };
    setCurrentProject({ ...currentProject, config: { ...currentProject.config, slides } });
  };

  const updateBranding = (updates: Partial<typeof DEFAULT_BRANDING>) => {
    if (!currentProject) return;
    const branding = { ...currentProject.config.branding, ...updates };
    setCurrentProject({ ...currentProject, config: { ...currentProject.config, branding } });
  };

  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const handleEnhanceVisualPrompt = async () => {
    if (!currentProject) return;
    const slide = currentProject.config.slides[currentIdx];
    setIsEnhancingPrompt(true);
    try {
      const res = await fetch("/api/enhance-visual-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: slide.headline,
          body: slide.body,
          visualPrompt: slide.visualPrompt,
          topic: currentProject.config.title,
          intent: currentProject.config.intent || "educational",
          accentColor: currentProject.config.accentColor
        })
      });
      const data = await res.json();
      if (data.prompt) {
        updateSlide({ visualPrompt: data.prompt });
      }
    } catch (e: any) {
      alert("Erreur prompt IA : " + (e?.message || e));
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  const [isGeneratingSingleImage, setIsGeneratingSingleImage] = useState(false);
  const handleGenerateSingleImage = async () => {
    if (!currentProject) return;
    const slide = currentProject.config.slides[currentIdx];
    if (!slide.visualPrompt?.trim()) {
      alert("Veuillez saisir une description ou cliquer sur ✨ Générer.");
      return;
    }
    setIsGeneratingSingleImage(true);
    try {
      const uri = await generateSlideImage(
        slide.visualPrompt,
        currentProject.config.aspectRatio,
        currentProject.config.customSpec?.vibe
      );
      updateSlide({ imageUri: uri });
    } catch (e: any) {
      alert("Erreur de génération : " + (e?.message || e));
    } finally {
      setIsGeneratingSingleImage(false);
    }
  };

  const handleUploadSlideImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const uri = event.target?.result as string;
      if (uri) {
        updateSlide({ imageUri: uri });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEditSlideWithAI = async () => {
    if (!currentProject || !slideInstruction.trim()) return;
    setIsEditingSlide(true);
    try {
      const activeSlide = currentProject.config.slides[currentIdx];
      const updated = await editSlideWithAI(activeSlide, slideInstruction);
      updateSlide(updated);
      setSlideInstruction('');
    } catch (e: any) {
      alert("Retouche échouée : " + (e?.message || e));
    } finally {
      setIsEditingSlide(false);
    }
  };

  const handleBuildArt = async () => {
    if (!currentProject) return;
    setGenState(p => ({ ...p, isGeneratingImages: true, progress: 0 }));
    try {
      const slides = [...currentProject.config.slides];
      for (let i = 0; i < slides.length; i++) {
        const uri = await generateSlideImage(slides[i].visualPrompt, currentProject.config.aspectRatio, currentProject.config.customSpec?.vibe);
        slides[i] = { ...slides[i], imageUri: uri };
        setCurrentProject(prev => prev ? { ...prev, config: { ...prev.config, slides: [...slides] } } : null);
        setGenState(prev => ({ ...prev, progress: Math.round(((i+1)/slides.length)*100) }));
      }
    } finally {
      setGenState(p => ({ ...p, isGeneratingImages: false }));
    }
  };

  const isLight = !currentProject || currentProject.config.theme === 'light';

  // ── Mode Client Preview (Épuré et Fullscreen) ──
  if (currentProject && isPreviewMode) {
    return (
      <div className={`min-h-screen ${isLight ? 'bg-slate-950 text-white' : 'bg-black text-white'} flex flex-col items-center justify-between p-6 md:p-10 select-none`}>
        <header className="w-full max-w-4xl flex items-center justify-between z-50">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-teal-500 animate-ping" />
            <span className="text-xs font-black tracking-widest uppercase text-slate-300">{currentProject.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPreviewMode(false)}
              className="px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-xs font-bold transition-all cursor-pointer"
            >
              Éditeur Studio
            </button>
            <Button size="sm" variant="white" onClick={handleExportPdf} disabled={isExportingPdf}>
              {isExportingPdf ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />} PDF LinkedIn
            </Button>
          </div>
        </header>

        <div className="relative flex flex-col items-center my-auto">
          <div className="shadow-[0_50px_100px_-20px_rgba(0,0,0,0.9)] rounded-[2.5rem] overflow-hidden border border-white/10">
            <SlidePreview slide={currentProject.config.slides[currentIdx]} config={currentProject.config} />
          </div>

          <div className="flex items-center gap-4 mt-6 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full border border-white/15 shadow-2xl">
            <button 
              onClick={() => setCurrentIdx(p => Math.max(0, p-1))}
              disabled={currentIdx === 0}
              className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 cursor-pointer transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-xs font-black tracking-widest uppercase px-2">{currentIdx + 1} / {currentProject.config.slides.length}</span>
            <button 
              onClick={() => setCurrentIdx(p => Math.min(currentProject.config.slides.length - 1, p+1))}
              disabled={currentIdx === currentProject.config.slides.length - 1}
              className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 cursor-pointer transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <footer className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
          Conçu avec Numtema Design • numtema.design
        </footer>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-50'} transition-all font-sans overflow-hidden`}>
      {!currentProject ? (
        <ProjectExplorer 
          projects={projects} 
          onSelect={p => { setCurrentProject(p); setChatHistory(p.chatHistory || []); }}
          onDelete={id => setProjects(prev => prev.filter(p => p.id !== id))}
          onCreateNew={handleCreateNew}
          onOpenRepurposer={() => setIsRepurposeModalOpen(true)}
        />
      ) : (
        <div className="flex h-screen overflow-hidden">
          {/* Left Project Sidebar */}
          <aside className={`w-80 border-r ${isLight ? 'border-slate-200 bg-white/80' : 'border-white/5 bg-slate-950/80'} backdrop-blur-xl flex flex-col justify-between p-6 z-40`}>
            <div className="space-y-6 overflow-y-auto pr-2">
              <div className="flex items-center justify-between">
                <button onClick={() => setCurrentProject(null)} className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-teal-500 transition-colors cursor-pointer">
                  <ChevronLeft size={16} /> Projets
                </button>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setIsRepurposeModalOpen(true)} className="p-2 rounded-xl bg-teal-500/10 text-teal-500 hover:bg-teal-500 hover:text-white transition-all cursor-pointer" title="Repurposer URL / Doc">
                    <Cpu size={16} />
                  </button>
                  <button onClick={() => handleCreateNew('flash')} className="p-2 rounded-xl bg-teal-500/10 text-teal-500 hover:bg-teal-500 hover:text-white transition-all cursor-pointer" title="Nouveau carrousel">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Diapositives ({currentProject.config.slides.length})</label>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {currentProject.config.slides.map((s, idx) => (
                    <div 
                      key={s.id || idx}
                      onClick={() => setCurrentIdx(idx)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${currentIdx === idx ? 'border-teal-500 bg-teal-500/10 shadow-sm' : isLight ? 'border-slate-200 hover:bg-slate-100' : 'border-white/5 hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${currentIdx === idx ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>{idx + 1}</span>
                        <span className="text-xs font-bold truncate max-w-[140px]">{s.headline.replace(/[{}]/g, '') || `Slide ${idx+1}`}</span>
                      </div>
                      {currentProject.config.slides.length > 1 && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newSlides = currentProject.config.slides.filter((_, i) => i !== idx);
                            setCurrentProject({ ...currentProject, config: { ...currentProject.config, slides: newSlides } });
                            setCurrentIdx(prev => Math.min(prev, newSlides.length - 1));
                          }}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const newSlide: Slide = {
                      id: `slide-${currentProject.config.slides.length}-${Date.now()}`,
                      headline: "Nouvelle {Idée}",
                      body: "Développez votre argument avec précision.",
                      visualPrompt: "Clean modern abstract 3d geometry background",
                      layout: "center",
                      overlayOpacity: 0.8,
                      headlineSize: 34,
                      bodySize: 16,
                      contentPadding: 44,
                      textAlign: 'center'
                    };
                    const updated = [...currentProject.config.slides, newSlide];
                    setCurrentProject({ ...currentProject, config: { ...currentProject.config, slides: updated } });
                    setCurrentIdx(updated.length - 1);
                  }}
                  className={`w-full py-2.5 rounded-xl border border-dashed text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${isLight ? 'border-slate-300 hover:border-teal-500 text-slate-600' : 'border-white/20 hover:border-teal-500 text-slate-300'}`}
                >
                  <Plus size={14} /> Ajouter un slide
                </button>
              </div>
            </div>

            <footer className="pt-4 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Numtema Studio</span>
              <Button variant="ghost" size="sm" onClick={() => setCurrentProject({...currentProject, config: {...currentProject.config, theme: currentProject.config.theme === 'dark' ? 'light' : 'dark'}})}>
                {currentProject.config.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </Button>
            </footer>
          </aside>

          {/* Main Workspace Canvas */}
          <main className={`flex-1 flex flex-col ${isLight ? 'bg-slate-100/50' : 'bg-slate-900/50'}`}>
            {/* Header Actions */}
            <header className={`h-20 px-8 flex items-center justify-between border-b ${isLight ? 'border-slate-200/50' : 'border-white/5'} glass-panel z-30`}>
              <div className="flex items-center gap-3">
                <Briefcase size={16} className="text-teal-600 dark:text-teal-400" />
                <span className="text-sm font-black uppercase italic tracking-widest truncate max-w-xs">{currentProject.name}</span>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Viral Score & Hook Optimizer */}
                <button
                  onClick={handleRunViralAudit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  <Flame size={14} /> Audit Viral
                </button>

                {/* 1-Click Translation Selector */}
                <div className="relative">
                  <select
                    onChange={(e) => e.target.value && handleTranslate(e.target.value)}
                    disabled={isTranslating}
                    defaultValue=""
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border outline-none cursor-pointer transition-all ${
                      isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'
                    }`}
                  >
                    <option value="" disabled>{isTranslating ? "Traduction..." : "🌐 Traduire"}</option>
                    <option value="en">English (EN)</option>
                    <option value="es">Español (ES)</option>
                    <option value="de">Deutsch (DE)</option>
                    <option value="fr">Français (FR)</option>
                    <option value="it">Italiano (IT)</option>
                  </select>
                </div>

                {/* Social Captions Drawer Button */}
                <Button variant="glass" size="sm" onClick={handleOpenCaptions}>
                  <MessageSquare size={14} /> Captions Post
                </Button>

                {/* Webhook Auto-Publish */}
                <Button variant="glass" size="sm" onClick={() => setIsPublishModalOpen(true)}>
                  <Radio size={14} /> Webhook Publish
                </Button>

                {/* Public Preview Mode Button */}
                <Button variant="glass" size="sm" onClick={() => setIsPreviewMode(true)}>
                  <ExternalLink size={14} /> Aperçu
                </Button>

                {/* Motion Video Export Button */}
                <Button variant="glass" size="sm" onClick={handleExportVideo} disabled={isExportingVideo}>
                  {isExportingVideo ? <span className="flex items-center gap-1"><Loader2 className="animate-spin" size={13} /> {videoProgress}%</span> : <span className="flex items-center gap-1"><Film size={14} /> Vidéo MP4</span>}
                </Button>

                {/* PDF LinkedIn Export Button */}
                <Button id="btn-export-pdf" variant="neon" size="sm" onClick={handleExportPdf} disabled={isExportingPdf}>
                  {isExportingPdf ? <Loader2 className="animate-spin" size={13} /> : <FileText size={14} />} PDF LinkedIn
                </Button>

                {/* ZIP Images Export Button */}
                <Button id="btn-export-pack" variant="white" size="sm" onClick={handleExport} disabled={isExporting}>
                  {isExporting ? <Loader2 className="animate-spin" size={13} /> : <Download size={14} />} Pack ZIP
                </Button>
              </div>
            </header>

            {/* Canvas Body */}
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
                {/* Slide index switcher */}
                <div className={`absolute top-6 flex gap-3 ${isLight ? 'bg-white/80 border-slate-200/80' : 'bg-black/40 border-white/10'} backdrop-blur-xl p-1.5 rounded-full border z-50`}>
                  <button onClick={() => setCurrentIdx(p => Math.max(0, p-1))} className={`p-2 ${isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-white/10 text-white'} rounded-full transition-colors cursor-pointer`}><ChevronLeft size={16} /></button>
                  <div className="flex items-center px-3">
                    <span className={`text-[10px] font-black tracking-widest uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{currentIdx+1} / {currentProject.config.slides.length}</span>
                  </div>
                  <button onClick={() => setCurrentIdx(p => Math.min(currentProject.config.slides.length-1, p+1))} className={`p-2 ${isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-white/10 text-white'} rounded-full transition-colors cursor-pointer`}><ChevronRight size={16} /></button>
                </div>

                <div className="animate-in zoom-in-95 duration-500 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] rounded-[2.5rem] overflow-hidden">
                  <SlidePreview slide={currentProject.config.slides[currentIdx]} config={currentProject.config} />
                </div>
              </div>

              {/* Right Settings Sidebar */}
              <div className={`w-[450px] border-l ${isLight ? 'border-slate-200/50' : 'border-white/5'} glass-panel p-8 overflow-y-auto space-y-10`}>
                <DesignSpecsSettings 
                  config={currentProject.config} 
                  updateConfig={updates => setCurrentProject({ ...currentProject, config: { ...currentProject.config, ...updates } })}
                  onSaveAsDefault={() => {
                    localStorage.setItem('numtema_default_theme', JSON.stringify({
                      accentColor: currentProject.config.accentColor,
                      fontFamily: currentProject.config.fontFamily,
                      theme: currentProject.config.theme,
                      branding: currentProject.config.branding
                    }));
                    alert("Paramètres enregistrés par défaut pour vos futurs carrousels !");
                  }}
                  onApplyToAll={handleApplyToAll}
                />

                <BrandingSettings 
                  branding={currentProject.config.branding}
                  updateBranding={updateBranding}
                  theme={currentProject.config.theme}
                />

                {/* Typography & Spacing */}
                <section className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                    <TypeIcon size={14} /> Typographie & Espacement
                  </h3>
                  <div className="space-y-4">
                    {['headlineSize', 'bodySize', 'contentPadding'].map(key => (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="text-teal-600 dark:text-teal-400">{(currentProject.config.slides[currentIdx] as any)[key]}px</span>
                        </div>
                        <input type="range" min="10" max="150" value={(currentProject.config.slides[currentIdx] as any)[key]} onChange={e => updateSlide({ [key]: parseInt(e.target.value) })} className={`w-full ${isLight ? 'accent-teal-600' : 'accent-teal-500'}`} />
                      </div>
                    ))}
                    
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button 
                        onClick={handleCopyStyle}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-800' : 'bg-white/5 hover:bg-white/10 text-white'} rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer`}
                      >
                        Copier style slide
                      </button>
                      <button 
                        onClick={handlePasteStyleToAll}
                        disabled={!copiedStyle}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Coller sur tous slides
                      </button>
                    </div>
                  </div>
                </section>

                {/* Architecture & Layout */}
                <section className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                    <LayoutIcon size={14} /> Architecture du Slide
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Mise en page</label>
                      <select 
                        value={currentProject.config.slides[currentIdx].layout}
                        onChange={e => updateSlide({ layout: e.target.value as LayoutType })}
                        className={`w-full ${isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'} border rounded-xl p-3 text-xs font-bold outline-none`}
                      >
                        <option value="center">Centré</option>
                        <option value="bottom-left">En bas à gauche</option>
                        <option value="split-vertical">Séparation verticale</option>
                        <option value="minimal">Minimaliste</option>
                        <option value="bold-title">Titre imposant</option>
                      </select>
                    </div>

                    {/* Visual Background Prompt & Generator */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Prompt Image de Fond</label>
                        <button
                          onClick={handleEnhanceVisualPrompt}
                          disabled={isEnhancingPrompt}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-white transition-all cursor-pointer"
                        >
                          {isEnhancingPrompt ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} ✨ Prompt IA
                        </button>
                      </div>
                      <textarea 
                        className={`w-full ${isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-slate-400'} border rounded-2xl p-3.5 text-[11px] leading-relaxed outline-none transition-all`}
                        rows={2} 
                        value={currentProject.config.slides[currentIdx].visualPrompt || ""} 
                        onChange={e => updateSlide({ visualPrompt: e.target.value })}
                        placeholder="Décrivez l'image souhaitée ou cliquez ✨ Prompt IA..."
                      />
                      
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={handleGenerateSingleImage}
                          disabled={isGeneratingSingleImage}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md"
                        >
                          {isGeneratingSingleImage ? (
                            <><Loader2 size={12} className="animate-spin" /> Génération image...</>
                          ) : (
                            <><ImageIcon size={12} /> {currentProject.config.slides[currentIdx].imageUri ? "Régénérer image" : "Générer image"}</>
                          )}
                        </button>

                        <label className={`p-2 rounded-xl border text-[10px] font-bold cursor-pointer transition-all flex items-center justify-center ${isLight ? 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'}`} title="Importer une image">
                          <Upload size={13} />
                          <input type="file" accept="image/*" onChange={handleUploadSlideImage} className="hidden" />
                        </label>

                        {currentProject.config.slides[currentIdx].imageUri && (
                          <button
                            onClick={() => updateSlide({ imageUri: undefined })}
                            className="p-2 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold transition-all cursor-pointer"
                            title="Supprimer l'image"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea 
                      className={`w-full ${isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'} border rounded-2xl p-4 text-xs font-bold focus:ring-1 focus:ring-teal-500 outline-none`}
                      rows={3} 
                      value={currentProject.config.slides[currentIdx].headline} 
                      onChange={e => updateSlide({ headline: e.target.value })}
                      placeholder="Headline (utilisez {mot-clé} pour mettre en valeur)"
                    />
                    <textarea 
                      className={`w-full ${isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-slate-400'} border rounded-2xl p-4 text-[11px] leading-relaxed outline-none`}
                      rows={5} 
                      value={currentProject.config.slides[currentIdx].body} 
                      onChange={e => updateSlide({ body: e.target.value })}
                      placeholder="Body copy..."
                    />

                    {/* AI Slide Editor */}
                    <div className="pt-4 border-t border-slate-200/50 dark:border-white/5 space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                        <Sparkles size={12} className="text-teal-500 animate-pulse" /> Retoucher ce slide avec l'IA
                      </label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Ex: Rends le titre plus accrocheur, résume..." 
                          value={slideInstruction}
                          onChange={e => setSlideInstruction(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleEditSlideWithAI()}
                          className={`flex-1 ${isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'} border rounded-xl px-3 py-2 text-xs font-bold outline-none`}
                        />
                        <button 
                          onClick={handleEditSlideWithAI}
                          disabled={isEditingSlide}
                          className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer flex items-center justify-center"
                        >
                          {isEditingSlide ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* Repurposer Modal */}
      {isRepurposeModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-in fade-in">
          <div className={`w-full max-w-xl ${isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white border border-white/10'} rounded-3xl p-8 shadow-2xl space-y-6 relative`}>
            <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Cpu className="text-teal-500" size={22} />
                <h3 className="text-base font-black uppercase tracking-wider">Repurposer Multi-Sources</h3>
              </div>
              <button onClick={() => setIsRepurposeModalOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type de source</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'url', label: '🌐 Article / URL' },
                    { id: 'youtube', label: '📺 Vidéo YouTube' },
                    { id: 'text', label: '📄 Texte / Doc' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setRepurposeForm({ ...repurposeForm, sourceType: t.id as any })}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        repurposeForm.sourceType === t.id
                          ? 'border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400'
                          : isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-slate-400'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {repurposeForm.sourceType === 'url' ? 'Lien de l\'article' : repurposeForm.sourceType === 'youtube' ? 'Lien de la vidéo YouTube' : 'Contenu du document'}
                </label>
                {repurposeForm.sourceType === 'text' ? (
                  <textarea
                    rows={5}
                    value={repurposeForm.sourceValue}
                    onChange={e => setRepurposeForm({ ...repurposeForm, sourceValue: e.target.value })}
                    placeholder="Collez ici votre texte, extrait de document ou notes..."
                    className={`w-full p-4 rounded-2xl border text-xs outline-none ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'}`}
                  />
                ) : (
                  <input
                    type="url"
                    value={repurposeForm.sourceValue}
                    onChange={e => setRepurposeForm({ ...repurposeForm, sourceValue: e.target.value })}
                    placeholder={repurposeForm.sourceType === 'url' ? 'https://mon-blog.com/mon-article' : 'https://youtube.com/watch?v=...'}
                    className={`w-full p-3.5 rounded-2xl border text-xs font-bold outline-none ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'}`}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Public cible</label>
                  <input
                    type="text"
                    value={repurposeForm.targetAudience}
                    onChange={e => setRepurposeForm({ ...repurposeForm, targetAudience: e.target.value })}
                    className={`w-full p-3 rounded-xl border text-xs font-bold outline-none ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tonalité</label>
                  <select
                    value={repurposeForm.tone}
                    onChange={e => setRepurposeForm({ ...repurposeForm, tone: e.target.value as any })}
                    className={`w-full p-3 rounded-xl border text-xs font-bold outline-none ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'}`}
                  >
                    <option value="educational">Éducatif & Actionnable</option>
                    <option value="storytelling">Storytelling captivant</option>
                    <option value="provocative">Contre-intuitif / Débat</option>
                    <option value="checklist">Checklist & Outils</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleRepurposeSubmit}
                disabled={isRepurposing || !repurposeForm.sourceValue.trim()}
                className="w-full py-3.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {isRepurposing ? (
                  <><Loader2 className="animate-spin" size={16} /> Extraction & Génération du carrousel...</>
                ) : (
                  <><Sparkles size={16} /> Extraire & Créer le Carrousel</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viral Score Auditor Modal */}
      {isViralModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-in fade-in">
          <div className={`w-full max-w-2xl ${isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white border border-white/10'} rounded-3xl p-8 shadow-2xl space-y-6 relative max-h-[85vh] overflow-y-auto`}>
            <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Flame className="text-amber-500" size={22} />
                <h3 className="text-base font-black uppercase tracking-wider">Viral Score & Hook Optimizer</h3>
              </div>
              <button onClick={() => setIsViralModalOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {isAuditingViral ? (
              <div className="py-16 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-amber-500" size={36} />
                <span className="text-xs font-bold text-slate-400">Analyse de rétention algorithmique et calcul du score...</span>
              </div>
            ) : viralAudit ? (
              <div className="space-y-6">
                {/* Score Header */}
                <div className="flex items-center justify-between p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Potentiel Viral Global</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">{viralAudit.verdict}</p>
                  </div>
                  <div className="text-4xl font-black text-amber-500 flex items-baseline">
                    {viralAudit.globalScore}<span className="text-sm text-slate-400">/100</span>
                  </div>
                </div>

                {/* Breakdown bars */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Hook (Titre)', score: viralAudit.breakdown?.hookStrength, max: 35 },
                    { label: 'Lisibilité', score: viralAudit.breakdown?.readability, max: 25 },
                    { label: 'Rétention Swipe', score: viralAudit.breakdown?.swipeRetention, max: 25 },
                    { label: 'Puissance CTA', score: viralAudit.breakdown?.ctaPower, max: 15 }
                  ].map((b, idx) => (
                    <div key={idx} className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'}`}>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">{b.label}</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-base font-black">{b.score}</span>
                        <span className="text-[10px] text-slate-400">/{b.max}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Alternative Hook Variations A/B/C */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                    <Sparkles size={12} /> 3 Variantes de Titre Optimisées (A/B/C)
                  </label>
                  <div className="space-y-2">
                    {(viralAudit.hookVariations || []).map((v: any, idx: number) => (
                      <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${isLight ? 'bg-slate-50 border-slate-200 hover:border-teal-500' : 'bg-white/5 border-white/10 hover:border-teal-500'} transition-all`}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-500 uppercase">{v.type}</span>
                            <span className="text-[9px] font-black text-emerald-500">{v.expectedCtr} de clics prévus</span>
                          </div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{v.headline}</p>
                        </div>
                        <button
                          onClick={() => handleApplyHookVariation(v.headline)}
                          className="shrink-0 px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                        >
                          Appliquer
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Auto-Publish & Webhook Modal */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-in fade-in">
          <div className={`w-full max-w-lg ${isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white border border-white/10'} rounded-3xl p-8 shadow-2xl space-y-6 relative`}>
            <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Radio className="text-teal-500" size={22} />
                <h3 className="text-base font-black uppercase tracking-wider">Publication Webhook</h3>
              </div>
              <button onClick={() => setIsPublishModalOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Connectez votre scénario <strong>Make.com, Zapier, n8n ou Buffer</strong>. En 1 clic, le carrousel complet (PDF LinkedIn, Pack ZIP, Légende et Hashtags) sera transmis automatiquement !
              </p>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">URL du Webhook</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://hook.eu1.make.com/..."
                  className={`w-full p-3.5 rounded-2xl border text-xs font-bold outline-none ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'}`}
                />
              </div>

              {publishStatus && (
                <div className={`p-3.5 rounded-xl text-xs font-bold ${publishStatus.startsWith('✅') ? 'bg-teal-500/10 text-teal-600' : 'bg-amber-500/10 text-amber-600'}`}>
                  {publishStatus}
                </div>
              )}

              <button
                onClick={handleDispatchWebhook}
                disabled={isPublishingWebhook || !webhookUrl.trim()}
                className="w-full py-3.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {isPublishingWebhook ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                Déclencher la publication
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Social Post Captions Modal */}
      {isCaptionModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-in fade-in">
          <div className={`w-full max-w-2xl ${isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white border border-white/10'} rounded-3xl p-8 shadow-2xl space-y-6 relative max-h-[85vh] overflow-y-auto`}>
            <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <MessageSquare className="text-teal-500" size={20} />
                <h3 className="text-base font-black uppercase tracking-wider">Légendes & Posts Réseaux Sociaux</h3>
              </div>
              <button onClick={() => setIsCaptionModalOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {captions ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400">Post LinkedIn Optimisé</label>
                    <button 
                      onClick={() => copyToClipboard(captions.linkedin, 'linkedin')}
                      className="flex items-center gap-1.5 px-3 py-1 bg-teal-500/10 hover:bg-teal-500 text-teal-600 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      {isCopiedText === 'linkedin' ? <><Check size={13} /> Copié !</> : <><Copy size={13} /> Copier</>}
                    </button>
                  </div>
                  <textarea 
                    readOnly
                    rows={6}
                    value={captions.linkedin}
                    className={`w-full p-4 rounded-2xl border text-xs leading-relaxed outline-none ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'}`}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400">Légende Instagram</label>
                    <button 
                      onClick={() => copyToClipboard(captions.instagram, 'instagram')}
                      className="flex items-center gap-1.5 px-3 py-1 bg-teal-500/10 hover:bg-teal-500 text-teal-600 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      {isCopiedText === 'instagram' ? <><Check size={13} /> Copié !</> : <><Copy size={13} /> Copier</>}
                    </button>
                  </div>
                  <textarea 
                    readOnly
                    rows={4}
                    value={captions.instagram}
                    className={`w-full p-4 rounded-2xl border text-xs leading-relaxed outline-none ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'}`}
                  />
                </div>

                {captions.hashtags && captions.hashtags.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hashtags Ciblés</label>
                    <div className="flex flex-wrap gap-2">
                      {captions.hashtags.map((tag, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-full bg-teal-500/10 text-teal-500 font-bold text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-teal-500" size={32} />
                <span className="text-xs font-bold text-slate-400">Rédaction des légendes LinkedIn & Instagram en cours...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
