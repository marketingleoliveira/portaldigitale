import React, { useEffect, useState } from 'react';
import ExcelJS from 'exceljs';
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
  underline?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  borderTop?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderRight?: string;
}

interface CellData {
  value: string;
  formattedValue: string;
  style: CellStyle;
  colspan?: number;
  rowspan?: number;
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

  const argbToHex = (argb: string | undefined | { argb?: string; theme?: number }): string | undefined => {
    if (!argb) return undefined;
    
    if (typeof argb === 'object') {
      if (argb.argb) {
        const hex = argb.argb;
        // ARGB format - remove alpha channel
        if (hex.length === 8) {
          return `#${hex.substring(2)}`;
        }
        return `#${hex}`;
      }
      return undefined;
    }
    
    if (typeof argb === 'string') {
      if (argb.length === 8) {
        return `#${argb.substring(2)}`;
      }
      if (argb.length === 6) {
        return `#${argb}`;
      }
    }
    return undefined;
  };

  const getBorderStyle = (border: Partial<ExcelJS.Border> | undefined): string | undefined => {
    if (!border || !border.style) return undefined;
    
    const color = border.color ? argbToHex(border.color.argb) || '#000000' : '#000000';
    
    const styleMap: Record<string, string> = {
      thin: `1px solid ${color}`,
      medium: `2px solid ${color}`,
      thick: `3px solid ${color}`,
      double: `3px double ${color}`,
      dotted: `1px dotted ${color}`,
      dashed: `1px dashed ${color}`,
      hair: `1px solid ${color}`,
      dashDot: `1px dashed ${color}`,
      dashDotDot: `1px dashed ${color}`,
      slantDashDot: `1px dashed ${color}`,
      mediumDashed: `2px dashed ${color}`,
      mediumDashDot: `2px dashed ${color}`,
      mediumDashDotDot: `2px dashed ${color}`,
    };
    
    return styleMap[border.style] || `1px solid ${color}`;
  };

  const extractCellStyle = (cell: ExcelJS.Cell): CellStyle => {
    const style: CellStyle = {};
    
    // Font styles
    if (cell.font) {
      if (cell.font.bold) style.bold = true;
      if (cell.font.italic) style.italic = true;
      if (cell.font.underline) style.underline = true;
      if (cell.font.size) style.fontSize = cell.font.size;
      if (cell.font.color) {
        const color = argbToHex(cell.font.color.argb);
        if (color && color !== '#000000') style.textColor = color;
      }
    }
    
    // Alignment
    if (cell.alignment) {
      if (cell.alignment.horizontal) {
        style.textAlign = cell.alignment.horizontal as 'left' | 'center' | 'right';
      }
      if (cell.alignment.vertical) {
        style.verticalAlign = cell.alignment.vertical as 'top' | 'middle' | 'bottom';
      }
    }
    
    // Fill/Background
    if (cell.fill && cell.fill.type === 'pattern') {
      const patternFill = cell.fill as ExcelJS.FillPattern;
      if (patternFill.fgColor) {
        const bgColor = argbToHex(patternFill.fgColor.argb);
        if (bgColor && bgColor !== '#FFFFFF') {
          style.backgroundColor = bgColor;
        }
      }
    }
    
    // Borders
    if (cell.border) {
      style.borderTop = getBorderStyle(cell.border.top);
      style.borderBottom = getBorderStyle(cell.border.bottom);
      style.borderLeft = getBorderStyle(cell.border.left);
      style.borderRight = getBorderStyle(cell.border.right);
    }
    
    return style;
  };

  const formatCellValue = (cell: ExcelJS.Cell): string => {
    const value = cell.value;
    
    if (value === null || value === undefined) return '';
    
    // Handle formula results
    if (typeof value === 'object' && 'result' in value) {
      const result = (value as ExcelJS.CellFormulaValue).result;
      if (result !== undefined) {
        return formatValue(result, cell.numFmt);
      }
    }
    
    // Handle rich text
    if (typeof value === 'object' && 'richText' in value) {
      return (value as ExcelJS.CellRichTextValue).richText.map(rt => rt.text).join('');
    }
    
    // Handle hyperlinks
    if (typeof value === 'object' && 'hyperlink' in value) {
      return (value as ExcelJS.CellHyperlinkValue).text || '';
    }
    
    // Handle dates
    if (value instanceof Date) {
      return value.toLocaleDateString('pt-BR');
    }
    
    return formatValue(value, cell.numFmt);
  };

