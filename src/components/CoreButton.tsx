import React from 'react';

interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'glass' | 'danger' | 'white' | 'ghost' | 'neon';
  active?: boolean;
  className?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  id?: string;
}

export const Button: React.FC<ButtonProps> = ({ 
  onClick, 
  children, 
  variant = 'glass', 
  active, 
  className = "", 
  disabled, 
  size = 'md',
  id
}) => {
  const base = "px-4 py-2 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 font-bold whitespace-nowrap active:scale-95 disabled:pointer-events-none";
  
  const styles = {
    primary: "bg-teal-500 text-white shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:bg-teal-400 disabled:opacity-50",
    white: "bg-white text-slate-900 shadow-xl hover:bg-slate-50 disabled:opacity-50",
    ghost: "text-slate-500 hover:text-white hover:bg-white/5",
    neon: "bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500 hover:text-white shadow-[0_0_15px_rgba(45,212,191,0.1)]",
    glass: active 
      ? "bg-teal-500/20 text-teal-400 border border-teal-500/50" 
      : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10",
    danger: "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white"
  };
  
  const sizes = { 
    xs: "text-[9px] py-1 px-2", 
    sm: "text-[10px] py-1.5 px-3", 
    md: "text-sm", 
    lg: "text-base py-3 px-6",
    xl: "text-lg py-4 px-8 rounded-3xl"
  };

  return (
    <button 
      id={id}
      disabled={disabled} 
      onClick={onClick} 
      className={`${base} ${styles[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};
