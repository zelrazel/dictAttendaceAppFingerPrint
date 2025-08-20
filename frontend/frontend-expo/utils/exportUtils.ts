import * as FileSystem from 'expo-file-system';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface TimeRecord {
  _id: string;
  date: string;
  timeIn?: string;
  timeOut?: string;
  amTimeIn?: string;
  amTimeOut?: string;
  pmTimeIn?: string;
  pmTimeOut?: string;
  undertime?: number;
  makeup?: number;
  makeupDate?: string;
  totalHours: number;
}

interface UserInfo {
  firstName: string;
  middleName?: string;
  lastName: string;
}

interface DateRange {
  startDate: string;
  endDate: string;
}

// Helper: Uint8Array to base64 (for Expo, since Buffer is not available)
function uint8ToBase64(uint8: Uint8Array) {
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return globalThis.btoa ? globalThis.btoa(binary) : (require('base-64').encode(binary));
}

// Helper to format date for display
export const formatRecordDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Helper to format time for display
export const formatRecordTime = (timeString?: string) => {
  if (!timeString) return '--:--';
  const time = new Date(timeString);
  return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
};

// Helper to get download path
export const getDownloadPath = (filename: string) => {
  if (FileSystem.documentDirectory) {
    // Expo Go: fallback to documentDirectory
    return FileSystem.documentDirectory + filename;
  }
  // Bare/standalone: use Download dir
  return FileSystem.cacheDirectory + filename;
};

// Define return types for export functions
type ExportSuccess = { success: true; filePath: string; fileType: 'csv' | 'pdf' };
type ExportFailure = { success: false; error: any; filePath?: never };
type ExportResult = ExportSuccess | ExportFailure;

