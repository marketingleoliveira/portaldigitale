import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const Logo: React.FC<LogoProps> = ({ className = '', showText = true, size = 'md' }) => {
  const sizes = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${sizes[size]} aspect-square gradient-primary rounded-lg flex items-center justify-center shadow-primary`}>
        <span className="text-primary-foreground font-bold text-lg">DT</span>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className="font-bold text-lg leading-tight">Digitale</span>
          <span className="text-xs text-muted-foreground leading-tight">Têxtil</span>
        </div>
      )}
    </div>
  );
};

export default Logo;
