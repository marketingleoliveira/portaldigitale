import React from 'react';
import logoImage from '@/assets/logo-digitale-full.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizes = {
    sm: 'h-10',
    md: 'h-14',
    lg: 'h-20',
  };

  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src={logoImage} 
        alt="Digitale Têxtil" 
        className={`${sizes[size]} w-auto object-contain`}
      />
    </div>
  );
};

export default Logo;
