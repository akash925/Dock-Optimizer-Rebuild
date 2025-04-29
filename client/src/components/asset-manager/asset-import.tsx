import { useState, useRef, ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowDownToLine, 
  Loader2,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Badge } from '@/components/ui/badge';

// Sample template for downloading
const TEMPLATE_HEADERS = [
  // Basic information
  'Asset Name',
  'Category',
  'Manufacturer', 
  'Model',
  'Owner',
  'Department',
  'Serial Number',
  'Barcode',
  
  // Financial information
  'Purchase Price',
  'Currency',
  'Purchase Date',
  'Asset Value',
  'Depreciation',
  
  // Procurement information
  'Manufacturer Part Number',
  'Supplier Name',
  'PO Number',
  'Vendor Information',
  
  // Maintenance information
  'Implementation Date',
  'Warranty Expiration',
  'Last Maintenance Date',
  'Next Maintenance Date',
  'Maintenance Schedule',
  'Maintenance Contact',
  'Maintenance Notes',
  'Expected Lifetime',
  'Certification Date',
  'Certification Expiry',
  
  // Location and status
  'Location',
  'Status',
  'Template',
  
  // Metadata
  'Tags',
  'Condition',
  'Notes'
];

interface RowError {
  row: number;
  errors: string[];
}

interface ImportedRow {
  [key: string]: any;
  __rowNum?: number;
  __errors?: string[];
  __status?: 'valid' | 'error' | 'warning';
}

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
}

