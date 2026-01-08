import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface SpreadsheetPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName: string;
}

interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  textColor?: string;
  borderTop?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderRight?: string;
  fontSize?: number;
}

interface CellData {
  value: string;
  formattedValue: string;
  style: CellStyle;
}

interface SheetData {
  name: string;
  data: CellData[][];
}

const SpreadsheetPreview: React.FC<SpreadsheetPreviewProps> = ({
  open,
  onOpenChange,
  fileUrl,
  fileName
}) => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState('0');

  useEffect(() => {
    if (open && fileUrl) {
      loadSpreadsheet();
    }
  }, [open, fileUrl]);

  const rgbaToHex = (color: { rgb?: string; theme?: number; tint?: number } | undefined): string | undefined => {
    if (!color) return undefined;
    if (color.rgb) {
      // ARGB format - remove alpha if present
      const rgb = color.rgb.length === 8 ? color.rgb.substring(2) : color.rgb;
      return `#${rgb}`;
    }
    return undefined;
  };

  const extractCellStyle = (cell: XLSX.CellObject | undefined): CellStyle => {
    const style: CellStyle = {};
    
    if (!cell || !cell.s) return style;
    
    const cellStyle = cell.s as any;
    
    // Font styles
    if (cellStyle.font) {
      if (cellStyle.font.bold) style.bold = true;
      if (cellStyle.font.italic) style.italic = true;
      if (cellStyle.font.color) {
        style.textColor = rgbaToHex(cellStyle.font.color);
      }
      if (cellStyle.font.sz) {
        style.fontSize = cellStyle.font.sz;
      }
    }
    
    // Alignment
    if (cellStyle.alignment) {
      if (cellStyle.alignment.horizontal === 'center') style.textAlign = 'center';
      else if (cellStyle.alignment.horizontal === 'right') style.textAlign = 'right';
      else style.textAlign = 'left';
    }
    
    // Background color
    if (cellStyle.fill) {
      if (cellStyle.fill.fgColor) {
        style.backgroundColor = rgbaToHex(cellStyle.fill.fgColor);
      } else if (cellStyle.fill.bgColor) {
        style.backgroundColor = rgbaToHex(cellStyle.fill.bgColor);
      }
    }
    
    // Borders
    if (cellStyle.border) {
      const borderToStyle = (border: any): string | undefined => {
        if (!border) return undefined;
        const color = border.color ? rgbaToHex(border.color) || '#000000' : '#000000';
        const styleMap: Record<string, string> = {
          'thin': `1px solid ${color}`,
          'medium': `2px solid ${color}`,
          'thick': `3px solid ${color}`,
          'double': `3px double ${color}`,
          'dotted': `1px dotted ${color}`,
          'dashed': `1px dashed ${color}`,
        };
        return styleMap[border.style] || `1px solid ${color}`;
      };
      
      style.borderTop = borderToStyle(cellStyle.border.top);
      style.borderBottom = borderToStyle(cellStyle.border.bottom);
      style.borderLeft = borderToStyle(cellStyle.border.left);
      style.borderRight = borderToStyle(cellStyle.border.right);
    }
    
    return style;
  };

  const formatCellValue = (cell: XLSX.CellObject | undefined): string => {
    if (!cell) return '';
    
    // If there's a formatted text, use it
    if (cell.w !== undefined) {
      return cell.w;
    }
    
    // Handle different cell types
    if (cell.t === 'n' && cell.v !== undefined) {
      // Number - check for format
      const numValue = cell.v as number;
      const format = (cell as any).z;
      
      if (format) {
        // Currency formats
        if (format.includes('R$') || format.includes('$')) {
          return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        // Percentage
        if (format.includes('%')) {
          return (numValue * 100).toFixed(2) + '%';
        }
        // General number with thousands separator
        if (format.includes(',') || format.includes('#')) {
          return numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
      }
      
      // Default number formatting
      if (Number.isInteger(numValue)) {
        return numValue.toLocaleString('pt-BR');
      }
      return numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    if (cell.t === 'd' && cell.v !== undefined) {
      // Date
      const date = new Date(cell.v as string);
      return date.toLocaleDateString('pt-BR');
    }
    
    // String or other
    return String(cell.v ?? '');
  };

  const loadSpreadsheet = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Erro ao carregar arquivo');
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { 
        type: 'array',
        cellStyles: true,
        cellNF: true,
        cellDates: true
      });
      
      const sheetsData: SheetData[] = workbook.SheetNames.map(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        
        const cellData: CellData[][] = [];
        
        for (let row = range.s.r; row <= range.e.r; row++) {
          const rowData: CellData[] = [];
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress] as XLSX.CellObject | undefined;
            
            const value = cell?.v !== undefined ? String(cell.v) : '';
            const formattedValue = formatCellValue(cell);
            const style = extractCellStyle(cell);
            
            rowData.push({ value, formattedValue, style });
          }
          cellData.push(rowData);
        }
        
        return {
          name: sheetName,
          data: cellData
        };
      });
      
      setSheets(sheetsData);
      setActiveSheet('0');
    } catch (err) {
      console.error('Error loading spreadsheet:', err);
      setError('Não foi possível carregar a planilha. Verifique se o arquivo é válido.');
    } finally {
      setLoading(false);
    }
  };

  const getCellStyle = (cellStyle: CellStyle): React.CSSProperties => {
    const style: React.CSSProperties = {};
    
    if (cellStyle.bold) style.fontWeight = 'bold';
    if (cellStyle.italic) style.fontStyle = 'italic';
    if (cellStyle.textAlign) style.textAlign = cellStyle.textAlign;
    if (cellStyle.backgroundColor) style.backgroundColor = cellStyle.backgroundColor;
    if (cellStyle.textColor) style.color = cellStyle.textColor;
    if (cellStyle.fontSize) style.fontSize = `${cellStyle.fontSize}px`;
    if (cellStyle.borderTop) style.borderTop = cellStyle.borderTop;
    if (cellStyle.borderBottom) style.borderBottom = cellStyle.borderBottom;
    if (cellStyle.borderLeft) style.borderLeft = cellStyle.borderLeft;
    if (cellStyle.borderRight) style.borderRight = cellStyle.borderRight;
    
    return style;
  };

  const handleDownloadSummaryPDF = async () => {
    if (sheets.length === 0) return;
    
    try {
      const pdf = new jsPDF();
      const currentSheet = sheets[parseInt(activeSheet)];
      
      // Try to load company logo
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve) => {
        logoImg.onload = () => {
          const maxWidth = 40;
          const ratio = logoImg.height / logoImg.width;
          const width = maxWidth;
          const height = maxWidth * ratio;
          
          pdf.addImage(logoImg, 'PNG', 15, 10, width, height);
          resolve();
        };
        logoImg.onerror = () => resolve();
        logoImg.src = '/src/assets/logo-digitale.png';
      });
      
      // Title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Resumo: ${fileName}`, 60, 25);
      
      // Date and sheet info
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Aba: ${currentSheet.name}`, 60, 32);
      pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 60, 39);
      
      // Separator
      pdf.setDrawColor(200);
      pdf.line(15, 50, 195, 50);
      
      // Statistics
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Estatísticas do Documento', 15, 60);
      
      const nonEmptyRows = currentSheet.data.filter(row => row.some(cell => cell.value.trim() !== '')).length;
      const nonEmptyCols = currentSheet.data[0]?.filter((_, colIdx) => 
        currentSheet.data.some(row => row[colIdx]?.value.trim() !== '')
      ).length || 0;
      const totalCells = currentSheet.data.flat().filter(cell => cell.value.trim() !== '').length;
      const numericCells = currentSheet.data.flat().filter(cell => 
        !isNaN(parseFloat(cell.value)) && cell.value.trim() !== ''
      ).length;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`• Total de linhas com dados: ${nonEmptyRows}`, 20, 70);
      pdf.text(`• Total de colunas com dados: ${nonEmptyCols}`, 20, 77);
      pdf.text(`• Total de células preenchidas: ${totalCells}`, 20, 84);
      pdf.text(`• Células numéricas: ${numericCells}`, 20, 91);
      
      // Table preview
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Prévia dos Dados', 15, 105);
      
      const tableData = currentSheet.data
        .slice(0, 25)
        .filter(row => row.some(cell => cell.value.trim() !== ''))
        .map(row => row.slice(0, 8).map(cell => {
          const display = cell.formattedValue || cell.value;
          return display.length > 25 ? display.substring(0, 22) + '...' : display;
        }));
      
      if (tableData.length > 0) {
        autoTable(pdf, {
          startY: 110,
          head: tableData.length > 0 ? [tableData[0]] : [],
          body: tableData.slice(1),
          theme: 'striped',
          headStyles: { 
            fillColor: [59, 130, 246],
            fontSize: 8,
            fontStyle: 'bold'
          },
          bodyStyles: { fontSize: 7 },
          margin: { left: 15, right: 15 },
          tableWidth: 'auto'
        });
      }
      
      // Footer
      const pageHeight = pdf.internal.pageSize.height;
      pdf.setFontSize(8);
      pdf.setTextColor(128);
      pdf.text('Documento gerado automaticamente pelo Portal Digitale', 105, pageHeight - 10, { align: 'center' });
      
      pdf.save(`resumo-${fileName.replace(/\.[^/.]+$/, '')}.pdf`);
      toast.success('PDF de resumo gerado com sucesso!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Erro ao gerar PDF');
    }
  };

  const getColumnLetter = (index: number): string => {
    let letter = '';
    let i = index;
    while (i >= 0) {
      letter = String.fromCharCode(65 + (i % 26)) + letter;
      i = Math.floor(i / 26) - 1;
    }
    return letter;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] h-full flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle>Visualização: {fileName}</DialogTitle>
            <DialogDescription>
              Pré-visualização da planilha (somente leitura)
            </DialogDescription>
          </div>
          <Button variant="outline" onClick={handleDownloadSummaryPDF} disabled={loading || sheets.length === 0}>
            <FileText className="w-4 h-4 mr-2" />
            Baixar Resumo PDF
          </Button>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2">Carregando planilha...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="w-12 h-12 mb-4 opacity-50" />
              <p>{error}</p>
            </div>
          ) : sheets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="w-12 h-12 mb-4 opacity-50" />
              <p>Planilha vazia</p>
            </div>
          ) : (
            <Tabs value={activeSheet} onValueChange={setActiveSheet} className="h-full flex flex-col">
              {sheets.length > 1 && (
                <TabsList className="w-full justify-start overflow-x-auto flex-shrink-0">
                  {sheets.map((sheet, index) => (
                    <TabsTrigger key={index} value={index.toString()} className="min-w-fit">
                      {sheet.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              )}
              
              {sheets.map((sheet, sheetIndex) => (
                <TabsContent key={sheetIndex} value={sheetIndex.toString()} className="flex-1 min-h-0 mt-2">
                  <ScrollArea className="h-full border rounded-lg">
                    <div className="overflow-auto">
                      <table className="border-collapse text-sm" style={{ minWidth: 'max-content' }}>
                        <thead className="sticky top-0 z-10 bg-muted">
                          <tr>
                            <th className="border border-border px-2 py-1.5 bg-muted/80 min-w-[40px] text-center text-xs font-medium sticky left-0 z-20">
                              #
                            </th>
                            {sheet.data[0]?.map((_, colIndex) => (
                              <th key={colIndex} className="border border-border px-3 py-1.5 bg-muted/80 min-w-[80px] text-xs font-medium text-center">
                                {getColumnLetter(colIndex)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.data.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              <td className="border border-border px-2 py-1 bg-muted/50 text-center text-xs font-medium sticky left-0">
                                {rowIndex + 1}
                              </td>
                              {row.map((cell, colIndex) => (
                                <td 
                                  key={colIndex} 
                                  className="border border-border px-2 py-1 text-sm max-w-[250px]"
                                  style={getCellStyle(cell.style)}
                                  title={cell.value}
                                >
                                  {cell.formattedValue || cell.value}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SpreadsheetPreview;
