export type AppRole = 'admin' | 'gerente' | 'vendedor';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: UserProfile | null;
  role: AppRole | null;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Subcategory {
  id: string;
  name: string;
  description: string | null;
  category_id: string;
  created_at: string;
  category?: Category;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  commercial_conditions: string | null;
  image_url: string | null;
  catalog_url: string | null;
  technical_sheet_url: string | null;
  category_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  visibility?: AppRole[];
  category?: Category;
}

export interface ProductVisibility {
  id: string;
  product_id: string;
  visible_to_role: AppRole;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  visible_to_roles: AppRole[];
  created_by: string | null;
  created_at: string;
}

export interface AccessLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  created_at: string;
}

export interface FileItem {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  subcategory_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  visibility?: AppRole[];
  subcategory?: Subcategory;
}

export interface FileVisibility {
  id: string;
  file_id: string;
  visible_to_role: AppRole;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
};

export const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-role-admin',
  gerente: 'bg-role-gerente',
  vendedor: 'bg-role-vendedor',
};
