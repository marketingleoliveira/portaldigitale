import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { hasFullAccess, hasAllRegionsAccess } from '@/types/auth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Upload, 
  Download, 
  Eye, 
  Trash2, 
  FileSpreadsheet, 
  Plus,
  Loader2,
  Edit,
  PenSquare
} from 'lucide-react';
import SpreadsheetEditor from '@/components/SpreadsheetEditor';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const REGIONS = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE', 'CE', 'GO', 'DF'];

interface PriceFile {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_size: number | null;
  region: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

const Prices: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role ? hasFullAccess(user.role) : false;
  const isDev = user?.role === 'dev';
  
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<PriceFile | null>(null);
  
  // Form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileDescription, setFileDescription] = useState('');
  const [fileRegion, setFileRegion] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);

  // Check if user can see all regions (INTERNO, gerente, admin, dev)
  const userRegion = user?.profile?.region;
  const canSeeAllRegions = hasFullAccess(user?.role) || 
                           user?.role === 'gerente' || 
                           hasAllRegionsAccess(userRegion);

  // Fetch price files
  const { data: priceFiles = [], isLoading } = useQuery({
    queryKey: ['price-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_files')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PriceFile[];
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, name, description, region }: { 
      file: File; 
      name: string; 
      description: string; 
      region: string | null;
    }) => {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${Date.now()}-${name.replace(/\s+/g, '-')}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('price-files')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('price-files')
        .getPublicUrl(filePath);
      
      // Insert record
      const { error: insertError } = await supabase
        .from('price_files')
        .insert({
          name,
          description: description || null,
          file_url: urlData.publicUrl,
          file_size: file.size,
          region: region === 'all' ? null : region,
          created_by: user?.id
        });
      
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-files'] });
      toast.success('Arquivo de preços enviado com sucesso!');
      resetForm();
      setIsUploadDialogOpen(false);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar arquivo');
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, name, description, region, file }: { 
      id: string;
      name: string; 
      description: string; 
      region: string | null;
      file?: File;
    }) => {
      let fileUrl = selectedFile?.file_url;
      let fileSize = selectedFile?.file_size;
      
      // If new file uploaded, replace it
      if (file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${Date.now()}-${name.replace(/\s+/g, '-')}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('price-files')
          .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('price-files')
          .getPublicUrl(filePath);
        
        fileUrl = urlData.publicUrl;
        fileSize = file.size;
      }
      
      const { error } = await supabase
        .from('price_files')
        .update({
          name,
          description: description || null,
          file_url: fileUrl,
          file_size: fileSize,
          region: region === 'all' ? null : region
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-files'] });
      toast.success('Arquivo atualizado com sucesso!');
      resetForm();
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast.error('Erro ao atualizar arquivo');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('price_files')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-files'] });
      toast.success('Arquivo excluído com sucesso!');
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('Erro ao excluir arquivo');
    }
  });

  const resetForm = () => {
    setUploadFile(null);
    setFileName('');
    setFileDescription('');
    setFileRegion('all');
    setSelectedFile(null);
  };

  const handleUpload = () => {
    if (!uploadFile || !fileName) {
      toast.error('Selecione um arquivo e informe o nome');
      return;
    }
    
    setIsUploading(true);
    uploadMutation.mutate({
      file: uploadFile,
      name: fileName,
      description: fileDescription,
      region: fileRegion === 'all' ? null : fileRegion
    }, {
      onSettled: () => setIsUploading(false)
    });
  };

  const handleUpdate = () => {
    if (!selectedFile || !fileName) {
      toast.error('Informe o nome do arquivo');
      return;
    }
    
    setIsUploading(true);
    updateMutation.mutate({
      id: selectedFile.id,
      name: fileName,
      description: fileDescription,
      region: fileRegion === 'all' ? null : fileRegion,
      file: uploadFile || undefined
    }, {
      onSettled: () => setIsUploading(false)
    });
  };

  const handleEdit = (file: PriceFile) => {
    setSelectedFile(file);
    setFileName(file.name);
    setFileDescription(file.description || '');
    setFileRegion(file.region || 'all');
    setIsEditDialogOpen(true);
  };

  const handlePreview = (file: PriceFile) => {
    setPreviewUrl(file.file_url);
    setSelectedFile(file);
    setIsPreviewOpen(true);
  };

  const handleOpenEditor = (file: PriceFile) => {
    setSelectedFile(file);
    setIsEditorOpen(true);
  };

  const handleDownload = (file: PriceFile) => {
    window.open(file.file_url, '_blank');
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileType = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase();
    if (['xlsx', 'xls'].includes(ext || '')) return 'Excel';
    if (ext === 'csv') return 'CSV';
    if (ext === 'pdf') return 'PDF';
    return ext?.toUpperCase() || 'Arquivo';
  };

  const getRegionLabel = (region: string | null) => {
    if (!region) return 'Todas as regiões';
    return region;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Tabela de Preços</h1>
            <p className="text-muted-foreground">
              {canManage 
                ? 'Gerencie as planilhas de preços por região' 
                : canSeeAllRegions
                  ? 'Visualize todas as planilhas de preços'
                  : `Visualize as planilhas de preços da sua região (${userRegion || 'Todas'})`}
            </p>
          </div>
          
          {canManage && (
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setIsUploadDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Planilha
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Nova Planilha</DialogTitle>
                  <DialogDescription>
                    Faça upload de uma planilha de preços. Você pode restringir por região.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="file">Arquivo</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".xlsx,.xls,.csv,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadFile(file);
                          if (!fileName) {
                            setFileName(file.name.replace(/\.[^/.]+$/, ''));
                          }
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Formatos aceitos: Excel (.xlsx, .xls), CSV, PDF
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="Nome da planilha"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição (opcional)</Label>
                    <Textarea
                      id="description"
                      value={fileDescription}
                      onChange={(e) => setFileDescription(e.target.value)}
                      placeholder="Descrição da planilha"
                      rows={2}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="region">Região</Label>
                    <Select value={fileRegion} onValueChange={setFileRegion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a região" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as regiões</SelectItem>
                        {REGIONS.map(region => (
                          <SelectItem key={region} value={region}>{region}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Vendedores verão apenas planilhas da sua região. Vendedores Internos veem todas.
                    </p>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpload} disabled={isUploading || !uploadFile}>
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Enviar
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Planilha</DialogTitle>
              <DialogDescription>
                Atualize as informações da planilha ou substitua o arquivo.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-file">Substituir Arquivo (opcional)</Label>
                <Input
                  id="edit-file"
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadFile(file);
                    }
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Nome da planilha"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-description">Descrição (opcional)</Label>
                <Textarea
                  id="edit-description"
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  placeholder="Descrição da planilha"
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-region">Região</Label>
                <Select value={fileRegion} onValueChange={setFileRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a região" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as regiões</SelectItem>
                    {REGIONS.map(region => (
                      <SelectItem key={region} value={region}>{region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdate} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog - Using Google Docs Viewer for readonly preview */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-6xl h-[85vh]">
            <DialogHeader className="flex flex-row items-center justify-between">
              <div>
                <DialogTitle>Visualização: {selectedFile?.name}</DialogTitle>
                <DialogDescription>
                  Pré-visualização da planilha (somente leitura)
                </DialogDescription>
              </div>
            </DialogHeader>
            {previewUrl && (
              <div className="flex-1 h-full min-h-0">
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                  className="w-full h-full min-h-[70vh] border rounded-lg"
                  title="Visualização do arquivo"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Spreadsheet Editor for developers */}
        {selectedFile && (
          <SpreadsheetEditor
            open={isEditorOpen}
            onOpenChange={setIsEditorOpen}
            fileUrl={selectedFile.file_url}
            fileName={selectedFile.name}
            fileId={selectedFile.id}
            onSave={() => queryClient.invalidateQueries({ queryKey: ['price-files'] })}
          />
        )}

        {/* Price Files Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Planilhas Disponíveis
            </CardTitle>
            <CardDescription>
              {canSeeAllRegions
                ? 'Todas as planilhas disponíveis'
                : userRegion 
                  ? `Mostrando planilhas para a região ${userRegion}`
                  : 'Todas as planilhas disponíveis'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : priceFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma planilha de preços disponível</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Região</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Atualizado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceFiles.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">{file.name}</TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {file.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getFileType(file.file_url)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={file.region ? 'default' : 'secondary'}>
                            {getRegionLabel(file.region)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatFileSize(file.file_size)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(file.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePreview(file)}
                              title="Visualizar"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(file)}
                              title="Baixar"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            {isDev && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditor(file)}
                                title="Editar planilha"
                                className="text-primary"
                              >
                                <PenSquare className="w-4 h-4" />
                              </Button>
                            )}
                            {canManage && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(file)}
                                  title="Editar informações"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteMutation.mutate(file.id)}
                                  title="Excluir"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
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
      </div>
    </DashboardLayout>
  );
};

export default Prices;
