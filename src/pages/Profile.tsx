import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import RoleBadge from '@/components/RoleBadge';
import ProfileCertificates from '@/components/ProfileCertificates';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Lock, Mail, Phone, Loader2, Pencil, Check, X, Camera } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(72),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

const nameSchema = z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100, 'Nome muito longo');

const Profile: React.FC = () => {
  const { user, updatePassword } = useAuth();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.profile?.full_name || '');
  const [savingName, setSavingName] = useState(false);

  // Avatar state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = passwordSchema.safeParse({ newPassword, confirmPassword });
    if (!validation.success) {
      toast({
        title: 'Erro',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await updatePassword(newPassword);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Senha atualizada com sucesso',
      });

      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar senha',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateName = async () => {
    const validation = nameSchema.safeParse(editedName.trim());
    if (!validation.success) {
      toast({
        title: 'Erro',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setSavingName(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editedName.trim() })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Nome atualizado com sucesso',
      });

      setIsEditingName(false);
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar nome',
        variant: 'destructive',
      });
    } finally {
      setSavingName(false);
    }
  };

  const cancelNameEdit = () => {
    setEditedName(user?.profile?.full_name || '');
    setIsEditingName(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione uma imagem válida',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'A imagem deve ter no máximo 2MB',
        variant: 'destructive',
      });
      return;
    }

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast({
        title: 'Sucesso',
        description: 'Foto atualizada com sucesso',
      });

      window.location.reload();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao fazer upload da foto',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const avatarUrl = user?.profile?.avatar_url;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
          <p className="text-muted-foreground">Visualize e edite suas informações</p>
        </div>

        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative group">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-16 h-16 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
                    {(isEditingName ? editedName : user?.profile?.full_name)?.charAt(0) || 'U'}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="max-w-xs"
                      placeholder="Seu nome"
                      maxLength={100}
                      disabled={savingName}
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={handleUpdateName}
                      disabled={savingName}
                    >
                      {savingName ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 text-green-600" />
                      )}
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={cancelNameEdit}
                      disabled={savingName}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">{user?.profile?.full_name || 'Usuário'}</p>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8"
                      onClick={() => {
                        setEditedName(user?.profile?.full_name || '');
                        setIsEditingName(true);
                      }}
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                )}
                {user?.role && <RoleBadge role={user.role} />}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Clique na foto para alterar (máximo 2MB)
            </p>

            <div className="grid gap-4 pt-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p className="font-medium">{user?.profile?.phone || 'Não informado'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certificates */}
        <ProfileCertificates />

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Alterar Senha
            </CardTitle>
            <CardDescription>Mantenha sua conta segura</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  maxLength={72}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Atualizar Senha'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Profile;