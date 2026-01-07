import React, { useEffect, useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Save, Download, Loader2, Plus, Trash2, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Undo, Redo, FileText, Type, Palette, Square, Minus, Grid3X3 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type BorderStyle = 'none' | 'thin' | 'medium' | 'thick' | 'double';

interface CellBorders {
  top?: { style: BorderStyle; color: string };
  right?: { style: BorderStyle; color: string };
  bottom?: { style: BorderStyle; color: string };
  left?: { style: BorderStyle; color: string };
}

interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  textColor?: string;
  borders?: CellBorders;
  fontSize?: number;
}

interface CellData {
  value: string;
  formula?: string;
  style?: CellStyle;
}

interface SpreadsheetEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName: string;
  fileId: string;
  onSave?: () => void;
}

// Formula evaluation functions
const evaluateFormula = (formula: string, data: CellData[][]): string => {
  if (!formula.startsWith('=')) return formula;
  
  const cleanFormula = formula.substring(1).toUpperCase();
  
  try {
    // SUM function
    if (cleanFormula.startsWith('SUM(')) {
      const range = cleanFormula.match(/SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/);
      if (range) {
        const [, startCol, startRow, endCol, endRow] = range;
        const values = getCellRange(data, startCol, parseInt(startRow), endCol, parseInt(endRow));
        const sum = values.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
        return sum.toString();
      }
    }
    
    // AVERAGE function
    if (cleanFormula.startsWith('AVERAGE(') || cleanFormula.startsWith('MEDIA(')) {
      const range = cleanFormula.match(/(?:AVERAGE|MEDIA)\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/);
      if (range) {
        const [, startCol, startRow, endCol, endRow] = range;
        const values = getCellRange(data, startCol, parseInt(startRow), endCol, parseInt(endRow));
        const nums = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
        const avg = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        return avg.toFixed(2);
      }
    }
    
    // COUNT function
    if (cleanFormula.startsWith('COUNT(') || cleanFormula.startsWith('CONT(')) {
      const range = cleanFormula.match(/(?:COUNT|CONT)\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/);
      if (range) {
        const [, startCol, startRow, endCol, endRow] = range;
        const values = getCellRange(data, startCol, parseInt(startRow), endCol, parseInt(endRow));
        const count = values.filter(v => !isNaN(parseFloat(v)) && v !== '').length;
        return count.toString();
      }
    }
    
    // MAX function
    if (cleanFormula.startsWith('MAX(') || cleanFormula.startsWith('MAXIMO(')) {
      const range = cleanFormula.match(/(?:MAX|MAXIMO)\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/);
      if (range) {
        const [, startCol, startRow, endCol, endRow] = range;
        const values = getCellRange(data, startCol, parseInt(startRow), endCol, parseInt(endRow));
        const nums = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
        return nums.length > 0 ? Math.max(...nums).toString() : '0';
      }
    }
    
    // MIN function
    if (cleanFormula.startsWith('MIN(') || cleanFormula.startsWith('MINIMO(')) {
      const range = cleanFormula.match(/(?:MIN|MINIMO)\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/);
      if (range) {
        const [, startCol, startRow, endCol, endRow] = range;
        const values = getCellRange(data, startCol, parseInt(startRow), endCol, parseInt(endRow));
        const nums = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
        return nums.length > 0 ? Math.min(...nums).toString() : '0';
      }
    }
    
    // Simple arithmetic with cell references (e.g., =A1+B1, =A1*2)
    let expression = cleanFormula;
    const cellRefs = expression.match(/[A-Z]+\d+/g);
    if (cellRefs) {
      cellRefs.forEach(ref => {
        const col = ref.match(/[A-Z]+/)?.[0] || 'A';
        const row = parseInt(ref.match(/\d+/)?.[0] || '1');
        const colIndex = columnLetterToIndex(col);
        const rowIndex = row - 1;
        const cellValue = data[rowIndex]?.[colIndex]?.value || '0';
        const numValue = parseFloat(cellValue) || 0;
        expression = expression.replace(ref, numValue.toString());
      });
      
      // Safe eval for basic math
      const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
      if (sanitized) {
        const result = Function('"use strict"; return (' + sanitized + ')')();
        return typeof result === 'number' ? (Number.isInteger(result) ? result.toString() : result.toFixed(2)) : result;
      }
    }
    
    return formula;
  } catch (e) {
    return '#ERROR';
  }
};

