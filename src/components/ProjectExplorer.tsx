import React from 'react';
import { Project } from '../../types';
import { Button } from './CoreButton';
import { Cpu, Zap, Layers, History, FileJson, Trash2, Grid, ArrowRight } from 'lucide-react';

interface ProjectExplorerProps {
  projects: Project[];
  onSelect: (p: Project) => void;
  onDelete: (id: string) => void;
  onCreateNew: (type: 'flash' | 'architect') => void;
  onOpenRepurposer?: () => void;
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({ projects, onSelect, onDelete, onCreateNew, onOpenRepurposer }) => {
  return (
    <div className="flex-1 min-h-screen p-10 md:p-20 flex flex-col overflow-y-auto bg-slate-50 text-slate-800">
      <header className="flex flex-col md:flex-row items-center justify-between mb-20 gap-8">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 italic">Numtema Design</h1>
            <p className="text-slate-500 font-bold tracking-[0.3em] text-[10px] uppercase opacity-60">Architectural Content Engine v4.0</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {onOpenRepurposer && (
            <Button variant="glass" size="lg" onClick={onOpenRepurposer}>
              <Cpu size={20} className="text-teal-600 dark:text-teal-400" /> Repurposer (URL / Doc)
            </Button>
          )}
          <Button variant="glass" size="lg" onClick={() => onCreateNew('flash')}>
            <Zap size={20} className="text-teal-600 dark:text-teal-400" /> Flash Create
          </Button>
          <Button variant="primary" size="lg" onClick={() => onCreateNew('architect')}>
            <Layers size={20} /> Design Architect
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-8">
            <History size={18} className="text-slate-600" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Recent Masterpieces</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {projects.map(p => (
              <div 
                key={p.id} 
                onClick={() => onSelect(p)}
                className="group bg-white border border-slate-200/80 rounded-[2.5rem] p-8 cursor-pointer hover:border-teal-500/50 hover:bg-teal-500/5 transition-all relative overflow-hidden shadow-sm hover:shadow-lg"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 blur-3xl group-hover:bg-teal-500/20 transition-all" />
                
                <div className="flex justify-between items-start mb-10">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 group-hover:bg-teal-500 group-hover:text-white transition-all text-slate-700">
                    <FileJson size={20} />
                  </div>
                  <button 
                    onClick={e => { 
                      e.stopPropagation(); 
                      onDelete(p.id);
                    }} 
                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 rounded-lg text-red-500 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <h3 className="text-xl font-black tracking-tight mb-2 truncate text-slate-900 uppercase italic">{p.name}</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {p.config?.slides?.length || 0} SLIDES • {new Date(p.updatedAt).toLocaleDateString()}
                </p>
                
                <div className="mt-8 flex justify-end">
                  <ArrowRight size={20} className="text-teal-600 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all" />
                </div>
              </div>
            ))}
            
            {projects.length === 0 && (
              <div className="col-span-full py-20 border-2 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center opacity-60 text-slate-400">
                <Grid size={48} className="mb-4 text-slate-300" />
                <p className="text-sm font-bold uppercase tracking-widest italic">No Projects Found. Launch the Architect.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
