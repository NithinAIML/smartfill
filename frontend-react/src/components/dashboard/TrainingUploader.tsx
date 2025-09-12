import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import apiService from '../../services/api';

interface TrainingUploaderProps {
  onComplete: (fileCount: number) => void;
}

interface UploadedFile {
  name: string;
  size: number;
  status: 'uploading' | 'completed' | 'error';
  progress: number;
}

const TrainingUploader: React.FC<TrainingUploaderProps> = ({ onComplete }) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
  };

  const handleFiles = async (selectedFiles: File[]) => {
    const newFiles: UploadedFile[] = selectedFiles.map(file => ({
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
    setIsProcessing(true);

    try {
      // Create FormData for multiple files
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setFiles(prev => 
          prev.map(file => 
            newFiles.find(nf => nf.name === file.name) 
              ? { ...file, progress: i }
              : file
          )
        );
      }

      // Upload to backend using new training documents endpoint
      const filesArray = Array.from(selectedFiles);
      const response = await apiService.uploadTrainingDocuments(filesArray);
      
      // Mark as completed
      setFiles(prev => 
        prev.map(file => 
          newFiles.find(nf => nf.name === file.name) 
            ? { ...file, status: 'completed', progress: 100 }
            : file
        )
      );

      // Notify parent component
      onComplete(selectedFiles.length);
      
    } catch (error) {
      console.error('Upload failed:', error);
      setFiles(prev => 
        prev.map(file => 
          newFiles.find(nf => nf.name === file.name) 
            ? { ...file, status: 'error' }
            : file
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const completedFiles = files.filter(f => f.status === 'completed').length;
  const hasFiles = files.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Step 1: Upload Training Documents
        </h3>
        <p className="text-gray-600">
          Upload your company documents, policies, capabilities, and other supporting materials.
          These will be used to answer RFP questions.
        </p>
      </div>

      {/* Upload Area */}
      <motion.div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : hasFiles
            ? 'border-gray-300 bg-gray-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.docx,.doc,.xlsx,.xls,.txt"
        />
        
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">
          Drop training documents here
        </h4>
        <p className="text-gray-500 mb-4">
          Or click to browse files
        </p>
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Select Files'}
        </motion.button>
        <p className="text-xs text-gray-400 mt-2">
          Supports: PDF, Word, Excel, Text files
        </p>
      </motion.div>

      {/* File List */}
      {hasFiles && (
        <div className="mt-6">
          <h4 className="font-medium text-gray-900 mb-4">
            Uploaded Files ({completedFiles}/{files.length} processed)
          </h4>
          <div className="space-y-3">
            {files.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {file.status === 'uploading' && (
                    <>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                      <Loader className="w-4 h-4 animate-spin text-blue-500" />
                    </>
                  )}
                  {file.status === 'completed' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Processing Status */}
          {completedFiles > 0 && (
            <motion.div
              className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <p className="text-green-800 font-medium">
                  {completedFiles} document{completedFiles !== 1 ? 's' : ''} processed successfully!
                </p>
              </div>
              <p className="text-green-700 text-sm mt-1">
                Your documents have been analyzed and added to the knowledge base. 
                You can now proceed to upload your RFP document.
              </p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrainingUploader;