// Export to CSV
export const exportToCSV = async (timeRecords: TimeRecord[], userInfo?: UserInfo, dateRange?: DateRange): Promise<ExportResult> => {
  try {
    // Create title and user info rows
    const titleRow = ['Daily Time Records'];
    const userRow = userInfo ? [`Name: ${userInfo.firstName} ${userInfo.middleName ? userInfo.middleName + ' ' : ''}${userInfo.lastName}`] : [];
    
    // Add date range row if provided
    const dateRangeRow = dateRange ? [`Date Range: ${dateRange.startDate} to ${dateRange.endDate}`] : [];
    
    // Add empty rows for spacing
    const emptyRow = [''];
    
    const headers = ['Date', 'AM In', 'AM Out', 'PM In', 'PM Out', 'Hours', 'Undertime', 'Makeup', 'Makeup Date'];
    const rows = timeRecords.map(record => [
      formatRecordDate(record.date),
      record.amTimeIn ? formatRecordTime(record.amTimeIn) : '',
      record.amTimeOut ? formatRecordTime(record.amTimeOut) : '',
      record.pmTimeIn ? formatRecordTime(record.pmTimeIn) : '',
      record.pmTimeOut ? formatRecordTime(record.pmTimeOut) : '',
      record.totalHours.toFixed(2),
      record.undertime ? record.undertime.toFixed(2) : '0.00',
      record.makeup ? record.makeup.toFixed(2) : '0.00',
      record.makeupDate ? formatRecordDate(record.makeupDate) : '',
    ]);
    
    // Combine all rows with title, user info, date range at the top
    const allRows = [
      titleRow,
      userRow,
      dateRangeRow,
      emptyRow,
      headers,
      ...rows
    ];
    
    // Clean CSV: title, user info, date range, headers and data rows
    // Ensure proper CSV formatting by handling special characters and quotes
    const csvContent = allRows.map(row => {
      return row.map(cell => {
        // If cell already contains quotes, ensure it's properly escaped
        if (typeof cell === 'string' && cell.includes('"')) {
          // Replace any existing double quotes with two double quotes (CSV escaping)
          const escaped = cell.replace(/"/g, '""');
          return `"${escaped}"`;
        }
        // If cell contains commas, wrap in quotes
        else if (typeof cell === 'string' && cell.includes(',')) {
          return `"${cell}"`;
        }
        return cell;
      }).join(',');
    }).join("\n");
    const fileName = `DTR_Export_${new Date().getFullYear()}_${new Date().getMonth()+1}_${new Date().getDate()}.csv`;
    const fileUri = FileSystem.cacheDirectory + fileName;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
    return { success: true, filePath: fileUri, fileType: 'csv' };
  } catch (e) {
    console.error('Failed to export CSV:', e);
    return { success: false, error: e };
  }
};

// Export to PDF
export const exportToPDF = async (timeRecords: TimeRecord[], userInfo?: UserInfo, dateRange?: DateRange): Promise<ExportResult> => {
  try {
    const pdfDoc = await PDFDocument.create();
    const pageWidth = 700;
    const rowHeight = 32;
    const colWidths = [78, 60, 60, 60, 60, 52, 68, 85, 85]; // slightly smaller columns
    const headers = ['Date', 'AM In', 'AM Out', 'PM In', 'PM Out', 'Hours', 'Undertime', 'Makeup', 'Makeup Date'];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 10; // slightly smaller font
    const titleFontSize = 14; // slightly smaller title
    const margin = 24;
    const tableTop = 120; // Increased to make room for title, user name, and date range
    const numRows = timeRecords.length + 1;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const pageHeight = tableTop + rowHeight * numRows + margin;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    
    // Add title
    const title = "Daily Time Records";
    const titleWidth = boldFont.widthOfTextAtSize(title, titleFontSize);
    page.drawText(title, {
      x: (pageWidth - titleWidth) / 2,
      y: pageHeight - 40,
      size: titleFontSize,
      font: boldFont,
      color: rgb(0,0,0)
    });
    
    // Add user name if provided
    if (userInfo) {
      const userName = `Name: ${userInfo.firstName} ${userInfo.middleName ? userInfo.middleName + ' ' : ''}${userInfo.lastName}`;
      const userNameWidth = font.widthOfTextAtSize(userName, fontSize);
      page.drawText(userName, {
        x: (pageWidth - userNameWidth) / 2,
        y: pageHeight - 70,
        size: fontSize,
        font: font,
        color: rgb(0,0,0)
      });
    }
    
    // Add date range if provided
    if (dateRange) {
      const dateRangeText = `Date Range: ${dateRange.startDate} to ${dateRange.endDate}`;
      const dateRangeWidth = font.widthOfTextAtSize(dateRangeText, fontSize);
      page.drawText(dateRangeText, {
        x: (pageWidth - dateRangeWidth) / 2,
        y: pageHeight - 90,
        size: fontSize,
        font: font,
        color: rgb(0,0,0)
      });
    }
    
    // Draw header row
    let y = pageHeight - tableTop;
    let x = margin;
    headers.forEach((header, i) => {
      const cellWidth = colWidths[i];
      // Center header text
      const textWidth = font.widthOfTextAtSize(header, fontSize);
      const textX = x + (cellWidth - textWidth) / 2;
      const textY = y - (rowHeight / 2) + fontSize / 2;
      page.drawText(header, { x: textX, y: textY, size: fontSize, font, color: rgb(0,0,0) });
      x += cellWidth;
    });
    
    // Draw rows
    y -= rowHeight;
    timeRecords.forEach(record => {
      x = margin;
      const row = [
        formatRecordDate(record.date),
        record.amTimeIn ? formatRecordTime(record.amTimeIn) : '',
        record.amTimeOut ? formatRecordTime(record.amTimeOut) : '',
        record.pmTimeIn ? formatRecordTime(record.pmTimeIn) : '',
        record.pmTimeOut ? formatRecordTime(record.pmTimeOut) : '',
        record.totalHours.toFixed(2),
        record.undertime ? record.undertime.toFixed(2) : '0.00',
        record.makeup ? record.makeup.toFixed(2) : '0.00',
        record.makeupDate ? formatRecordDate(record.makeupDate) : '',
      ];
      row.forEach((cell, i) => {
        const cellWidth = colWidths[i];
        const textWidth = font.widthOfTextAtSize(cell, fontSize);
        const textX = x + (cellWidth - textWidth) / 2;
        const textY = y - (rowHeight / 2) + fontSize / 2;
        page.drawText(cell, { x: textX, y: textY, size: fontSize, font, color: rgb(0,0,0) });
        x += cellWidth;
      });
      y -= rowHeight;
    });
    
    // Draw table lines (borders)
    let colX = margin;
    for (let i = 0; i <= colWidths.length; i++) {
      let lineX = colX;
      page.drawLine({
        start: { x: lineX, y: pageHeight - tableTop + 8 },
        end: { x: lineX, y: pageHeight - tableTop - rowHeight * numRows + 8 },
        thickness: 1,
        color: rgb(0.8,0.8,0.8)
      });
      colX += colWidths[i] || 0;
    }
    
    let rowY = pageHeight - tableTop + 8;
    for (let i = 0; i <= numRows; i++) {
      page.drawLine({
        start: { x: margin, y: rowY },
        end: { x: margin + tableWidth, y: rowY },
        thickness: 1,
        color: rgb(0.8,0.8,0.8)
      });
      rowY -= rowHeight;
    }
    
    const pdfBytes = await pdfDoc.save();
    const base64 = uint8ToBase64(pdfBytes);
    const fileName = `DTR_Export_${new Date().getFullYear()}_${new Date().getMonth()+1}_${new Date().getDate()}.pdf`;
    const fileUri = FileSystem.cacheDirectory + fileName;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return { success: true, filePath: fileUri, fileType: 'pdf' };
  } catch (e) {
    console.error('Failed to export PDF:', e);
    return { success: false, error: e };
  }
};