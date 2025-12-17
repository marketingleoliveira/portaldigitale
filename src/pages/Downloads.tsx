import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { FileItem, Category, AppRole, ROLE_LABELS } from '@/types/auth';
import { FileText, Download, Search, File, Image, FolderOpen, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';

interface ProductDownload {
  id: string;
  productName: string;
  category: string;
  type: 'catalog' | 'technical_sheet';
  url: string;
}

const Downloads: React.FC = () => {
  const { user } = useAuth();
  const [productDownloads, setProductDownloads] = useState<ProductDownload[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchProductDownloads(), fetchFiles(), fetchCategories()]);
    setLoading(false);
  };

  const fetchProductDownloads = async () => {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          catalog_url,
          technical_sheet_url,
          category:categories(name)
        `)
        .or('catalog_url.not.is.null,technical_sheet_url.not.is.null');

      if (error) throw error;

      const items: ProductDownload[] = [];

      (products || []).forEach((product: any) => {
        if (product.catalog_url) {
          items.push({
            id: `${product.id}-catalog`,
            productName: product.name,
            category: product.category?.name || 'Sem categoria',
            type: 'catalog',
            url: product.catalog_url,
          });
        }
        if (product.technical_sheet_url) {
          items.push({
            id: `${product.id}-technical`,
            productName: product.name,
            category: product.category?.name || 'Sem categoria',
            type: 'technical_sheet',
            url: product.technical_sheet_url,
          });
        }
      });

      setProductDownloads(items);
    } catch (error) {
      console.error('Error fetching product downloads:', error);
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
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
  };

  const filteredProductDownloads = productDownloads.filter((item) => {
    const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || file.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Get unique file categories
  const fileCategories = [...new Set(files.map(f => f.category).filter(Boolean))];

  const getTypeIcon = (type: string) => {
    if (type === 'catalog') return <Image className="w-5 h-5 text-primary" />;
    return <FileText className="w-5 h-5 text-success" />;
  };

  const getTypeLabel = (type: string) => {
    if (type === 'catalog') return 'Catálogo';
    return 'Ficha Técnica';
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Downloads</h1>
          <p className="text-muted-foreground">
            Acesse catálogos, fichas técnicas e arquivos disponíveis
          </p>
        </div>

        <Tabs defaultValue="files" className="space-y-4">
          <TabsList>
            <TabsTrigger value="files">Arquivos</TabsTrigger>
            <TabsTrigger value="products">Produtos</TabsTrigger>
          </TabsList>

          {/* Files Tab */}
          <TabsContent value="files" className="space-y-4">
            {/* Search */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar arquivos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {fileCategories.length > 0 && (
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <FolderOpen className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="all">Todas</SelectItem>
                        {fileCategories.map((cat) => (
                          <SelectItem key={cat} value={cat!}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Files List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredFiles.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum arquivo disponível</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFiles.map((file) => (
                  <Card key={file.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <File className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base line-clamp-1">
                            {file.name}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {file.category && <span>{file.category} • </span>}
                            {formatFileSize(file.file_size)}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {file.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {file.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {file.visibility?.map(role => (
                          <Badge key={role} variant={role} className="text-xs">
                            {ROLE_LABELS[role]}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(file.file_url, '_blank')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por produto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <FolderOpen className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <File className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="catalog">Catálogos</SelectItem>
                      <SelectItem value="technical_sheet">Fichas Técnicas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Product Downloads List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredProductDownloads.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum arquivo disponível</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProductDownloads.map((item) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          {getTypeIcon(item.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base line-clamp-1">
                            {item.productName}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {getTypeLabel(item.type)} • {item.category}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(item.url, '_blank')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Downloads;