const columnLetterToIndex = (letter: string): number => {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
};

const getCellRange = (data: CellData[][], startCol: string, startRow: number, endCol: string, endRow: number): string[] => {
  const values: string[] = [];
  const startColIdx = columnLetterToIndex(startCol);
  const endColIdx = columnLetterToIndex(endCol);
  
  for (let row = startRow - 1; row <= endRow - 1; row++) {
    for (let col = startColIdx; col <= endColIdx; col++) {
      if (data[row]?.[col]) {
        values.push(data[row][col].value);
      }
    }
  }
  
  return values;
};

const SpreadsheetEditor: React.FC<SpreadsheetEditorProps> = ({
  open,
  onOpenChange,
  fileUrl,
  fileName,
  fileId,
  onSave
}) => {
  const [data, setData] = useState<CellData[][]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{row: number; col: number} | null>(null);
  const [selectedRange, setSelectedRange] = useState<{startRow: number; startCol: number; endRow: number; endCol: number} | null>(null);
  const [editingCell, setEditingCell] = useState<{row: number; col: number} | null>(null);
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [history, setHistory] = useState<CellData[][][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isSelecting, setIsSelecting] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (open && fileUrl) {
      loadSpreadsheet();
    }
  }, [open, fileUrl]);

  useEffect(() => {
    if (selectedCell && data[selectedCell.row]?.[selectedCell.col]) {
      const cell = data[selectedCell.row][selectedCell.col];
      setFormulaBarValue(cell.formula || cell.value);
    }
  }, [selectedCell, data]);

  const saveToHistory = useCallback((newData: CellData[][]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newData)));
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const loadSpreadsheet = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Erro ao carregar arquivo');
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true, cellFormula: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: '' });
      
      const minRows = Math.max(jsonData.length, 30);
      const maxCols = Math.max(...jsonData.map(row => row.length), 15);
      
      const normalizedData: CellData[][] = [];
      for (let i = 0; i < minRows; i++) {
        const row = jsonData[i] || [];
        const normalizedRow: CellData[] = [];
        for (let j = 0; j < maxCols; j++) {
          const value = String(row[j] ?? '');
          const cellRef = XLSX.utils.encode_cell({ r: i, c: j });
          const cell = worksheet[cellRef];
          
          // Extract formatting from original cell
          let cellStyle: CellStyle | undefined = undefined;
          if (cell?.s) {
            const s = cell.s;
            cellStyle = {};
            
            // Font styling
            if (s.font?.bold) cellStyle.bold = true;
            if (s.font?.italic) cellStyle.italic = true;
            
            // Alignment
            if (s.alignment?.horizontal) {
              cellStyle.align = s.alignment.horizontal as 'left' | 'center' | 'right';
            }
            
            // Background color
            if (s.fill?.fgColor?.rgb) {
              cellStyle.backgroundColor = `#${s.fill.fgColor.rgb}`;
            }
            
            // Text color
            if (s.font?.color?.rgb) {
              cellStyle.textColor = `#${s.font.color.rgb}`;
            }
            
            // Borders
            if (s.border) {
              cellStyle.borders = {};
              const borderColor = '#000000';
              if (s.border.top) cellStyle.borders.top = { style: 'thin', color: borderColor };
              if (s.border.right) cellStyle.borders.right = { style: 'thin', color: borderColor };
              if (s.border.bottom) cellStyle.borders.bottom = { style: 'thin', color: borderColor };
              if (s.border.left) cellStyle.borders.left = { style: 'thin', color: borderColor };
            }
          }
          
          // Default header row styling if no style detected
          if (!cellStyle && i === 0) {
            cellStyle = { bold: true, backgroundColor: '#f3f4f6' };
          }
          
          normalizedRow.push({
            value,
            formula: cell?.f ? `=${cell.f}` : (value.startsWith('=') ? value : undefined),
            style: cellStyle
          });
        }
        normalizedData.push(normalizedRow);
      }
      
      setData(normalizedData);
      setHistory([JSON.parse(JSON.stringify(normalizedData))]);
      setHistoryIndex(0);
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
      const newData = prev.map(row => row.map(cell => ({ ...cell })));
      const isFormula = value.startsWith('=');
      
      newData[rowIndex][colIndex] = {
        ...newData[rowIndex][colIndex],
        value: isFormula ? evaluateFormula(value, newData) : value,
        formula: isFormula ? value : undefined
      };
      
      saveToHistory(newData);
      return newData;
    });
    setHasChanges(true);
  };

  const handleFormulaBarChange = (value: string) => {
    setFormulaBarValue(value);
  };

  const handleFormulaBarSubmit = () => {
    if (selectedCell) {
      handleCellChange(selectedCell.row, selectedCell.col, formulaBarValue);
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setData(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setData(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  const applyStyle = (styleUpdate: Partial<CellStyle>) => {
    if (!selectedCell && !selectedRange) return;
    
    setData(prev => {
      const newData = prev.map(row => row.map(cell => ({ ...cell })));
      
      const startRow = selectedRange?.startRow ?? selectedCell!.row;
      const endRow = selectedRange?.endRow ?? selectedCell!.row;
      const startCol = selectedRange?.startCol ?? selectedCell!.col;
      const endCol = selectedRange?.endCol ?? selectedCell!.col;
      
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          newData[r][c] = {
            ...newData[r][c],
            style: { ...newData[r][c].style, ...styleUpdate }
          };
        }
      }
      
      saveToHistory(newData);
      return newData;
    });
    setHasChanges(true);
  };

  const addRow = () => {
    setData(prev => {
      const newRow = new Array(prev[0]?.length || 15).fill(null).map(() => ({ value: '' }));
      const newData = [...prev, newRow];
      saveToHistory(newData);
      return newData;
    });
    setHasChanges(true);
  };

  const addColumn = () => {
    setData(prev => {
      const newData = prev.map(row => [...row, { value: '' }]);
      saveToHistory(newData);
      return newData;
    });
    setHasChanges(true);
  };

  const deleteRow = (index: number) => {
    if (data.length <= 1) return;
    setData(prev => {
      const newData = prev.filter((_, i) => i !== index);
      saveToHistory(newData);
      return newData;
    });
    setHasChanges(true);
  };

  const deleteColumn = (index: number) => {
    if ((data[0]?.length || 0) <= 1) return;
    setData(prev => {
      const newData = prev.map(row => row.filter((_, i) => i !== index));
      saveToHistory(newData);
      return newData;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rawData = data.map(row => row.map(cell => cell.formula || cell.value));
      const worksheet = XLSX.utils.aoa_to_sheet(rawData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const newFileName = fileName.replace(/\.[^/.]+$/, '') + '.xlsx';
      const filePath = `${Date.now()}-${newFileName.replace(/\s+/g, '-')}`;
      
      const { error: uploadError } = await supabase.storage
        .from('price-files')
        .upload(filePath, blob);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('price-files')
        .getPublicUrl(filePath);
      
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
    const rawData = data.map(row => row.map(cell => cell.formula || cell.value));
    const worksheet = XLSX.utils.aoa_to_sheet(rawData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, fileName.replace(/\.[^/.]+$/, '') + '.xlsx');
    toast.success('Download realizado!');
  };

  const handleDownloadSummaryPDF = async () => {
    try {
      const pdf = new jsPDF();
      
      // Load and add company logo
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve) => {
        logoImg.onload = () => {
          // Calculate proportional size (max width 40, maintain aspect ratio)
          const maxWidth = 40;
          const ratio = logoImg.height / logoImg.width;
          const width = maxWidth;
          const height = maxWidth * ratio;
          
          pdf.addImage(logoImg, 'PNG', 15, 10, width, height);
          resolve();
        };
        logoImg.onerror = () => resolve(); // Continue without logo if it fails
        logoImg.src = '/src/assets/logo-digitale.png';
      });
      
      // Title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Resumo: ${fileName}`, 60, 25);
      
      // Date
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 60, 32);
      
      // Separator line
      pdf.setDrawColor(200);
      pdf.line(15, 45, 195, 45);
      
      // Summary statistics
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Estatísticas do Documento', 15, 55);
      
      const nonEmptyRows = data.filter(row => row.some(cell => cell.value.trim() !== '')).length;
      const nonEmptyCols = data[0]?.filter((_, colIdx) => data.some(row => row[colIdx]?.value.trim() !== '')).length || 0;
      const totalCells = data.flat().filter(cell => cell.value.trim() !== '').length;
      const numericCells = data.flat().filter(cell => !isNaN(parseFloat(cell.value)) && cell.value.trim() !== '').length;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`• Total de linhas com dados: ${nonEmptyRows}`, 20, 65);
      pdf.text(`• Total de colunas com dados: ${nonEmptyCols}`, 20, 72);
      pdf.text(`• Total de células preenchidas: ${totalCells}`, 20, 79);
      pdf.text(`• Células numéricas: ${numericCells}`, 20, 86);
      
      // Table preview (first 20 rows max)
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Prévia dos Dados', 15, 100);
      
      const tableData = data
        .slice(0, 20)
        .filter(row => row.some(cell => cell.value.trim() !== ''))
        .map(row => row.slice(0, 8).map(cell => cell.value.substring(0, 20)));
      
      if (tableData.length > 0) {
        autoTable(pdf, {
          startY: 105,
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

  const handleMouseDown = (rowIndex: number, colIndex: number) => {
    setIsSelecting(true);
    setSelectedCell({ row: rowIndex, col: colIndex });
    setSelectedRange({ startRow: rowIndex, startCol: colIndex, endRow: rowIndex, endCol: colIndex });
  };

  const handleMouseEnter = (rowIndex: number, colIndex: number) => {
    if (isSelecting && selectedRange) {
      setSelectedRange(prev => prev ? {
        ...prev,
        endRow: rowIndex,
        endCol: colIndex
      } : null);
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const isCellSelected = (rowIndex: number, colIndex: number) => {
    if (!selectedRange) return selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
    
    const minRow = Math.min(selectedRange.startRow, selectedRange.endRow);
    const maxRow = Math.max(selectedRange.startRow, selectedRange.endRow);
    const minCol = Math.min(selectedRange.startCol, selectedRange.endCol);
    const maxCol = Math.max(selectedRange.startCol, selectedRange.endCol);
    
    return rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol;
  };

  const getBorderStyle = (border?: { style: BorderStyle; color: string }): string => {
    if (!border || border.style === 'none') return '';
    const widthMap: Record<BorderStyle, string> = {
      none: '0px',
      thin: '1px',
      medium: '2px',
      thick: '3px',
      double: '3px'
    };
    const styleMap: Record<BorderStyle, string> = {
      none: 'none',
      thin: 'solid',
      medium: 'solid',
      thick: 'solid',
      double: 'double'
    };
    return `${widthMap[border.style]} ${styleMap[border.style]} ${border.color}`;
  };

  const getCellStyle = (cell: CellData): React.CSSProperties => {
    const style: React.CSSProperties = {};
    if (cell.style?.bold) style.fontWeight = 'bold';
    if (cell.style?.italic) style.fontStyle = 'italic';
    if (cell.style?.align) style.textAlign = cell.style.align;
    if (cell.style?.backgroundColor) style.backgroundColor = cell.style.backgroundColor;
    if (cell.style?.textColor) style.color = cell.style.textColor;
    if (cell.style?.fontSize) style.fontSize = `${cell.style.fontSize}px`;
    
    // Apply borders
    if (cell.style?.borders) {
      if (cell.style.borders.top) style.borderTop = getBorderStyle(cell.style.borders.top);
      if (cell.style.borders.right) style.borderRight = getBorderStyle(cell.style.borders.right);
      if (cell.style.borders.bottom) style.borderBottom = getBorderStyle(cell.style.borders.bottom);
      if (cell.style.borders.left) style.borderLeft = getBorderStyle(cell.style.borders.left);
    }
    
    return style;
  };

  const applyBorder = (borderType: 'all' | 'outer' | 'inner' | 'top' | 'right' | 'bottom' | 'left' | 'none', borderStyle: BorderStyle = 'thin', borderColor: string = '#000000') => {
    if (!selectedCell && !selectedRange) return;
    
    setData(prev => {
      const newData = prev.map(row => row.map(cell => ({ ...cell })));
      
      const startRow = selectedRange?.startRow ?? selectedCell!.row;
      const endRow = selectedRange?.endRow ?? selectedCell!.row;
      const startCol = selectedRange?.startCol ?? selectedCell!.col;
      const endCol = selectedRange?.endCol ?? selectedCell!.col;
      
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const borders: CellBorders = { ...newData[r][c].style?.borders };
          const border = { style: borderStyle, color: borderColor };
          const noBorder = { style: 'none' as BorderStyle, color: borderColor };
          
          switch (borderType) {
            case 'all':
              borders.top = border;
              borders.right = border;
              borders.bottom = border;
              borders.left = border;
              break;
            case 'outer':
              if (r === minRow) borders.top = border;
              if (r === maxRow) borders.bottom = border;
              if (c === minCol) borders.left = border;
              if (c === maxCol) borders.right = border;
              break;
            case 'inner':
              if (r > minRow) borders.top = border;
              if (r < maxRow) borders.bottom = border;
              if (c > minCol) borders.left = border;
              if (c < maxCol) borders.right = border;
              break;
            case 'top':
              borders.top = border;
              break;
            case 'right':
              borders.right = border;
              break;
            case 'bottom':
              borders.bottom = border;
              break;
            case 'left':
              borders.left = border;
              break;
            case 'none':
              borders.top = noBorder;
              borders.right = noBorder;
              borders.bottom = noBorder;
              borders.left = noBorder;
              break;
          }
          
          newData[r][c] = {
            ...newData[r][c],
            style: { ...newData[r][c].style, borders }
          };
        }
      }
      
      saveToHistory(newData);
      return newData;
    });
    setHasChanges(true);
  };

  const [currentBorderColor, setCurrentBorderColor] = useState('#000000');
  const [currentBorderStyle, setCurrentBorderStyle] = useState<BorderStyle>('thin');

  const currentCellStyle = selectedCell ? data[selectedCell.row]?.[selectedCell.col]?.style : undefined;

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
      <DialogContent className="max-w-[98vw] w-full max-h-[98vh] h-full flex flex-col p-3">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">Editor de Planilha: {fileName}</DialogTitle>
          <DialogDescription className="text-xs">
            Edite as células diretamente. Use fórmulas como =SUM(A1:A10), =AVERAGE(B1:B5), =MAX(C1:C10), =MIN(D1:D5) ou operações básicas como =A1+B1
          </DialogDescription>
        </DialogHeader>
        
        {/* Toolbar */}
        <TooltipProvider>
          <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/50 rounded-lg border">
            {/* File operations */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0} className="h-8 w-8 p-0">
                    <Undo className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1} className="h-8 w-8 p-0">
                    <Redo className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refazer (Ctrl+Y)</TooltipContent>
              </Tooltip>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            {/* Text formatting */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={currentCellStyle?.bold ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => applyStyle({ bold: !currentCellStyle?.bold })}
                    className="h-8 w-8 p-0"
                  >
                    <Bold className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Negrito</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={currentCellStyle?.italic ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => applyStyle({ italic: !currentCellStyle?.italic })}
                    className="h-8 w-8 p-0"
                  >
                    <Italic className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Itálico</TooltipContent>
              </Tooltip>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            {/* Alignment */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={currentCellStyle?.align === 'left' ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => applyStyle({ align: 'left' })}
                    className="h-8 w-8 p-0"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Alinhar à esquerda</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={currentCellStyle?.align === 'center' ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => applyStyle({ align: 'center' })}
                    className="h-8 w-8 p-0"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Centralizar</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={currentCellStyle?.align === 'right' ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => applyStyle({ align: 'right' })}
                    className="h-8 w-8 p-0"
                  >
                    <AlignRight className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Alinhar à direita</TooltipContent>
              </Tooltip>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            {/* Colors */}
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Palette className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Cor de fundo</TooltipContent>
                </Tooltip>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => applyStyle({ backgroundColor: undefined })}>
                    <div className="w-4 h-4 border mr-2" /> Sem cor
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ backgroundColor: '#fef3c7' })}>
                    <div className="w-4 h-4 bg-yellow-100 mr-2" /> Amarelo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ backgroundColor: '#dcfce7' })}>
                    <div className="w-4 h-4 bg-green-100 mr-2" /> Verde
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ backgroundColor: '#dbeafe' })}>
                    <div className="w-4 h-4 bg-blue-100 mr-2" /> Azul
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ backgroundColor: '#fce7f3' })}>
                    <div className="w-4 h-4 bg-pink-100 mr-2" /> Rosa
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ backgroundColor: '#f3f4f6' })}>
                    <div className="w-4 h-4 bg-gray-100 mr-2" /> Cinza
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Type className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Cor do texto</TooltipContent>
                </Tooltip>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => applyStyle({ textColor: undefined })}>
                    <span className="text-foreground mr-2">A</span> Padrão
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ textColor: '#dc2626' })}>
                    <span className="text-red-600 mr-2">A</span> Vermelho
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ textColor: '#16a34a' })}>
                    <span className="text-green-600 mr-2">A</span> Verde
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ textColor: '#2563eb' })}>
                    <span className="text-blue-600 mr-2">A</span> Azul
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ textColor: '#9333ea' })}>
                    <span className="text-purple-600 mr-2">A</span> Roxo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            {/* Borders */}
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Grid3X3 className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Bordas</TooltipContent>
                </Tooltip>
                <DropdownMenuContent className="w-56 bg-popover">
                  <DropdownMenuLabel>Tipo de Borda</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => applyBorder('all', currentBorderStyle, currentBorderColor)}>
                    <div className="w-5 h-5 border-2 border-current mr-2" /> Todas as Bordas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyBorder('outer', currentBorderStyle, currentBorderColor)}>
                    <div className="w-5 h-5 border-2 border-current mr-2 flex items-center justify-center">
                      <div className="w-3 h-3" />
                    </div> Borda Externa
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyBorder('inner', currentBorderStyle, currentBorderColor)}>
                    <div className="w-5 h-5 border border-transparent mr-2 flex items-center justify-center">
                      <div className="w-full h-0.5 bg-current absolute" />
                      <div className="h-full w-0.5 bg-current absolute" />
                    </div> Bordas Internas
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => applyBorder('top', currentBorderStyle, currentBorderColor)}>
                    <div className="w-5 h-5 border-t-2 border-current mr-2" /> Borda Superior
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyBorder('bottom', currentBorderStyle, currentBorderColor)}>
                    <div className="w-5 h-5 border-b-2 border-current mr-2" /> Borda Inferior
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyBorder('left', currentBorderStyle, currentBorderColor)}>
                    <div className="w-5 h-5 border-l-2 border-current mr-2" /> Borda Esquerda
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyBorder('right', currentBorderStyle, currentBorderColor)}>
                    <div className="w-5 h-5 border-r-2 border-current mr-2" /> Borda Direita
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => applyBorder('none')}>
                    <div className="w-5 h-5 border border-dashed border-muted-foreground/50 mr-2" /> Sem Bordas
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Minus className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Estilo da Borda</TooltipContent>
                </Tooltip>
                <DropdownMenuContent className="bg-popover">
                  <DropdownMenuLabel>Espessura</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setCurrentBorderStyle('thin')}>
                    <div className="w-8 h-0 border-t border-current mr-2" /> Fina
                    {currentBorderStyle === 'thin' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentBorderStyle('medium')}>
                    <div className="w-8 h-0 border-t-2 border-current mr-2" /> Média
                    {currentBorderStyle === 'medium' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentBorderStyle('thick')}>
                    <div className="w-8 h-0 border-t-[3px] border-current mr-2" /> Grossa
                    {currentBorderStyle === 'thick' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentBorderStyle('double')}>
                    <div className="w-8 border-t-[3px] border-double border-current mr-2" /> Dupla
                    {currentBorderStyle === 'double' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Cor da Borda</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setCurrentBorderColor('#000000')}>
                    <div className="w-4 h-4 bg-black mr-2 rounded" /> Preto
                    {currentBorderColor === '#000000' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentBorderColor('#6b7280')}>
                    <div className="w-4 h-4 bg-gray-500 mr-2 rounded" /> Cinza
                    {currentBorderColor === '#6b7280' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentBorderColor('#dc2626')}>
                    <div className="w-4 h-4 bg-red-600 mr-2 rounded" /> Vermelho
                    {currentBorderColor === '#dc2626' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentBorderColor('#2563eb')}>
                    <div className="w-4 h-4 bg-blue-600 mr-2 rounded" /> Azul
                    {currentBorderColor === '#2563eb' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentBorderColor('#16a34a')}>
                    <div className="w-4 h-4 bg-green-600 mr-2 rounded" /> Verde
                    {currentBorderColor === '#16a34a' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            {/* Row/Column operations */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={addRow} className="h-8 px-2">
                    <Plus className="w-4 h-4 mr-1" />
                    Linha
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Adicionar linha</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={addColumn} className="h-8 px-2">
                    <Plus className="w-4 h-4 mr-1" />
                    Coluna
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Adicionar coluna</TooltipContent>
              </Tooltip>
            </div>
            
            <div className="flex-1" />
            
            {/* Cell reference */}
            {selectedCell && (
              <span className="text-xs text-muted-foreground px-2 bg-background rounded border">
                {getColumnLetter(selectedCell.col)}{selectedCell.row + 1}
              </span>
            )}
          </div>
        </TooltipProvider>
        
        {/* Formula Bar */}
        <div className="flex items-center gap-2 px-2">
          <span className="text-xs font-medium text-muted-foreground w-8">fx</span>
          <Input
            value={formulaBarValue}
            onChange={(e) => handleFormulaBarChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleFormulaBarSubmit();
              }
            }}
            onBlur={handleFormulaBarSubmit}
            placeholder="Digite um valor ou fórmula (ex: =SUM(A1:A10))"
            className="h-8 text-sm font-mono"
          />
        </div>
        
        {/* Spreadsheet */}
        <div className="flex-1 min-h-0 overflow-hidden border rounded-lg" onMouseUp={handleMouseUp}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2">Carregando planilha...</span>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="overflow-auto">
                <table ref={tableRef} className="border-collapse text-sm select-none" style={{ minWidth: 'max-content' }}>
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="border border-border p-0 bg-muted min-w-[40px] w-[40px] text-center text-xs font-medium sticky left-0 z-20">#</th>
                      {data[0]?.map((_, colIndex) => (
                        <th key={colIndex} className="border border-border p-0 bg-muted min-w-[100px]">
                          <div className="flex items-center justify-between px-2 py-1">
                            <span className="font-medium text-xs">{getColumnLetter(colIndex)}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 opacity-30 hover:opacity-100"
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
                        <td className="border border-border p-0 bg-muted text-center text-xs font-medium sticky left-0 z-10">
                          <div className="flex items-center justify-between px-1 py-0.5">
                            <span className="flex-1 text-center">{rowIndex + 1}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 opacity-30 hover:opacity-100"
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
                              isCellSelected(rowIndex, colIndex)
                                ? 'ring-2 ring-primary ring-inset bg-primary/5' 
                                : ''
                            }`}
                            style={getCellStyle(cell)}
                            onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                            onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                            onDoubleClick={() => setEditingCell({ row: rowIndex, col: colIndex })}
                          >
                            {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                              <Input
                                value={cell.formula || cell.value}
                                onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                onBlur={() => setEditingCell(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Tab') {
                                    setEditingCell(null);
                                    if (e.key === 'Tab') {
                                      e.preventDefault();
                                      setSelectedCell({ row: rowIndex, col: colIndex + 1 });
                                    }
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                                autoFocus
                                className="border-0 rounded-none h-7 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 font-mono"
                                style={getCellStyle(cell)}
                              />
                            ) : (
                              <div 
                                className="px-2 py-1 h-7 flex items-center text-sm overflow-hidden whitespace-nowrap"
                                style={getCellStyle(cell)}
                              >
                                {cell.value}
                              </div>
                            )}
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
        
        <DialogFooter className="flex-shrink-0 pt-2">
          <Button variant="outline" onClick={handleDownloadSummaryPDF} disabled={loading}>
            <FileText className="w-4 h-4 mr-2" />
            Baixar Resumo PDF
          </Button>
          <Button variant="outline" onClick={handleDownload} disabled={loading}>
            <Download className="w-4 h-4 mr-2" />
            Baixar Excel
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