import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { RFQRow } from '../types';

// Project44 LTL/VLTL accessorial codes
const PROJECT44_ACCESSORIAL_CODES = [
  'AIRPU', 'APPTPU', 'CAMPPU', 'CFSPU', 'CHRCPU', 'CLUBPU', 'CNVPU', 'CONPU', 'DOCKPU', 'EDUPU',
  'FARMPU', 'GOVPU', 'GROPU', 'HOSPU', 'HOTLPU', 'INPU', 'LGPU', 'LTDPU', 'MILPU', 'MINEPU',
  'NARPU', 'NBPU', 'NURSPU', 'PARKPU', 'PIERPU', 'PRISPU', 'RESPU', 'SATPU', 'SORTPU', 'SSTORPU', 'UTLPU',
  'AIRDEL', 'APPT', 'APPTDEL', 'CAMPDEL', 'CFSDEL', 'CHRCDEL', 'CLUBDEL', 'CNVDEL', 'CONDEL', 'DCDEL',
  'DOCKDEL', 'EDUDEL', 'FARMDEL', 'GOVDEL', 'GRODEL', 'HDAYDEL', 'HOSDEL', 'HOTLDEL', 'INDEL', 'INEDEL',
  'INGDEL', 'INNEDEL', 'LGDEL', 'LTDDEL', 'MALLDEL', 'MILDEL', 'MINEDEL', 'NARDEL', 'NBDEL', 'NCDEL',
  'NOTIFY', 'NURSDEL', 'PARKDEL', 'PIERDEL', 'PRISDEL', 'RESDEL', 'RSRTDEL', 'SATDEL', 'SORTDEL',
  'SSTORDEL', 'SUNDEL', 'UNLOADDEL', 'UTLDEL', 'WEDEL'
];

// FreshX accessorial codes
const FRESHX_ACCESSORIAL_CODES = [
  'DRIVER_LOADING_PICKUP', 'DRIVER_LOADING_DROPOFF', 'INSIDE_DELIVERY_PICKUP', 'INSIDE_DELIVERY_DROPOFF',
  'LIFTGATE_PICKUP', 'LIFTGATE_DROPOFF', 'LIMITED_ACCESS_PICKUP', 'LIMITED_ACCESS_DROPOFF',
  'NIGHTTIME_DELIVERY_PICKUP', 'NIGHTTIME_DELIVERY_DROPOFF'
];

export const parseCSV = (file: File, isProject44: boolean = false): Promise<RFQRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, ''),
      transform: (value) => value.trim(),
      complete: (results) => {
        try {
          const parsed = results.data.map((row: any, index) => parseRow(row, index, isProject44));
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error)
    });
  });
};

export const parseXLSX = (file: File, isProject44: boolean = false): Promise<RFQRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          throw new Error('File must contain at least a header row and one data row');
        }
        
        const headers = (jsonData[0] as string[]).map(h => 
          h.toString().trim().toLowerCase().replace(/\s+/g, '')
        );
        
        const rows = jsonData.slice(1).map((row, index) => {
          const rowObject: any = {};
          headers.forEach((header, i) => {
            rowObject[header] = (row as any[])[i]?.toString().trim() || '';
          });
          return parseRow(rowObject, index, isProject44);
        });
        
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

const parseRow = (row: any, index: number, isProject44: boolean = false): RFQRow => {
  const errors: string[] = [];
  
  const fromDate = row.fromdate || row.pickupdate || row.date || '';
  const fromZip = row.fromzip || row.pickupzip || row.originzip || '';
  const toZip = row.tozip || row.deliveryzip || row.destinationzip || '';
  const pallets = parseInt(row.pallets || row.palletcount || '0');
  const grossWeight = parseInt(row.grossweight || row.weight || '0');
  const temperature = (row.temperature || '').toUpperCase();
  const commodity = (row.commodity || '').toUpperCase();
  const isFoodGrade = parseBoolean(row.isfoodgrade || row.foodgrade || 'false');
  const isStackable = parseBoolean(row.isstackable || row.stackable || 'false');
  
  // NEW: Parse isReefer field for smart routing
  const isReefer = parseBoolean(row.isreefer || row.reefer || 'false');
  
  // Parse accessorial services - check for both old format (single column) and new format (individual columns)
  let accessorial: string[] = [];
  
  // Check if there's a single accessorial column (legacy format)
  const legacyAccessorial = row.accessorial || row.accessories || '';
  if (legacyAccessorial) {
    accessorial = parseAccessorial(legacyAccessorial);
  } else {
    // New format: check individual accessorial columns
    const accessorialCodes = isProject44 ? PROJECT44_ACCESSORIAL_CODES : FRESHX_ACCESSORIAL_CODES;
    
    accessorialCodes.forEach(code => {
      const columnValue = row[code.toLowerCase()];
      if (parseBoolean(columnValue)) {
        accessorial.push(code);
      }
    });
  }
  
  // Validation
  if (!fromDate || !isValidDate(fromDate)) {
    errors.push('Invalid or missing fromDate');
  }
  if (!fromZip || !isValidZip(fromZip)) {
    errors.push('Invalid or missing fromZip');
  }
  if (!toZip || !isValidZip(toZip)) {
    errors.push('Invalid or missing toZip');
  }
  if (!pallets || pallets < 1 || pallets > 100) {
    errors.push('Pallets must be between 1 and 100');
  }
  if (!grossWeight || grossWeight < 1 || grossWeight > 100000) {
    errors.push('Gross weight must be between 1 and 100000');
  }
  
  if (errors.length > 0) {
    throw new Error(`Row ${index + 1}: ${errors.join(', ')}`);
  }
  
  const result: RFQRow = {
    fromDate,
    fromZip,
    toZip,
    pallets,
    grossWeight,
    isStackable,
    accessorial,
    // Add the new isReefer field for smart routing
    isReefer
  };

  // Add optional fields
  if (temperature) {
    result.temperature = temperature as any;
  }
  if (commodity) {
    result.commodity = commodity as any;
  }
  if (isFoodGrade !== undefined) {
    result.isFoodGrade = isFoodGrade;
  }

  return result;
};

const parseBoolean = (value: string): boolean => {
  if (!value) return false;
  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
};

const parseAccessorial = (value: string): string[] => {
  if (!value) return [];
  // Handle both comma and semicolon separators
  return value.split(/[,;]/).map(s => s.trim().toUpperCase()).filter(Boolean);
};

const isValidDate = (date: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
};

const isValidZip = (zip: string): boolean => {
  return /^\d{5}$/.test(zip) || /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(zip.toUpperCase());
};