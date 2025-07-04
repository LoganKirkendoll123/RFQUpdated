import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, Eye, Table } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  error?: string;
  isProcessing?: boolean;
  showPreview?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  error, 
  isProcessing,
  showPreview = true 
}) => {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewData, setPreviewData] = React.useState<string[][]>([]);
  const [showPreviewData, setShowPreviewData] = React.useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      onFileSelect(acceptedFiles[0]);
      
      // Generate preview for CSV files
      if (acceptedFiles[0].name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const lines = text.split('\n').slice(0, 6); // Get first 6 lines
          const data = lines.map(line => line.split(','));
          setPreviewData(data);
        };
        reader.readAsText(acceptedFiles[0]);
      }
      
      // For Excel files, we'll just show the filename
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    disabled: isProcessing
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          {isDragActive ? (
            <Upload className="h-12 w-12 text-blue-500" />
          ) : (
            <FileText className="h-12 w-12 text-gray-400" />
          )}
          
          <div>
            <p className="text-lg font-medium text-gray-700">
              {isDragActive ? 'Drop your file here' : 'Upload RFQ Data File'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Drag and drop or click to select CSV or XLSX files
            </p>
          </div>
          
          <div className="text-xs text-gray-400">
            Supported formats: .csv, .xlsx, .xls
          </div>
        </div>
      </div>

      {/* File Selected Info */}
      {selectedFile && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium text-blue-800">{selectedFile.name}</p>
                <p className="text-sm text-blue-600">
                  {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'application/octet-stream'}
                </p>
              </div>
            </div>
            {showPreview && (previewData.length > 0 || selectedFile.name.endsWith('.xlsx')) && (
              <button
                onClick={() => setShowPreviewData(!showPreviewData)}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                <Eye className="h-4 w-4" />
                <span>{showPreviewData ? 'Hide Preview' : 'Show Preview'}</span>
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* CSV Preview */}
      {showPreview && showPreviewData && previewData.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <div className="text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
            <Table className="h-4 w-4" />
            <span>File Preview (first 5 rows)</span>
          </div>
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded">
            <thead className="bg-gray-50">
              <tr>
                {previewData[0]?.map((header, i) => (
                  <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {previewData.slice(1, 6).map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 text-sm text-gray-500 border-r border-gray-200 last:border-r-0">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Excel Preview Message */}
      {showPreview && showPreviewData && selectedFile && selectedFile.name.endsWith('.xlsx') && previewData.length === 0 && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded text-center">
          <Table className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Excel file preview is available after processing.</p>
          <p className="text-sm text-gray-500 mt-1">Click "Get Quotes" to process the file and view the data.</p>
        </div>
      )}
      
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}
    </div>
  );
};