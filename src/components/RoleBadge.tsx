import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AppRole, ROLE_LABELS } from '@/types/auth';
import { Shield, UserCog, User } from 'lucide-react';

interface RoleBadgeProps {
  role: AppRole;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const RoleBadge: React.FC<RoleBadgeProps> = ({ role, showIcon = true, size = 'md' }) => {
  const icons = {
    admin: Shield,
    gerente: UserCog,
    vendedor: User,
  };

  const Icon = icons[role];

  return (
    <Badge variant={role} className={size === 'sm' ? 'text-xs px-2 py-0.5' : ''}>
      {showIcon && <Icon className={`${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} mr-1`} />}
      {ROLE_LABELS[role]}
    </Badge>
  );
};

export default RoleBadge;