export function AssetImport() {
  const [file, setFile] = useState<File | null>(null);
  const [importedData, setImportedData] = useState<ImportedRow[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'mapping' | 'validation' | 'import'>('upload');
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStats, setImportStats] = useState({ 
    total: 0, 
    successful: 0, 
    failed: 0, 
    warnings: 0 
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Field to column mapping
  const TARGET_FIELDS = [
    // Basic information
    { value: 'name', label: 'Asset Name' },
    { value: 'category', label: 'Category' },
    { value: 'manufacturer', label: 'Manufacturer' },
    { value: 'model', label: 'Model' },
    { value: 'owner', label: 'Owner' },
    { value: 'department', label: 'Department' },
    { value: 'serialNumber', label: 'Serial Number' },
    { value: 'barcode', label: 'Barcode' },
    
    // Financial information
    { value: 'purchasePrice', label: 'Purchase Price' },
    { value: 'currency', label: 'Currency' },
    { value: 'purchaseDate', label: 'Purchase Date' },
    { value: 'assetValue', label: 'Asset Value' },
    { value: 'depreciation', label: 'Depreciation' },
    
    // Procurement information
    { value: 'manufacturerPartNumber', label: 'Manufacturer Part Number' },
    { value: 'supplierName', label: 'Supplier Name' },
    { value: 'poNumber', label: 'PO Number' },
    { value: 'vendorInformation', label: 'Vendor Information' },
    
    // Maintenance information
    { value: 'implementationDate', label: 'Implementation Date' },
    { value: 'warrantyExpiration', label: 'Warranty Expiration' },
    { value: 'lastMaintenanceDate', label: 'Last Maintenance Date' },
    { value: 'nextMaintenanceDate', label: 'Next Maintenance Date' },
    { value: 'maintenanceSchedule', label: 'Maintenance Schedule' },
    { value: 'maintenanceContact', label: 'Maintenance Contact' },
    { value: 'maintenanceNotes', label: 'Maintenance Notes' },
    { value: 'expectedLifetime', label: 'Expected Lifetime' },
    { value: 'certificationDate', label: 'Certification Date' },
    { value: 'certificationExpiry', label: 'Certification Expiry' },
    
    // Location and status
    { value: 'location', label: 'Location' },
    { value: 'status', label: 'Status' },
    { value: 'template', label: 'Template' },
    
    // Metadata
    { value: 'tags', label: 'Tags' },
    { value: 'assetCondition', label: 'Condition' },
    { value: 'notes', label: 'Notes' },
  ];

  // Auto-map columns based on names
  const autoMapColumns = (headers: string[]) => {
    const mappings: ColumnMapping[] = [];
    headers.forEach(header => {
      const normalizedHeader = header.toLowerCase().trim();
      
      // Try to find a matching target field
      const matchingField = TARGET_FIELDS.find(field => {
        const fieldName = field.label.toLowerCase();
        return (
          normalizedHeader === fieldName ||
          normalizedHeader === field.value.toLowerCase() ||
          normalizedHeader.includes(fieldName) ||
          fieldName.includes(normalizedHeader)
        );
      });
      
      if (matchingField) {
        mappings.push({
          sourceColumn: header,
          targetField: matchingField.value
        });
      }
    });
    
    return mappings;
  };

  // Handle file selection
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      
      // Reset state
      setImportedData([]);
      setColumnMappings([]);
      setAvailableColumns([]);
      setErrors([]);
      setStep('upload');
    }
  };

  // Parse CSV file
  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<any>) => {
        if (results.data && results.data.length > 0) {
          // Store column headers
          const headers = results.meta.fields || [];
          setAvailableColumns(headers);
          
          // Auto-map columns
          const mappings = autoMapColumns(headers);
          setColumnMappings(mappings);
          
          // Add row numbers to data
          const dataWithRowNums = results.data.map((row: any, index: number) => ({
            ...row,
            __rowNum: index + 1
          }));
          
          setImportedData(dataWithRowNums);
          setStep('mapping');
        } else {
          toast({
            title: 'Empty File',
            description: 'The selected file contains no data.',
            variant: 'destructive',
          });
        }
      },
      error: (error: Error) => {
        toast({
          title: 'Error Parsing CSV',
          description: error.message,
          variant: 'destructive',
        });
      }
    });
  };

  // Parse Excel file
  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (e.target && e.target.result) {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to JSON - use first row as headers
          const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
          
          // Extract headers
          const headers = Object.keys(jsonData[0] || {});
          setAvailableColumns(headers);
          
          // Auto-map columns
          const mappings = autoMapColumns(headers);
          setColumnMappings(mappings);
          
          setImportedData(jsonData as ImportedRow[]);
          setStep('mapping');
        }
      } catch (error: any) {
        toast({
          title: 'Error Parsing Excel',
          description: error.message || 'Failed to parse Excel file',
          variant: 'destructive',
        });
      }
    };
    reader.onerror = () => {
      toast({
        title: 'Error Reading File',
        description: 'Failed to read the file.',
        variant: 'destructive',
      });
    };
    reader.readAsBinaryString(file);
  };

  // Process the selected file
  const processFile = () => {
    if (!file) return;
    
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExt === 'csv') {
      parseCSV(file);
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      parseExcel(file);
    } else {
      toast({
        title: 'Unsupported File',
        description: 'Please upload a CSV or Excel file.',
        variant: 'destructive',
      });
    }
  };

  // Update column mapping
  const updateMapping = (sourceColumn: string, targetField: string) => {
    setColumnMappings(prev => {
      // Remove existing mapping for this source column
      const filtered = prev.filter(mapping => mapping.sourceColumn !== sourceColumn);
      
      // Add new mapping if target field is selected
      if (targetField) {
        return [...filtered, { sourceColumn, targetField }];
      }
      
      return filtered;
    });
  };

  // Validate data based on mappings
  const validateData = () => {
    if (importedData.length === 0 || columnMappings.length === 0) {
      toast({
        title: 'Cannot Validate',
        description: 'No data to validate or no column mappings defined.',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate each row
    const newErrors: RowError[] = [];
    const validatedData = importedData.map((row, index) => {
      const rowNum = row.__rowNum || index + 1;
      const rowErrors: string[] = [];
      
      // Check required fields - only Asset Name is required
      if (!getMappedValue(row, 'name')) {
        rowErrors.push('Asset Name is required');
      }
      
      // If errors found, add to errors list
      if (rowErrors.length > 0) {
        newErrors.push({
          row: rowNum,
          errors: rowErrors
        });
        
        return {
          ...row,
          __errors: rowErrors,
          __status: 'error' as const
        };
      }
      
      return {
        ...row,
        __status: 'valid' as const
      };
    });
    
    setErrors(newErrors);
    setImportedData(validatedData);
    setStep('validation');
  };

  // Get mapped value from row
  const getMappedValue = (row: ImportedRow, targetField: string): any => {
    const mapping = columnMappings.find(m => m.targetField === targetField);
    if (!mapping) return undefined;
    
    return row[mapping.sourceColumn];
  };

  // Transform row to API format
  const transformRowToApi = (row: ImportedRow) => {
    const transformed: { [key: string]: any } = {};
    
    columnMappings.forEach(mapping => {
      if (row[mapping.sourceColumn] !== undefined && row[mapping.sourceColumn] !== '') {
        transformed[mapping.targetField] = row[mapping.sourceColumn];
      }
    });
    
    // Format dates if present
    [
      'purchaseDate', 
      'implementationDate', 
      'warrantyExpiration', 
      'lastMaintenanceDate', 
      'nextMaintenanceDate',
      'certificationDate',
      'certificationExpiry'
    ].forEach(dateField => {
      if (transformed[dateField]) {
        try {
          // Try to parse the date
          const date = new Date(transformed[dateField]);
          if (!isNaN(date.getTime())) {
            transformed[dateField] = date.toISOString().split('T')[0]; // YYYY-MM-DD format
          }
        } catch (e) {
          // If parsing fails, keep the original value
        }
      }
    });
    
    // Format tags as array
    if (transformed.tags && typeof transformed.tags === 'string') {
      transformed.tags = JSON.stringify(
        transformed.tags.split(',').map((tag: string) => tag.trim())
      );
    }
    
    return transformed;
  };

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const response = await fetch('/api/asset-manager/company-assets/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assets: data }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to import assets');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Import Successful',
        description: `Successfully imported ${data.successful} of ${data.total} assets.`,
      });
      
      // Reset state
      setFile(null);
      setImportedData([]);
      setColumnMappings([]);
      setAvailableColumns([]);
      setErrors([]);
      setStep('upload');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['/api/asset-manager/company-assets'] });
      
      setImportStats({
        total: data.total,
        successful: data.successful,
        failed: data.failed,
        warnings: data.warnings || 0
      });
      
      setIsDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsImporting(false);
    }
  });

  // Start import process
  const startImport = async () => {
    if (importedData.length === 0) {
      toast({
        title: 'Cannot Import',
        description: 'No data to import.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsImporting(true);
    
    try {
      // Filter out rows with errors
      const validRows = importedData.filter(row => row.__status !== 'error');
      
      // Transform to API format
      const transformedData = validRows.map(transformRowToApi);
      
      // Simulate progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress > 95) {
          progress = 95;
          clearInterval(interval);
        }
        setProgress(Math.min(progress, 95));
      }, 300);
      
      // Send to API
      await importMutation.mutateAsync(transformedData);
      
      clearInterval(interval);
      setProgress(100);
      
      setTimeout(() => {
        setIsImporting(false);
        setProgress(0);
      }, 500);
      
    } catch (error) {
      setIsImporting(false);
      setProgress(0);
    }
  };

  // Download sample template
  const downloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets Template');
    XLSX.writeFile(workbook, 'asset_import_template.xlsx');
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 'upload':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-center w-full">
              <label htmlFor="file-upload" className="w-full cursor-pointer">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 flex flex-col items-center justify-center bg-gray-50">
                  <FileSpreadsheet className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-xl font-medium text-gray-700 mb-1">Choose a file or drag & drop</p>
                  <p className="text-sm text-gray-500 mb-4">CSV or Excel files supported</p>
                  <Button type="button" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Select File
                  </Button>
                  <input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </label>
            </div>
            
            {file && (
              <div className="bg-slate-100 p-4 rounded-md flex items-center gap-3">
                <FileText className="h-6 w-6 text-blue-500" />
                <div className="flex-1">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button variant="default" onClick={processFile}>
                  Process File
                </Button>
              </div>
            )}
            
            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                <ArrowDownToLine className="h-4 w-4" />
                Download Template
              </Button>
            </div>
          </div>
        );
        
      case 'mapping':
        return (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
              <h3 className="flex items-center text-sm font-medium text-amber-800 mb-1">
                <AlertCircle className="h-4 w-4 mr-2" />
                Column Mapping
              </h3>
              <p className="text-sm text-amber-700">
                Map columns from your file to the system fields. Required fields are marked with *.
              </p>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source Column</TableHead>
                    <TableHead>Target Field</TableHead>
                    <TableHead>Sample Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableColumns.map((column) => {
                    const mapping = columnMappings.find(m => m.sourceColumn === column);
                    const sampleData = importedData[0]?.[column] || '';
                    
                    return (
                      <TableRow key={column}>
                        <TableCell className="font-medium">{column}</TableCell>
                        <TableCell>
                          <select 
                            className="w-full p-2 border rounded-md"
                            value={mapping?.targetField || ''}
                            onChange={(e) => updateMapping(column, e.target.value)}
                          >
                            <option value="">-- Skip this column --</option>
                            {TARGET_FIELDS.map(field => (
                              <option 
                                key={field.value} 
                                value={field.value}
                                disabled={columnMappings.some(m => m.targetField === field.value && m.sourceColumn !== column)}
                              >
                                {field.label} {field.value === 'name' ? '*' : ''}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                            {sampleData}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={validateData}>
                Validate Data
              </Button>
            </div>
          </div>
        );
        
      case 'validation':
        return (
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="bg-slate-100 p-4 rounded-md flex-1">
                <h3 className="font-medium mb-2">Validation Summary</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white p-3 rounded-md border">
                    <p className="text-sm text-gray-500">Total Rows</p>
                    <p className="text-2xl font-bold">{importedData.length}</p>
                  </div>
                  <div className="bg-white p-3 rounded-md border">
                    <p className="text-sm text-gray-500">Valid</p>
                    <p className="text-2xl font-bold text-green-600">
                      {importedData.filter(row => row.__status !== 'error').length}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-md border">
                    <p className="text-sm text-gray-500">Errors</p>
                    <p className="text-2xl font-bold text-red-600">
                      {importedData.filter(row => row.__status === 'error').length}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-md border">
                    <p className="text-sm text-gray-500">Warnings</p>
                    <p className="text-2xl font-bold text-amber-500">
                      0
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h3 className="flex items-center text-sm font-medium text-red-800 mb-2">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Validation Errors
                </h3>
                <div className="max-h-[200px] overflow-y-auto">
                  {errors.map((error, index) => (
                    <div key={index} className="mb-2 last:mb-0 border-b border-red-100 pb-2 last:border-0">
                      <p className="text-sm font-medium text-red-700">Row {error.row}:</p>
                      <ul className="ml-6 text-sm text-red-600 list-disc">
                        {error.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="max-h-[300px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Status</TableHead>
                    {columnMappings.map(mapping => (
                      <TableHead key={mapping.targetField}>
                        {TARGET_FIELDS.find(f => f.value === mapping.targetField)?.label || mapping.targetField}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importedData.slice(0, 100).map((row, index) => (
                    <TableRow key={index} className={row.__status === 'error' ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">{row.__rowNum || index + 1}</TableCell>
                      <TableCell>
                        {row.__status === 'error' ? (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Error
                          </Badge>
                        ) : (
                          <Badge variant="default" className="gap-1 bg-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Valid
                          </Badge>
                        )}
                      </TableCell>
                      {columnMappings.map(mapping => (
                        <TableCell key={mapping.targetField}>
                          {row[mapping.sourceColumn]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
                {importedData.length > 100 && (
                  <TableCaption>
                    Showing first 100 rows of {importedData.length} total
                  </TableCaption>
                )}
              </Table>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back to Mapping
              </Button>
              <Button 
                onClick={startImport} 
                disabled={importedData.filter(row => row.__status !== 'error').length === 0 || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import Data'
                )}
              </Button>
            </div>
            
            {isImporting && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-center text-gray-500">
                  Importing assets: {Math.round(progress)}%
                </p>
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Import Assets</CardTitle>
          <CardDescription>
            Import multiple assets at once from a CSV or Excel file
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>
      
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Import Complete
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="py-2">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-50 p-3 rounded-md">
                    <p className="text-sm text-gray-500">Total Processed</p>
                    <p className="text-xl font-bold">{importStats.total}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-md">
                    <p className="text-sm text-gray-500">Successfully Imported</p>
                    <p className="text-xl font-bold text-green-600">{importStats.successful}</p>
                  </div>
                  {importStats.failed > 0 && (
                    <div className="bg-red-50 p-3 rounded-md">
                      <p className="text-sm text-gray-500">Failed</p>
                      <p className="text-xl font-bold text-red-600">{importStats.failed}</p>
                    </div>
                  )}
                  {importStats.warnings > 0 && (
                    <div className="bg-amber-50 p-3 rounded-md">
                      <p className="text-sm text-gray-500">Warnings</p>
                      <p className="text-xl font-bold text-amber-600">{importStats.warnings}</p>
                    </div>
                  )}
                </div>
                <p>Your assets have been imported successfully and are now available in the system.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Done</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}