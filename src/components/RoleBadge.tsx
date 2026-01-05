import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AppRole, ROLE_LABELS } from '@/types/auth';
import { Shield, UserCog, User, Code } from 'lucide-react';

interface RoleBadgeProps {
  role: AppRole;
  region?: string | null;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const RoleBadge: React.FC<RoleBadgeProps> = ({ role, region, showIcon = true, size = 'md' }) => {
  const icons: Record<AppRole, React.ElementType> = {
    dev: Code,
    admin: Shield,
    gerente: UserCog,
    vendedor: User,
  };

  const Icon = icons[role];

  // For vendedor with region, show "Vendedor SP" format
  const displayLabel = role === 'vendedor' && region 
    ? `${ROLE_LABELS[role]} ${region}` 
    : ROLE_LABELS[role];

  return (
    <Badge variant={role} className={size === 'sm' ? 'text-xs px-2 py-0.5' : ''}>
      {showIcon && Icon && <Icon className={`${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} mr-1`} />}
      {displayLabel}
    </Badge>
  );
};

export default RoleBadge;
