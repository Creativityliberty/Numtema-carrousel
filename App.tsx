import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, Settings, Image as ImageIcon, Download, Plus, Trash2, 
  ChevronLeft, ChevronRight, Cpu, Loader2, Zap, Camera, Upload, X, 
  CheckCircle2, Share2, Sun, Moon, Maximize2, FileJson, 
  MousePointer2, Layout as LayoutIcon, AlignLeft, AlignCenter, AlignRight,
  Building2, Send, RotateCw, Copy, Check, Grid, Briefcase, History,
  ArrowRight, Layers, Palette, Type as TypeIcon, Link as LinkIcon, Globe
} from 'lucide-react';
import { CarouselConfig, Slide, GenerationState, LayoutType, TextAlign, ChatMessage, Project, DesignSpec, DEFAULT_BRANDING, CarouselIntent } from './types';
import { generateCarouselContent, generateSlideImage, analyzeDesignADN, editSlideWithAI } from './geminiService';
import JSZip from 'jszip';
import * as htmlToImage from 'html-to-image';

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
  const [isArchitectFlow, setIsArchitectFlow] = useState(false);
  const [architectImages, setArchitectImages] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [customSpec, setCustomSpec] = useState<DesignSpec | undefined>();
  const [genState, setGenState] = useState<GenerationState>({
    isGeneratingContent: false,
    isGeneratingImages: false,
    isAnalyzingDesign: false,
    progress: 0
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Persistence
  useEffect(() => {
    fetch("/api/projects")
      .then(res => res.json())
      .then(data => {
         if (Array.isArray(data) && data.length > 0) {
            const normalized = data.map(normalizeProject);
            setProjects(normalized);
            localStorage.setItem('carouselfuzz_projects', JSON.stringify(normalized));
         }
      })
      .catch(err => console.error("Error loading backend projects:", err));
  }, []);

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

  const handleArchitectAnalysis = async () => {
    if (architectImages.length === 0) return;
    setGenState(p => ({ ...p, isAnalyzingDesign: true }));
    try {
      const spec = await analyzeDesignADN(architectImages);
      setChatHistory(prev => [...prev, { role: 'model', text: `Design DNA captured: "${spec.name}". Stylistic parameters synchronized.` }]);
      setCustomSpec(spec);
      setArchitectImages([]);
    } catch (e: any) { 
      const errMsg = e?.message || e?.toString() || "Unknown analysis error.";
      setChatHistory(prev => [...prev, { role: 'model', text: `Analysis failed: ${errMsg}. Please ensure images are valid and your GEMINI_API_KEY is configured in Settings.` }]);
    } finally { 
      setGenState(p => ({ ...p, isAnalyzingDesign: false })); 
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
      const config = await generateCarouselContent(topic, history, customSpec, 7, selectedIntent);
      saveProject(config, history);
      setIsAgentOpen(false);
    } catch (e: any) {
      const errMsg = e?.message || e?.toString() || "Unknown error.";
      setChatHistory(prev => [...prev, { role: 'model', text: `Error in generation: ${errMsg}. Please check your GEMINI_API_KEY inside Settings > Secrets if this is an authentication issue.` }]);
    } finally {
      setGenState(p => ({ ...p, isGeneratingContent: false }));
    }
  };

  const handleExport = async () => {
    if (!currentProject) return;
    setIsExporting(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`${currentProject.name.replace(/\s+/g, '_')}`);
      const originalIdx = currentIdx;
      
      for (let i = 0; i < currentProject.config.slides.length; i++) {
        setCurrentIdx(i);
        await new Promise(r => setTimeout(r, 800));
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

  const updateSlide = (updates: Partial<Slide>) => {
    if (!currentProject) return;
    const slides = [...currentProject.config.slides];
    slides[currentIdx] = { ...slides[currentIdx], ...updates };
    setCurrentProject({ ...currentProject, config: { ...currentProject.config, slides } });
  };

  const updateBranding = (updates: Partial<Branding>) => {
    if (!currentProject) return;
    const branding = { ...currentProject.config.branding, ...updates };
    setCurrentProject({ ...currentProject, config: { ...currentProject.config, branding } });
  };

  const handleSaveAsDefault = () => {
    if (!currentProject) return;
    const defaults = {
      accentColor: currentProject.config.accentColor,
      fontFamily: currentProject.config.fontFamily,
      theme: currentProject.config.theme,
      branding: currentProject.config.branding
    };
    localStorage.setItem("numtema_default_theme", JSON.stringify(defaults));
    alert("Style et branding enregistrés comme thème par défaut pour les futurs projets !");
  };

  const handleApplyToAll = () => {
    if (!currentProject) return;
    const source = {
      accentColor: currentProject.config.accentColor || "#80a880",
      fontFamily: currentProject.config.fontFamily || "Outfit",
      theme: currentProject.config.theme || "light",
      branding: currentProject.config.branding ? { ...currentProject.config.branding } : { ...DEFAULT_BRANDING }
    };
    
    const activeSlide = currentProject.config.slides[currentIdx] || currentProject.config.slides[0];
    const slideStyle = {
      headlineSize: activeSlide?.headlineSize || 34,
      bodySize: activeSlide?.bodySize || 16,
      contentPadding: activeSlide?.contentPadding || 44,
      layout: activeSlide?.layout || 'center',
      overlayOpacity: activeSlide?.overlayOpacity || 0.8
    };

    const updatedProjects = projects.map(proj => ({
      ...proj,
      config: {
        ...proj.config,
        ...source,
        branding: { ...source.branding },
        slides: (proj.config?.slides || []).map(s => ({
          ...s,
          ...slideStyle
        }))
      }
    }));

    setProjects(updatedProjects);
    
    setCurrentProject(prev => prev ? {
      ...prev,
      config: {
        ...prev.config,
        ...source,
        branding: { ...source.branding },
        slides: prev.config.slides.map(s => ({
          ...s,
          ...slideStyle
        }))
      }
    } : null);

    localStorage.setItem('carouselfuzz_projects', JSON.stringify(updatedProjects));
    fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedProjects)
    }).catch(err => console.error("Error applying to all:", err));

    alert("Style, branding et typographie appliqués à tous les projets et diapositives !");
  };

  const handleCopyStyle = () => {
    if (!currentProject) return;
    const slide = currentProject.config.slides[currentIdx];
    setCopiedStyle({
      headlineSize: slide.headlineSize || 34,
      bodySize: slide.bodySize || 16,
      contentPadding: slide.contentPadding || 44,
      layout: slide.layout || 'center',
      overlayOpacity: slide.overlayOpacity || 0.8
    });
    alert("Style du slide copié avec succès !");
  };

  const handlePasteStyleToAll = () => {
    if (!currentProject || !copiedStyle) return;
    const newSlides = currentProject.config.slides.map(s => ({
      ...s,
      ...copiedStyle
    }));
    setCurrentProject({ ...currentProject, config: { ...currentProject.config, slides: newSlides } });
    alert("Style appliqué à tous les slides du projet !");
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
          topic: currentProject.name,
          intent: selectedIntent,
          accentColor: currentProject.config.accentColor
        })
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const data = await res.json();
      if (data.prompt) {
        updateSlide({ visualPrompt: data.prompt });
      }
    } catch (e: any) {
      alert("Génération du prompt échouée : " + (e?.message || "Erreur inconnue"));
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  const [isGeneratingSingleImage, setIsGeneratingSingleImage] = useState(false);

  const handleGenerateSingleImage = async () => {
    if (!currentProject) return;
    const slide = currentProject.config.slides[currentIdx];
    if (!slide.visualPrompt?.trim()) {
      alert("Veuillez saisir une description visuelle (prompt) ou cliquer sur ✨ Générer.");
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
      alert("Erreur de génération d'image : " + (e?.message || "Erreur"));
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
      alert("Retouche échouée : " + (e?.message || e?.toString()));
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

  return (
    <div className={`relative min-h-screen ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-50'} transition-all font-sans overflow-hidden`}>
      {!currentProject ? (
        <ProjectExplorer 
          projects={projects} 
          onSelect={p => { setCurrentProject(p); setChatHistory(p.chatHistory || []); }}
          onDelete={id => setProjects(prev => prev.filter(p => p.id !== id))}
          onCreateNew={handleCreateNew}
        />
      ) : (
        <div className="flex h-screen w-full">
          {/* Editor Layout */}
          <aside className="w-80 border-r border-slate-200/50 flex flex-col p-6 glass-panel z-40 overflow-y-auto">
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
             <h1 className="text-xl font-black uppercase italic tracking-tighter">Numtema Design</h1>
          </div>
          <button onClick={() => setCurrentProject(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><History size={18} /></button>
        </header>

        <nav className="flex-1 space-y-8">
           <section className="space-y-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Master Slides</h2>
              <div className="space-y-2">
                 {currentProject.config.slides.map((s, idx) => (
                    <div 
                      key={s.id} 
                      onClick={() => setCurrentIdx(idx)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${
                        currentIdx === idx 
                          ? (currentProject.config.theme === 'light' ? 'border-teal-600 bg-teal-500/10 text-teal-700 font-bold' : 'border-teal-500 bg-teal-500/10 text-teal-400') 
                          : (currentProject.config.theme === 'light' ? 'border-slate-200/60 hover:bg-slate-100 text-slate-600' : 'border-white/5 hover:bg-white/5 text-slate-500')
                      }`}
                    >
                      <span className="text-[11px] font-bold truncate">Slide {idx+1}</span>
                      <ChevronRight size={14} className={currentIdx === idx ? 'opacity-100' : 'opacity-0'} />
                    </div>
                 ))}
              </div>
           </section>
        </nav>

        <footer className={`pt-6 border-t ${currentProject.config.theme === 'light' ? 'border-slate-200' : 'border-white/5'} flex gap-2`}>
           <Button className="flex-1" onClick={() => setIsAgentOpen(true)}><Sparkles size={16} /> Strategy</Button>
           <Button variant="ghost" onClick={() => setCurrentProject({...currentProject, config: {...currentProject.config, theme: currentProject.config.theme === 'dark' ? 'light' : 'dark'}})}>
              {currentProject.config.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
           </Button>
        </footer>
      </aside>

      <main className={`flex-1 flex flex-col ${currentProject.config.theme === 'light' ? 'bg-slate-100/50' : 'bg-slate-900/50'}`}>
        <header className={`h-20 px-10 flex items-center justify-between border-b ${currentProject.config.theme === 'light' ? 'border-slate-200/50' : 'border-white/5'} glass-panel z-30`}>
          <div className="flex items-center gap-4">
            <Briefcase size={16} className="text-teal-600 dark:text-teal-400" />
            <span className="text-sm font-black uppercase italic tracking-widest">{currentProject.name}</span>
          </div>
          <div className="flex gap-4">
             <Button variant="glass" onClick={handleBuildArt} disabled={genState.isGeneratingImages}>
                {genState.isGeneratingImages ? <span className="flex items-center gap-2 text-teal-600 dark:text-teal-400"><Loader2 className="animate-spin" size={14} /> Generating {genState.progress}%</span> : <span className="flex items-center gap-2"><ImageIcon size={18} /> Build Visuals</span>}
             </Button>
             <Button variant="white" onClick={handleExport} disabled={isExporting}>
                {isExporting ? <Loader2 className="animate-spin" /> : <Download size={18} />} Export Pack
             </Button>
          </div>
        </header>

        {genState.isGeneratingImages && (
          <div className={`w-full h-1 ${currentProject.config.theme === 'light' ? 'bg-slate-200' : 'bg-slate-900'} overflow-hidden relative`}>
            <div 
              className="h-full bg-gradient-to-r from-teal-500 to-teal-300 transition-all duration-500 ease-out" 
              style={{ width: `${genState.progress}%` }} 
            />
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
           <div className="flex-1 flex flex-col items-center justify-center p-10 relative">
              <div className={`absolute top-8 flex gap-3 ${currentProject.config.theme === 'light' ? 'bg-white/80 border-slate-200/80' : 'bg-black/40 border-white/10'} backdrop-blur-xl p-1.5 rounded-full border z-50`}>
                <button onClick={() => setCurrentIdx(p => Math.max(0, p-1))} className={`p-2 ${currentProject.config.theme === 'light' ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-white/10 text-white'} rounded-full transition-colors`}><ChevronLeft /></button>
                <div className="flex items-center px-4">
                  <span className={`text-[10px] font-black tracking-widest uppercase ${currentProject.config.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>{currentIdx+1} / {currentProject.config.slides.length}</span>
                </div>
                <button onClick={() => setCurrentIdx(p => Math.min(currentProject.config.slides.length-1, p+1))} className={`p-2 ${currentProject.config.theme === 'light' ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-white/10 text-white'} rounded-full transition-colors`}><ChevronRight /></button>
              </div>

              <div className="animate-in zoom-in-95 duration-500 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] rounded-[2.5rem] overflow-hidden">
                <SlidePreview slide={currentProject.config.slides[currentIdx]} config={currentProject.config} />
              </div>
           </div>

           <div className={`w-[450px] border-l ${currentProject.config.theme === 'light' ? 'border-slate-200/50' : 'border-white/5'} glass-panel p-8 overflow-y-auto space-y-10`}>
               <DesignSpecsSettings 
                  config={currentProject.config} 
                  updateConfig={updates => setCurrentProject({ ...currentProject, config: { ...currentProject.config, ...updates } })}
                  onSaveAsDefault={handleSaveAsDefault}
                  onApplyToAll={handleApplyToAll}
               />

               <BrandingSettings 
                  branding={currentProject.config.branding}
                  updateBranding={updateBranding}
                  theme={currentProject.config.theme}
               />

              <section className="space-y-6">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                    <TypeIcon size={14} /> Typography
                 </h3>
                 <div className="space-y-4">
                    {['headlineSize', 'bodySize', 'contentPadding'].map(key => (
                       <div key={key} className="space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                             <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                             <span className="text-teal-600 dark:text-teal-400">{(currentProject.config.slides[currentIdx] as any)[key]}px</span>
                          </div>
                          <input type="range" min="10" max="150" value={(currentProject.config.slides[currentIdx] as any)[key]} onChange={e => updateSlide({ [key]: parseInt(e.target.value) })} className={`w-full ${currentProject.config.theme === 'light' ? 'accent-teal-600' : 'accent-teal-500'}`} />
                       </div>
                    ))}
                    
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <button 
                          onClick={handleCopyStyle}
                          className={`flex items-center justify-center gap-1.5 py-2 px-3 ${currentProject.config.theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-800' : 'bg-white/5 hover:bg-white/10 text-white'} rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer`}
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

              <section className="space-y-6">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                    <LayoutIcon size={14} /> Architecture
                 </h3>
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Layout Preset</label>
                        <select 
                          className={`w-full ${currentProject.config.theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-800 border-white/10 text-white'} border rounded-xl p-2.5 text-xs font-bold focus:ring-1 focus:ring-teal-500 outline-none cursor-pointer select-element`}
                          value={currentProject.config.slides[currentIdx].layout} 
                          onChange={e => updateSlide({ layout: e.target.value as any })}
                        >
                           <option value="center">Center Focus</option>
                           <option value="bottom-left">Bottom Left Focus</option>
                           <option value="split-vertical">Split Vertical</option>
                           <option value="minimal">Minimalist</option>
                           <option value="bold-title">Bold Title Left</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Visual Background Prompt</label>
                          <button
                            onClick={handleEnhanceVisualPrompt}
                            disabled={isEnhancingPrompt}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                              isEnhancingPrompt 
                                ? 'bg-teal-500/10 text-teal-400 cursor-not-allowed' 
                                : 'bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-white cursor-pointer'
                            }`}
                          >
                            {isEnhancingPrompt 
                              ? <><Loader2 size={10} className="animate-spin" /> Génération...</>
                              : <><Sparkles size={10} /> Générer</>
                            }
                          </button>
                        </div>
                        <textarea 
                          className={`w-full ${currentProject.config.theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-slate-400'} border rounded-2xl p-4 text-[11px] leading-relaxed outline-none transition-all ${isEnhancingPrompt ? 'opacity-50' : ''}`}
                          rows={2} 
                          value={currentProject.config.slides[currentIdx].visualPrompt || ""} 
                          onChange={e => updateSlide({ visualPrompt: e.target.value })}
                          placeholder="Décrivez l'image souhaitée ou cliquez ✨ Générer..."
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

                          <label className={`p-2 rounded-xl border text-[10px] font-bold cursor-pointer transition-all flex items-center justify-center ${currentProject.config.theme === 'light' ? 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'}`} title="Importer votre propre image">
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
                       className={`w-full ${currentProject.config.theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'} border rounded-2xl p-4 text-xs font-bold focus:ring-1 focus:ring-teal-500 outline-none`}
                       rows={3} 
                       value={currentProject.config.slides[currentIdx].headline} 
                       onChange={e => updateSlide({ headline: e.target.value })}
                       placeholder="Headline"
                     />
                     <textarea 
                       className={`w-full ${currentProject.config.theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-slate-400'} border rounded-2xl p-4 text-[11px] leading-relaxed outline-none`}
                       rows={5} 
                       value={currentProject.config.slides[currentIdx].body} 
                       onChange={e => updateSlide({ body: e.target.value })}
                       placeholder="Body copy..."
                     />

                      <div className="pt-4 border-t border-slate-200/50 dark:border-white/5 space-y-2">
                         <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                            <Sparkles size={12} className="text-teal-500 animate-pulse" /> Retoucher ce slide avec l'IA
                         </label>
                         <div className="flex gap-2">
                            <input 
                               type="text" 
                               placeholder="Ex: Rends le titre accrocheur, traduis..." 
                               value={slideInstruction}
                               onChange={e => setSlideInstruction(e.target.value)}
                               onKeyDown={e => e.key === 'Enter' && handleEditSlideWithAI()}
                               className={`flex-1 ${currentProject.config.theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'} border rounded-xl px-3 py-2 text-xs font-bold outline-none`}
                            />
                            <button 
                               onClick={handleEditSlideWithAI}
                               disabled={!slideInstruction.trim() || isEditingSlide}
                               className="px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-30 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                            >
                               {isEditingSlide ? <Loader2 className="animate-spin text-white" size={12} /> : "🪄 Retoucher"}
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

      {/* Agent Overlay */}
      {isAgentOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className={`absolute inset-0 ${isLight ? 'bg-slate-100/90' : 'bg-slate-950/90'} backdrop-blur-xl`} onClick={() => !genState.isGeneratingContent && setIsAgentOpen(false)} />
          <div className={`relative w-full max-w-4xl h-[80vh] ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'} rounded-[3rem] border shadow-2xl overflow-hidden flex flex-col`}>
            <header className={`p-8 border-b ${isLight ? 'border-slate-200' : 'border-white/5'} flex items-center justify-between`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-500 flex items-center justify-center shadow-lg">
                   {isArchitectFlow ? <Layers size={24} className="text-white" /> : <Sparkles size={24} className="text-white" />}
                </div>
                <div>
                   <h2 className="text-2xl font-black italic tracking-tighter uppercase">{isArchitectFlow ? 'Architect Mode' : 'Instant Strategy'}</h2>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Powered by Gemini WebJSON v4</p>
                </div>
              </div>
              <button onClick={() => setIsAgentOpen(false)} className={`p-3 ${isLight ? 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'} rounded-xl border hover:text-red-400 transition-colors`}><X size={20} /></button>
            </header>

            <div className="flex-1 overflow-y-auto p-10 space-y-6">
               {isArchitectFlow && architectImages.length === 0 && chatHistory.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center space-y-6">
                    <div className="w-20 h-20 bg-teal-500/10 rounded-[2rem] flex items-center justify-center border-2 border-dashed border-teal-500/20">
                       <Camera className="text-teal-500" size={32} />
                    </div>
                    <div className="text-center">
                       <h3 className="text-xl font-bold italic uppercase">Sync Design DNA</h3>
                       <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">Upload screenshots of designs you love and we'll reverse-engineer the style.</p>
                    </div>
                    <input type="file" multiple id="architect-upload" className="hidden" accept="image/*" onChange={e => {
                        Array.from(e.target.files || []).forEach(f => {
                          const r = new FileReader();
                          r.onload = () => setArchitectImages(p => [...p, r.result as string]);
                          r.readAsDataURL(f);
                        });
                    }} />
                    <Button variant="primary" size="lg" onClick={() => document.getElementById('architect-upload')?.click()}>
                       <Upload size={18} /> Upload References
                    </Button>
                 </div>
               )}

               {architectImages.length > 0 && !genState.isAnalyzingDesign && (
                  <div className="grid grid-cols-4 gap-4">
                     {architectImages.map((img, i) => (
                        <div key={i} className={`relative aspect-square rounded-2xl overflow-hidden border ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                           <img src={img} className="w-full h-full object-cover" />
                           <button onClick={() => setArchitectImages(p => p.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 p-1 bg-black/60 rounded-lg"><X size={12} /></button>
                        </div>
                     ))}
                     <div className="col-span-full flex justify-center py-6">
                        <Button variant="neon" size="lg" onClick={handleArchitectAnalysis}>Analyze DNA</Button>
                     </div>
                  </div>
               )}

               {chatHistory.map((msg, i) => (
                 <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-${msg.role === 'user' ? 'right' : 'left'}-5`}>
                   <div className={`max-w-[85%] px-6 py-4 rounded-[2rem] text-sm ${msg.role === 'user' ? 'bg-teal-600 font-bold text-white' : (isLight ? 'bg-slate-100 border border-slate-200/50 text-slate-800' : 'bg-white/5 border border-white/5 text-slate-300')}`}>
                      {msg.text}
                   </div>
                 </div>
               ))}
               <div ref={chatEndRef} />
            </div>

            <footer className="p-10 pt-0 space-y-4">
               <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Objectif de rédaction :</span>
                  <select 
                     className={`text-xs font-bold rounded-lg px-3 py-1.5 border ${isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-950/50 border-white/10 text-white'} outline-none`}
                     value={selectedIntent}
                     onChange={e => setSelectedIntent(e.target.value as CarouselIntent)}
                  >
                     <option value="educational">📖 Tutoriel / Éducatif</option>
                     <option value="storytelling">🎭 Storytelling / Récit</option>
                     <option value="checklist">✅ Checklist / Fiche mémo</option>
                     <option value="promotion">🚀 Lancement / Promotion</option>
                     <option value="trends">📈 Tendances / Actualités</option>
                  </select>
               </div>
               <div className="relative">
                  <textarea 
                    className={`w-full ${isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-950/50 border-white/10 text-white'} border rounded-[2.5rem] px-8 py-6 text-lg font-bold focus:ring-1 focus:ring-teal-500 outline-none pr-24 resize-none`}
                    placeholder="Enter your topic or request..."
                    rows={2}
                    value={currentPrompt}
                    onChange={e => setCurrentPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleGenerate())}
                  />
                  <button 
                    disabled={!currentPrompt.trim() || genState.isGeneratingContent}
                    onClick={handleGenerate}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/20 disabled:opacity-20 transition-all hover:scale-105 active:scale-95 text-white"
                  >
                     {genState.isGeneratingContent ? <Loader2 className="animate-spin text-white" /> : <Send size={24} className="text-white" />}
                  </button>
               </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
