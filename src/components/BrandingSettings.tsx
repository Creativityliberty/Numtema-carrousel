import React from 'react';
import { Branding } from '../../types';
import { Briefcase } from 'lucide-react';

interface BrandingSettingsProps {
  branding: Branding;
  updateBranding: (updates: Partial<Branding>) => void;
  theme: 'light' | 'dark';
}

export const BrandingSettings: React.FC<BrandingSettingsProps> = ({ branding, updateBranding, theme }) => {
  const isLight = theme === 'light';
  return (
    <section className="space-y-6">
      <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
         <Briefcase size={14} /> Branding & Logo
      </h3>
      <div className="space-y-4">
         <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Show Branding</label>
            <input 
               type="checkbox" 
               checked={branding?.showBranding !== false} 
               onChange={e => updateBranding({ showBranding: e.target.checked })} 
               className="w-4 h-4 accent-teal-600 cursor-pointer"
            />
         </div>
         {(branding?.showBranding !== false) && (
            <>
               <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Company Name</label>
                  <input 
                     type="text" 
                     className={`w-full ${isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-800 border-white/10 text-white'} border rounded-lg p-2 text-xs font-bold`}
                     value={branding?.companyName || ""} 
                     onChange={e => updateBranding({ companyName: e.target.value })} 
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Company Website</label>
                  <input 
                     type="text" 
                     className={`w-full ${isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-800 border-white/10 text-white'} border rounded-lg p-2 text-xs font-bold`}
                     value={branding?.companyWebsite || ""} 
                     onChange={e => updateBranding({ companyWebsite: e.target.value })} 
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Upload Logo</label>
                  <input 
                     type="file" 
                     accept="image/*" 
                     onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                           const reader = new FileReader();
                           reader.onload = () => {
                              updateBranding({ iconUri: reader.result as string });
                           };
                           reader.readAsDataURL(file);
                        }
                     }}
                     className="w-full text-xs font-bold text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-500/10 file:text-teal-600 hover:file:bg-teal-500/20 cursor-pointer"
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Logo Size ({branding?.logoSize || 48}px)</label>
                     <input 
                        type="range" 
                        min="24" 
                        max="96" 
                        value={branding?.logoSize || 48} 
                        onChange={e => updateBranding({ logoSize: parseInt(e.target.value) })} 
                        className={`w-full ${isLight ? 'accent-teal-600' : 'accent-teal-500'}`}
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Text Size ({branding?.fontSize || 20}px)</label>
                     <input 
                        type="range" 
                        min="12" 
                        max="32" 
                        value={branding?.fontSize || 20} 
                        onChange={e => updateBranding({ fontSize: parseInt(e.target.value) })} 
                        className={`w-full ${isLight ? 'accent-teal-600' : 'accent-teal-500'}`}
                     />
                  </div>
               </div>
            </>
         )}
      </div>
    </section>
  );
};
