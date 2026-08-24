import React from 'react';
import { Slide, CarouselConfig, DEFAULT_BRANDING } from '../../types';
import { Zap } from 'lucide-react';

interface SlidePreviewProps {
  slide: Slide;
  config: CarouselConfig;
  exportMode?: boolean;
}

export const SlidePreview: React.FC<SlidePreviewProps> = ({ slide, config, exportMode }) => {
  if (!config || !slide) return null;
  const isVertical = config.aspectRatio === '4:5';
  const accent = config.accentColor || "#80a880";
  const scale = exportMode ? 2 : 1;
  const headlineSize = (slide.headlineSize || 34) * scale;
  const bodySize = (slide.bodySize || 16) * scale;
  const textAlign = slide.textAlign || 'left';
  const padding = (slide.contentPadding || 44) * scale;
  
  const branding = config.branding || DEFAULT_BRANDING;

  const isLight = config.theme === 'light';
  const slideBgColor = isLight ? '#ffffff' : '#0f172a';
  const slideFallbackBg = isLight ? 'bg-slate-100' : 'bg-slate-900';
  const slideTextColorClass = isLight ? 'text-slate-900' : 'text-white';
  const slideBodyColorClass = isLight ? 'text-slate-800/90' : 'text-slate-200/90';
  const slideOverlayGradient = isLight 
    ? `linear-gradient(to bottom, transparent 20%, rgba(255,255,255,${slide.overlayOpacity || 0.8}) 100%)`
    : `linear-gradient(to bottom, transparent 20%, rgba(0,0,0,${slide.overlayOpacity || 0.8}) 100%)`;
  const brandingTextClass = isLight ? 'text-slate-800' : 'text-white';
  const brandingSubtextClass = isLight ? 'text-slate-400' : 'text-white/40';
  const indicatorTextClass = isLight ? 'text-slate-900/20' : 'text-white/20';

  const logoSize = (branding.logoSize || 27) * scale;
  const logoFontSize = (branding.fontSize || 13) * scale;

  const renderRichText = (text: string, color: string, underline: boolean = false) => {
    return text.split('{').map((part, i) => {
      if (part.includes('}')) {
        const [highlight, rest] = part.split('}');
        return (
          <React.Fragment key={i}>
            <span 
              style={{ color }} 
              className={underline ? "underline decoration-teal-500/50 underline-offset-8" : ""}
            >
              {highlight}
            </span>
            {rest}
          </React.Fragment>
        );
      }
      return part;
    });
  };

  return (
    <div 
      id={`capture-${slide.id}`}
      className={`relative overflow-hidden flex flex-col group ${
        exportMode 
          ? (isVertical ? 'w-[1080px] h-[1350px]' : 'w-[1080px] h-[1080px]') 
          : (isVertical ? 'h-[600px] aspect-[4/5]' : 'h-[600px] aspect-square')
      } ${!exportMode ? 'rounded-[2.5rem] shadow-2xl overflow-hidden' : ''}`}
      style={{ backgroundColor: slideBgColor, fontFamily: config.fontFamily || 'Outfit' }}
    >
      {slide.imageUri ? (
        <img src={slide.imageUri} className="absolute inset-0 w-full h-full object-cover" alt="" crossOrigin="anonymous" />
      ) : (
        <div className={`absolute inset-0 ${slideFallbackBg}`} />
      )}
      
      <div 
        className="absolute inset-0" 
        style={{ 
          background: slideOverlayGradient, 
          mixBlendMode: isLight ? 'normal' : 'multiply' 
        }} 
      />

      {branding && branding.showBranding && (
        <div className="absolute top-10 left-12 flex items-center gap-3 z-20">
          <div 
            className="rounded-2xl bg-teal-500 flex items-center justify-center shadow-lg overflow-hidden"
            style={{ width: `${logoSize}px`, height: `${logoSize}px` }}
          >
            {branding.iconUri ? (
              <img src={branding.iconUri} className="w-full h-full object-cover" alt="" />
            ) : (
              <Zap size={logoSize * 0.5} className="text-white fill-current" />
            )}
          </div>
          <div className="flex flex-col">
            <span 
              className={`font-black tracking-[0.4em] ${brandingSubtextClass} uppercase leading-none`}
              style={{ fontSize: `${logoFontSize * 0.5}px` }}
            >
              {branding.companyWebsite || "numtema.design"}
            </span>
            <span 
              className={`font-black tracking-tighter ${brandingTextClass}`}
              style={{ fontSize: `${logoFontSize}px` }}
            >
              {branding.companyName || "Numtema Design"}
            </span>
          </div>
        </div>
      )}

      <div className="absolute inset-0 flex flex-col z-20" style={{ padding: `${padding}px` }}>
        <div 
          className={`h-full flex flex-col ${
            slide.layout === 'center' ? 'justify-center items-center' : 
            slide.layout === 'bottom-left' ? 'justify-end items-start' : 
            slide.layout === 'split-vertical' ? 'justify-end items-start max-w-[70%]' : 
            slide.layout === 'bold-title' ? 'justify-center items-start' : 
            'justify-start pt-24'
          }`} 
          style={{ textAlign }}
        >
          <div className="space-y-6 w-full drop-shadow-2xl">
            <h1 
              className={`font-black leading-[1.05] tracking-tight uppercase italic ${slideTextColorClass}`} 
              style={{ fontSize: `${headlineSize}px` }}
            >
              {renderRichText(slide.headline || "", accent)}
            </h1>
            <p className={`font-medium leading-relaxed ${slideBodyColorClass}`} style={{ fontSize: `${bodySize}px` }}>
              {renderRichText(slide.body || "", accent, true)}
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 right-12 flex flex-col items-end z-20">
        <div className={`text-4xl font-black italic tracking-tighter ${indicatorTextClass}`}>
          0{config.slides.indexOf(slide) + 1}
        </div>
        <div 
          className="w-12 h-1 bg-teal-500 mt-2 rounded-full" 
          style={{ 
            width: `${((config.slides.indexOf(slide) + 1) / config.slides.length) * 100}%`, 
            backgroundColor: accent 
          }} 
        />
      </div>
    </div>
  );
};
