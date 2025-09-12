import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, CheckCircle, AlertCircle, Loader, Database } from 'lucide-react';
import { apiService } from '../../services/api';

interface TrainingUploaderProps {
  onComplete?: (result: any) => void;
  onKnowledgeBaseReady?: (fileCount: number) => void;
  initialKnowledgeBaseReady?: boolean;
  clientId?: string;
  clientName?: string;
}

interface UploadedFile {
  name: string;
  size: number;
  status: 'uploading' | 'completed' | 'error';
  progress: number;
}

interface KnowledgeBaseStatus {
  status: 'empty' | 'ready' | 'error';
  document_count?: number;
  message: string;
}

const TrainingUploader: React.FC<TrainingUploaderProps> = ({ 
  onComplete, 
  onKnowledgeBaseReady, 
  initialKnowledgeBaseReady = false,
  clientId,
  clientName
}) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [knowledgeBaseStatus, setKnowledgeBaseStatus] = useState<KnowledgeBaseStatus | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    checkKnowledgeBaseStatus();
  }, [clientId]);

  React.useEffect(() => {
    if (knowledgeBaseStatus?.status === 'ready' && onKnowledgeBaseReady) {
      onKnowledgeBaseReady(knowledgeBaseStatus.document_count || 0);
    }
  }, [knowledgeBaseStatus, onKnowledgeBaseReady]);

  const checkKnowledgeBaseStatus = async () => {
    try {
      if (clientId) {
        // Use client-specific knowledge base status
        const response = await apiService.getClientKnowledgeBaseStatus(clientId);
        setKnowledgeBaseStatus({
          status: response.status === 'ready' ? 'ready' : 'empty',
          document_count: response.stats.totalDocuments,
          message: response.status === 'ready' ? 
            `Knowledge base ready with ${response.stats.totalDocuments} documents` :
            'No knowledge base found for this client'
        });
      } else {
        // Fallback to general knowledge base status
        const response = await apiService.getKnowledgeBaseStatus();
        setKnowledgeBaseStatus({
          status: response.ready ? 'ready' : 'empty',
          document_count: response.document_count || 0,
          message: response.message || (response.ready ? 'Knowledge base ready' : 'No knowledge base found')
        });
      }
    } catch (error) {
      console.error('Error checking knowledge base status:', error);
      setKnowledgeBaseStatus({
        status: 'error',
        message: 'Failed to check knowledge base status'
      });
    }
  };

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

    setFiles(newFiles);
    setIsProcessing(true);

    try {
      // Create FormData for multiple files
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      // Show processing progress
      const progressInterval = setInterval(() => {
        setFiles(prev => 
          prev.map(file => ({
            ...file,
            progress: Math.min(file.progress + 5, 90)
          }))
        );
      }, 200);

      // Upload to backend using API service
      const result = clientId 
        ? await apiService.uploadClientTrainingDocuments(clientId, selectedFiles)
        : await apiService.uploadTrainingDocuments(selectedFiles);

      clearInterval(progressInterval);
      
      if (result.status === 'success') {
        // Mark as completed
        setFiles(prev => 
          prev.map(file => ({
            ...file, 
            status: 'completed' as const, 
            progress: 100
          }))
        );

        setUploadResult(result);
        
        // Refresh knowledge base status
        await checkKnowledgeBaseStatus();
        
        // Notify parent component
        if (onComplete) {
          onComplete(result);
        }
      } else {
        throw new Error(result.message || 'Upload failed');
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
      setFiles(prev => 
        prev.map(file => ({
          ...file, 
          status: 'error' as const
        }))
      );
      setUploadResult({
        status: 'error',
        message: error instanceof Error ? error.message : 'Upload failed'
      });
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
          Step 1: Build Knowledge Base
        </h3>
        <p className="text-gray-600">
          Upload your training documents to build a knowledge base. The system will process, chunk, 
          and index these documents to answer RFP questions.
        </p>
      </div>

      {/* Knowledge Base Status */}
      {knowledgeBaseStatus && (
        <motion.div 
          className={`mb-6 p-4 rounded-lg border ${
            knowledgeBaseStatus.status === 'ready' 
              ? 'bg-green-50 border-green-200' 
              : knowledgeBaseStatus.status === 'error'
              ? 'bg-red-50 border-red-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Database size={20} className={
              knowledgeBaseStatus.status === 'ready' 
                ? 'text-green-600' 
                : knowledgeBaseStatus.status === 'error'
                ? 'text-red-600'
                : 'text-yellow-600'
            } />
            <h4 className="font-semibold">Knowledge Base Status</h4>
          </div>
          <p className="text-sm text-gray-700">{knowledgeBaseStatus.message}</p>
          {knowledgeBaseStatus.status === 'ready' && knowledgeBaseStatus.document_count && (
            <div className="mt-2 text-sm">
              <span className="font-medium">Indexed chunks: </span>
              {knowledgeBaseStatus.document_count}
            </div>
          )}
        </motion.div>
      )}

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
          {knowledgeBaseStatus?.status === 'ready' ? 'Replace Knowledge Base' : 'Upload Training Documents'}
        </h4>
        <p className="text-gray-500 mb-4">
          Drop files here or click to browse
        </p>
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isProcessing}
        >
          {isProcessing ? 'Building Knowledge Base...' : 'Select Training Files'}
        </motion.button>
        <p className="text-xs text-gray-400 mt-2">
          Supports: PDF, Word, Excel, Text, CSV, JSON, XML files
        </p>
      </motion.div>

      {/* File Processing List */}
      {hasFiles && (
        <div className="mt-6">
          <h4 className="font-medium text-gray-900 mb-4">
            Processing Files ({completedFiles}/{files.length})
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
        </div>
      )}

      {/* Upload Results */}
      {uploadResult && (
        <motion.div
          className={`mt-6 p-4 rounded-lg border ${
            uploadResult.status === 'success' 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="flex items-center space-x-2 mb-2">
            {uploadResult.status === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <p className={`font-medium ${
              uploadResult.status === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>
              {uploadResult.status === 'success' ? 'Knowledge Base Created!' : 'Upload Failed'}
            </p>
          </div>
          
          {uploadResult.status === 'success' ? (
            <div className="text-sm text-green-700 space-y-1">
              <p>📁 Processed files: {uploadResult.indexed_count}</p>
              <p>📊 Total chunks: {uploadResult.total_chunks}</p>
              <p>✅ Knowledge base is ready for RFP processing</p>
            </div>
          ) : (
            <p className="text-sm text-red-700">{uploadResult.message}</p>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default TrainingUploader;
