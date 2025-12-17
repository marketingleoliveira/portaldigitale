import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { FileItem, AppRole, ROLE_LABELS } from '@/types/auth';
import { 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  Search, 
  Download,
  Loader2,
  File,
  X,
  Pencil
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const ALL_ROLES: AppRole[] = ['admin', 'gerente', 'vendedor'];

interface Category {
  id: string;
  name: string;
  description: string | null;
}

const FileManagement: React.FC = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [fileToEdit, setFileToEdit] = useState<FileItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    visibility: ['vendedor'] as AppRole[],
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    category: '',
    visibility: [] as AppRole[],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchFiles();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchFiles = async () => {
    try {
      const { data: filesData, error } = await supabase
        .from('files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch visibility for each file
      const filesWithVisibility = await Promise.all(
        (filesData || []).map(async (file) => {
          const { data: visibility } = await supabase
            .from('file_visibility')
            .select('visible_to_role')
            .eq('file_id', file.id);
          
          return {
            ...file,
            visibility: visibility?.map(v => v.visible_to_role as AppRole) || [],
          };
        })
      );

      setFiles(filesWithVisibility);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Erro ao carregar arquivos');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!formData.name) {
        setFormData(prev => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, '') }));
      }
    }
  };

  const handleVisibilityChange = (role: AppRole, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      visibility: checked
        ? [...prev.visibility, role]
        : prev.visibility.filter(r => r !== role),
    }));
  };

  const handleEditVisibilityChange = (role: AppRole, checked: boolean) => {
    setEditFormData(prev => ({
      ...prev,
      visibility: checked
        ? [...prev.visibility, role]
        : prev.visibility.filter(r => r !== role),
    }));
  };

  const openEditDialog = (file: FileItem) => {
    setFileToEdit(file);
    setEditFormData({
      name: file.name,
      description: file.description || '',
      category: file.category || '',
      visibility: file.visibility || [],
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!fileToEdit) return;

    if (!editFormData.name.trim()) {
      toast.error('Informe o nome do arquivo');
      return;
    }

    if (editFormData.visibility.length === 0) {
      toast.error('Selecione pelo menos um cargo para visualização');
      return;
    }

    setUpdating(true);

    try {
      // Update file record
      const { error: updateError } = await supabase
        .from('files')
        .update({
          name: editFormData.name,
          description: editFormData.description || null,
          category: editFormData.category || null,
        })
        .eq('id', fileToEdit.id);

      if (updateError) throw updateError;

      // Delete existing visibility records
      const { error: deleteVisibilityError } = await supabase
        .from('file_visibility')
        .delete()
        .eq('file_id', fileToEdit.id);

      if (deleteVisibilityError) throw deleteVisibilityError;

      // Insert new visibility records
      const visibilityRecords = editFormData.visibility.map(role => ({
        file_id: fileToEdit.id,
        visible_to_role: role,
      }));

      const { error: visibilityError } = await supabase
        .from('file_visibility')
        .insert(visibilityRecords);

      if (visibilityError) throw visibilityError;

      toast.success('Arquivo atualizado com sucesso');
      setEditDialogOpen(false);
      setFileToEdit(null);
      fetchFiles();
    } catch (error: any) {
      console.error('Error updating file:', error);
      toast.error(error.message || 'Erro ao atualizar arquivo');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Selecione um arquivo');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Informe o nome do arquivo');
      return;
    }

    if (formData.visibility.length === 0) {
      toast.error('Selecione pelo menos um cargo para visualização');
      return;
    }

    setUploading(true);

    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('files')
        .getPublicUrl(fileName);

      // Insert file record
      const { data: fileRecord, error: insertError } = await supabase
        .from('files')
        .insert({
          name: formData.name,
          description: formData.description || null,
          file_url: publicUrl,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          category: formData.category || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Insert visibility records
      const visibilityRecords = formData.visibility.map(role => ({
        file_id: fileRecord.id,
        visible_to_role: role,
      }));

      const { error: visibilityError } = await supabase
        .from('file_visibility')
        .insert(visibilityRecords);

      if (visibilityError) throw visibilityError;

      toast.success('Arquivo enviado com sucesso');
      setDialogOpen(false);
      resetForm();
      fetchFiles();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(error.message || 'Erro ao enviar arquivo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;

    try {
      // Extract filename from URL
      const urlParts = fileToDelete.file_url.split('/');
      const fileName = urlParts[urlParts.length - 1];

      // Delete from storage
      await supabase.storage.from('files').remove([fileName]);

      // Delete file record (visibility will cascade)
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', fileToDelete.id);

      if (error) throw error;

      toast.success('Arquivo excluído com sucesso');
      setDeleteDialogOpen(false);
      setFileToDelete(null);
      fetchFiles();
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast.error(error.message || 'Erro ao excluir arquivo');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      visibility: ['vendedor'],
    });
    setSelectedFile(null);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gerenciamento de Arquivos</h1>
            <p className="text-muted-foreground">
              Faça upload de arquivos e controle a visibilidade por cargo
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Arquivo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Enviar Arquivo</DialogTitle>
                <DialogDescription>
                  Faça upload de um arquivo e defina quem pode visualizá-lo
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {/* File Input */}
                <div className="space-y-2">
                  <Label>Arquivo *</Label>
                  {selectedFile ? (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <File className="w-5 h-5 text-primary" />
                      <span className="flex-1 truncate text-sm">{selectedFile.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Clique para selecionar
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </label>
                  )}
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome do arquivo"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição opcional"
                    rows={2}
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 ? (
                        <SelectItem value="" disabled>
                          Nenhuma categoria cadastrada
                        </SelectItem>
                      ) : (
                        categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {categories.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Cadastre categorias no menu Categorias primeiro
                    </p>
                  )}
                </div>

                {/* Visibility */}
                <div className="space-y-2">
                  <Label>Visível para *</Label>
                  <div className="flex flex-wrap gap-4">
                    {ALL_ROLES.map(role => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role}`}
                          checked={formData.visibility.includes(role)}
                          onCheckedChange={(checked) => 
                            handleVisibilityChange(role, checked as boolean)
                          }
                        />
                        <label
                          htmlFor={`role-${role}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {ROLE_LABELS[role]}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Enviar Arquivo
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar arquivos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Files Table */}
        <Card>
          <CardHeader>
            <CardTitle>Arquivos</CardTitle>
            <CardDescription>
              {filteredFiles.length} arquivo(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum arquivo encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Visibilidade</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFiles.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            <div>
                              <p className="font-medium">{file.name}</p>
                              {file.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {file.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{file.category || '-'}</TableCell>
                        <TableCell>{formatFileSize(file.file_size)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {file.visibility?.map(role => (
                              <Badge key={role} variant={role}>
                                {ROLE_LABELS[role]}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => window.open(file.file_url, '_blank')}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openEditDialog(file)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setFileToDelete(file);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir arquivo</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o arquivo "{fileToDelete?.name}"?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Arquivo</DialogTitle>
              <DialogDescription>
                Altere as informações do arquivo
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome *</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do arquivo"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit-description">Descrição</Label>
                <Textarea
                  id="edit-description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição opcional"
                  rows={2}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoria</Label>
                <Select
                  value={editFormData.category}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 ? (
                      <SelectItem value="" disabled>
                        Nenhuma categoria cadastrada
                      </SelectItem>
                    ) : (
                      categories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Visibility */}
              <div className="space-y-2">
                <Label>Visível para *</Label>
                <div className="flex flex-wrap gap-4">
                  {ALL_ROLES.map(role => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-role-${role}`}
                        checked={editFormData.visibility.includes(role)}
                        onCheckedChange={(checked) => 
                          handleEditVisibilityChange(role, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={`edit-role-${role}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {ROLE_LABELS[role]}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={handleUpdate}
                disabled={updating}
              >
                {updating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default FileManagement;
