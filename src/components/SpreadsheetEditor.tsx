import React, { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Save, Download, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SpreadsheetEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName: string;
  fileId: string;
  onSave?: () => void;
}

const SpreadsheetEditor: React.FC<SpreadsheetEditorProps> = ({
  open,
  onOpenChange,
  fileUrl,
  fileName,
  fileId,
  onSave
}) => {
  const [data, setData] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{row: number; col: number} | null>(null);

  useEffect(() => {
    if (open && fileUrl) {
      loadSpreadsheet();
    }
  }, [open, fileUrl]);

  const loadSpreadsheet = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Erro ao carregar arquivo');
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to array of arrays
      const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: '' });
      
      // Ensure minimum size
      const minRows = Math.max(jsonData.length, 20);
      const maxCols = Math.max(...jsonData.map(row => row.length), 10);
      
      const normalizedData: string[][] = [];
      for (let i = 0; i < minRows; i++) {
        const row = jsonData[i] || [];
        const normalizedRow: string[] = [];
        for (let j = 0; j < maxCols; j++) {
          normalizedRow.push(String(row[j] ?? ''));
        }
        normalizedData.push(normalizedRow);
      }
      
      setData(normalizedData);
      setHasChanges(false);
    } catch (err) {
      console.error('Error loading spreadsheet:', err);
      toast.error('Erro ao carregar o arquivo');
    } finally {
      setLoading(false);
    }
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    setData(prev => {
      const newData = prev.map(row => [...row]);
      newData[rowIndex][colIndex] = value;
      return newData;
    });
    setHasChanges(true);
  };

  const addRow = () => {
    setData(prev => [...prev, new Array(prev[0]?.length || 10).fill('')]);
    setHasChanges(true);
  };

  const addColumn = () => {
    setData(prev => prev.map(row => [...row, '']));
    setHasChanges(true);
  };

  const deleteRow = (index: number) => {
    if (data.length <= 1) return;
    setData(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const deleteColumn = (index: number) => {
    if ((data[0]?.length || 0) <= 1) return;
    setData(prev => prev.map(row => row.filter((_, i) => i !== index)));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Create worksheet from data
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      
      // Generate file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Upload to storage
      const newFileName = fileName.replace(/\.[^/.]+$/, '') + '.xlsx';
      const filePath = `${Date.now()}-${newFileName.replace(/\s+/g, '-')}`;
      
      const { error: uploadError } = await supabase.storage
        .from('price-files')
        .upload(filePath, blob);
      
      if (uploadError) throw uploadError;
      
      // Get new URL
      const { data: urlData } = supabase.storage
        .from('price-files')
        .getPublicUrl(filePath);
      
      // Update database record
      const { error: updateError } = await supabase
        .from('price_files')
        .update({
          file_url: urlData.publicUrl,
          file_size: blob.size,
        })
        .eq('id', fileId);
      
      if (updateError) throw updateError;
      
      toast.success('Planilha salva com sucesso!');
      setHasChanges(false);
      onSave?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving spreadsheet:', err);
      toast.error('Erro ao salvar planilha');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, fileName.replace(/\.[^/.]+$/, '') + '.xlsx');
    toast.success('Download realizado!');
  };

  const getColumnLetter = (index: number): string => {
    let letter = '';
    while (index >= 0) {
      letter = String.fromCharCode(65 + (index % 26)) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (hasChanges && !value) {
        if (confirm('Você tem alterações não salvas. Deseja sair sem salvar?')) {
          onOpenChange(value);
        }
      } else {
        onOpenChange(value);
      }
    }}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full flex flex-col">
        <DialogHeader>
          <DialogTitle>Editor de Planilha: {fileName}</DialogTitle>
          <DialogDescription>
            Clique em uma célula para editar. Use os botões para adicionar/remover linhas e colunas.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="w-4 h-4 mr-1" />
            Linha
          </Button>
          <Button variant="outline" size="sm" onClick={addColumn}>
            <Plus className="w-4 h-4 mr-1" />
            Coluna
          </Button>
        </div>
        
        <div className="flex-1 min-h-0 overflow-hidden border rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2">Carregando planilha...</span>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="overflow-auto">
                <table className="border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-muted">
                    <tr>
                      <th className="border border-border p-1 bg-muted min-w-[40px] text-center">#</th>
                      {data[0]?.map((_, colIndex) => (
                        <th key={colIndex} className="border border-border p-1 bg-muted min-w-[100px]">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium">{getColumnLetter(colIndex)}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-50 hover:opacity-100"
                              onClick={() => deleteColumn(colIndex)}
                              title="Remover coluna"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        <td className="border border-border p-1 bg-muted text-center font-medium">
                          <div className="flex items-center justify-between gap-1">
                            <span>{rowIndex + 1}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 opacity-50 hover:opacity-100"
                              onClick={() => deleteRow(rowIndex)}
                              title="Remover linha"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                        {row.map((cell, colIndex) => (
                          <td 
                            key={colIndex} 
                            className={`border border-border p-0 ${
                              selectedCell?.row === rowIndex && selectedCell?.col === colIndex 
                                ? 'ring-2 ring-primary' 
                                : ''
                            }`}
                          >
                            <Input
                              value={cell}
                              onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                              onFocus={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                              className="border-0 rounded-none h-8 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}
        </div>
        
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={handleDownload} disabled={loading}>
            <Download className="w-4 h-4 mr-2" />
            Baixar
          </Button>
          <Button onClick={handleSave} disabled={loading || saving || !hasChanges}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SpreadsheetEditor;
