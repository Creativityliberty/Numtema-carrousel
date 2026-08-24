
export type LayoutType = 'center' | 'bottom-left' | 'split-vertical' | 'minimal' | 'bold-title' | 'comparison' | 'custom-spec';
export type ThemeMode = 'dark' | 'light';
export type TextAlign = 'left' | 'center' | 'right';
export type CarouselIntent = 'educational' | 'storytelling' | 'checklist' | 'promotion' | 'trends';

export interface Branding {
  companyName: string;
  companyWebsite: string;
  iconUri?: string;
  showBranding: boolean;
  logoSize?: number;
  fontSize?: number;
}

export const DEFAULT_BRANDING: Branding = {
  companyName: "Numtema Design",
  companyWebsite: "numtema.design",
  showBranding: true,
  logoSize: 27,
  fontSize: 13
};

export const DEFAULT_SLIDE_STYLE = {
  headlineSize: 34,
  bodySize: 16,
  contentPadding: 44,
  layout: 'center' as LayoutType,
  overlayOpacity: 0.8,
  textAlign: 'left' as TextAlign
};

export interface DesignSpec {
  id: string;
  name: string;
  fontFamily: string;
  accentColor: string;
  margins_mm: number;
  headlineSize: number;
  bodySize: number;
  textAlign: TextAlign;
  overlayOpacity: number;
  vibe: string;
}

export interface Slide {
  id: string;
  headline: string;
  body: string;
  visualPrompt: string;
  imageUri?: string;
  layout: LayoutType;
  overlayOpacity: number;
  headlineSize: number;
  bodySize: number;
  textAlign: TextAlign;
  contentPadding: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface CarouselConfig {
  id: string;
  title: string;
  accentColor: string;
  fontFamily: string;
  aspectRatio: '1:1' | '4:5';
  theme: ThemeMode;
  branding: Branding;
  slides: Slide[];
  customSpec?: DesignSpec;
  groundingSources?: GroundingSource[];
  intent?: CarouselIntent;
}

export interface Project {
  id: string;
  name: string;
  updatedAt: number;
  config: CarouselConfig;
  chatHistory: ChatMessage[];
}

export interface GenerationState {
  isGeneratingContent: boolean;
  isGeneratingImages: boolean;
  isAnalyzingDesign: boolean;
  progress: number;
}