  const formatValue = (value: any, numFmt: string | undefined): string => {
    if (value === null || value === undefined) return '';
    
    if (typeof value === 'number') {
      if (numFmt) {
        const fmt = numFmt.toLowerCase();
        
        // Currency formats
        if (fmt.includes('r$') || fmt.includes('"r$"') || fmt.includes('[$r$')) {
          return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        if (fmt.includes('$') || fmt.includes('usd') || fmt.includes('[$$')) {
          return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        }
        if (fmt.includes('€') || fmt.includes('eur')) {
          return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        }
        
        // Percentage
        if (fmt.includes('%')) {
          return (value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
        }
        
        // Accounting format
        if (fmt.includes('(') || fmt.includes('_')) {
          if (value < 0) {
            return `(${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
          }
        }
        
        // Check for decimal places in format
        const decimalMatch = fmt.match(/\.([0#]+)/);
        if (decimalMatch) {
          const decimals = decimalMatch[1].length;
          return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        }
        
        // Thousands separator
        if (fmt.includes(',') || fmt.includes('#')) {
          return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
      }
      
      // Default number formatting
      if (Number.isInteger(value)) {
        return value.toLocaleString('pt-BR');
      }
      return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    return String(value);
  };

  const loadSpreadsheet = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Erro ao carregar arquivo');
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      
      const sheetsData: SheetData[] = [];
      
      workbook.eachSheet((worksheet) => {
        const cellData: CellData[][] = [];
        const rowCount = worksheet.rowCount;
        const colCount = worksheet.columnCount;
        
        for (let rowNum = 1; rowNum <= rowCount; rowNum++) {
          const rowData: CellData[] = [];
          const row = worksheet.getRow(rowNum);
          
          for (let colNum = 1; colNum <= colCount; colNum++) {
            const cell = row.getCell(colNum);
            
            const rawValue = cell.value;
            const value = rawValue !== null && rawValue !== undefined ? String(rawValue) : '';
            const formattedValue = formatCellValue(cell);
            const style = extractCellStyle(cell);
            
            rowData.push({ value, formattedValue, style });
          }
          
          cellData.push(rowData);
        }
        
        sheetsData.push({
          name: worksheet.name,
          data: cellData
        });
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
    if (cellStyle.underline) style.textDecoration = 'underline';
    if (cellStyle.textAlign) style.textAlign = cellStyle.textAlign;
    if (cellStyle.verticalAlign) style.verticalAlign = cellStyle.verticalAlign;
    if (cellStyle.backgroundColor) style.backgroundColor = cellStyle.backgroundColor;
    if (cellStyle.textColor) style.color = cellStyle.textColor;
    if (cellStyle.fontSize) style.fontSize = `${cellStyle.fontSize}pt`;
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
        <DialogHeader>
          <div className="flex flex-row items-center justify-between w-full">
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
          </div>
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
                  <ScrollArea className="h-full border rounded-lg bg-white">
                    <div className="overflow-auto">
                      <table className="border-collapse text-sm" style={{ minWidth: 'max-content' }}>
                        <thead className="sticky top-0 z-10">
                          <tr>
                            <th className="border border-gray-300 px-2 py-1.5 bg-gray-100 min-w-[40px] text-center text-xs font-medium sticky left-0 z-20 text-gray-700">
                              #
                            </th>
                            {sheet.data[0]?.map((_, colIndex) => (
                              <th key={colIndex} className="border border-gray-300 px-3 py-1.5 bg-gray-100 min-w-[80px] text-xs font-medium text-center text-gray-700">
                                {getColumnLetter(colIndex)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.data.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              <td className="border border-gray-300 px-2 py-1 bg-gray-50 text-center text-xs font-medium sticky left-0 text-gray-600">
                                {rowIndex + 1}
                              </td>
                              {row.map((cell, colIndex) => {
                                const cellStyles = getCellStyle(cell.style);
                                const hasCustomBorder = cell.style.borderTop || cell.style.borderBottom || 
                                                        cell.style.borderLeft || cell.style.borderRight;
                                
                                return (
                                  <td 
                                    key={colIndex} 
                                    className="px-2 py-1 text-sm max-w-[300px] whitespace-nowrap text-gray-900"
                                    style={{
                                      border: hasCustomBorder ? undefined : '1px solid #d1d5db',
                                      ...cellStyles
                                    }}
                                    title={cell.value}
                                  >
                                    {cell.formattedValue || cell.value}
                                  </td>
                                );
                              })}
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
