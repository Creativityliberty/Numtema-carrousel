import React from 'react';
import { Palette, Save, Share2, Sparkles } from 'lucide-react';
import { CarouselConfig, PRESET_THEMES } from '../../types';

interface DesignSpecsSettingsProps {
  config: CarouselConfig;
  updateConfig: (updates: Partial<CarouselConfig>) => void;
  onSaveAsDefault: () => void;
  onApplyToAll: () => void;
}

export const DesignSpecsSettings: React.FC<DesignSpecsSettingsProps> = ({
  config,
  updateConfig,
  onSaveAsDefault,
  onApplyToAll,
}) => {
  const isLight = config.theme === 'light';

  const applyPreset = (preset: typeof PRESET_THEMES[0]) => {
    updateConfig({
      accentColor: preset.accentColor,
      fontFamily: preset.fontFamily,
      theme: preset.theme
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
           <Palette size={14} /> Design Specs
        </h3>
      </div>

      {/* 1-Click Preset Themes */}
      <div className="space-y-2">
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
          <Sparkles size={11} className="text-teal-500" /> Thèmes Prédéfinis
        </label>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_THEMES.map(preset => {
            const isSelected = config.accentColor.toLowerCase() === preset.accentColor.toLowerCase() && config.fontFamily === preset.fontFamily && config.theme === preset.theme;
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  isSelected 
                    ? 'border-teal-500 bg-teal-500/10 shadow-sm' 
                    : isLight ? 'bg-slate-100/70 border-slate-200 hover:border-slate-300' : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: preset.accentColor }} />
                  <span className="text-[10px] font-black tracking-tight truncate">{preset.name}</span>
                </div>
                <span className="text-[8px] text-slate-400 font-medium truncate">{preset.fontFamily} • {preset.theme === 'dark' ? 'Sombre' : 'Clair'}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Accent</label>
              <input 
                 type="color" 
                 className="w-full h-10 bg-transparent border-none cursor-pointer" 
                 value={config.accentColor} 
                 onChange={e => updateConfig({ accentColor: e.target.value })} 
              />
           </div>
           <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Typeface</label>
              <select 
                 className={`w-full ${isLight ? 'bg-slate-100 border border-slate-200 text-slate-900' : 'bg-slate-800 border border-white/10 text-white'} rounded-lg p-2 text-xs font-bold`} 
                 value={config.fontFamily} 
                 onChange={e => updateConfig({ fontFamily: e.target.value })}
              >
                 {['Outfit', 'Plus Jakarta Sans', 'Space Grotesk', 'Inter', 'Bebas Neue'].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
           </div>
        </div>

        {/* Dynamic theme select */}
        <div className="space-y-2">
           <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Mode / Theme</label>
           <select 
              className={`w-full ${isLight ? 'bg-slate-100 border border-slate-200 text-slate-900' : 'bg-slate-800 border border-white/10 text-white'} rounded-lg p-2 text-xs font-bold`} 
              value={config.theme} 
              onChange={e => updateConfig({ theme: e.target.value as 'light' | 'dark' })}
           >
              <option value="light">Thème Clair (Blanc)</option>
              <option value="dark">Thème Sombre (Noir)</option>
           </select>
        </div>

        {/* Unified actions */}
        <div className="grid grid-cols-2 gap-2 pt-2">
           <button 
              onClick={onSaveAsDefault}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
              title="Save branding and styling settings as the default layout for new projects"
           >
              <Save size={12} /> Définir par défaut
           </button>
           <button 
              onClick={onApplyToAll}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
              title="Propagate branding and styling settings to all existing carousel projects"
           >
              <Share2 size={12} /> Appliquer à tous
           </button>
        </div>
      </div>
    </section>
  );
};
