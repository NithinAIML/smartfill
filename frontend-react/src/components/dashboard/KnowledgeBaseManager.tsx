import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CloudArrowUpIcon, 
  DocumentIcon, 
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { apiService } from '../../services/api';

interface KnowledgeBaseManagerProps {
  clientId: string;
  clientName: string;
  onStatusChange?: () => void; // Add callback for status changes
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({ clientId, clientName, onStatusChange }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [knowledgeBaseStatus, setKnowledgeBaseStatus] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    checkKnowledgeBaseStatus();
  }, [clientId]);

  const checkKnowledgeBaseStatus = async () => {
    try {
      const status = await apiService.getClientKnowledgeBaseStatus(clientId);
      setKnowledgeBaseStatus(status);
    } catch (error) {
      console.error('Failed to check knowledge base status:', error);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadDocuments = async () => {
    if (files.length === 0) {
      setStatusMessage('Please select files to upload');
      setUploadStatus('error');
      return;
    }

    setUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await apiService.uploadClientTrainingDocuments(clientId, files);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.status === 'success') {
        setUploadStatus('success');
        setStatusMessage(`Successfully processed ${files.length} documents for ${clientName}`);
        setFiles([]);
        
        // Refresh knowledge base status
        setTimeout(() => {
          checkKnowledgeBaseStatus();
          // Notify parent component of status change
          if (onStatusChange) {
            onStatusChange();
          }
        }, 1000);
      } else {
        throw new Error(response.message || 'Upload failed');
      }
    } catch (error: any) {
      setUploadStatus('error');
      setStatusMessage(error.message || 'Failed to upload documents');
    } finally {
      setUploading(false);
      
      // Reset status after 5 seconds
      setTimeout(() => {
        setUploadStatus('idle');
        setStatusMessage('');
        setUploadProgress(0);
      }, 5000);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const resetKnowledgeBase = async () => {
    if (window.confirm(`Are you sure you want to reset the knowledge base for ${clientName}? This will delete all trained documents.`)) {
      setUploading(true);
      try {
        // This would call a reset endpoint if implemented
        setStatusMessage('Knowledge base reset functionality coming soon...');
        setUploadStatus('success');
      } catch (error: any) {
        setStatusMessage(error.message || 'Failed to reset knowledge base');
        setUploadStatus('error');
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Knowledge Base Status */}
      {knowledgeBaseStatus && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Knowledge Base Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {knowledgeBaseStatus.stats?.totalDocuments || 0}
              </div>
              <div className="text-sm text-gray-500">Documents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {knowledgeBaseStatus.stats?.successRate || '100%'}
              </div>
              <div className="text-sm text-gray-500">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {knowledgeBaseStatus.stats?.avgProcessingTime || '2.5s'}
              </div>
              <div className="text-sm text-gray-500">Avg Processing</div>
            </div>
            <div className="text-center">
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                knowledgeBaseStatus.status === 'ready' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {knowledgeBaseStatus.status === 'ready' ? 'Ready' : 'Empty'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Upload Training Documents</h3>
          {knowledgeBaseStatus?.status === 'ready' && (
            <button
              onClick={resetKnowledgeBase}
              disabled={uploading}
              className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Reset Knowledge Base
            </button>
          )}
        </div>

        <div
          className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
            dragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-gray-900">
                  Drop files here or click to browse
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  Supports PDF, DOCX, TXT, CSV, JSON, XML, XLSX files up to 10MB each
                </span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  multiple
                  accept=".pdf,.docx,.txt,.doc"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Selected Files */}
        {files.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Selected Files ({files.length})</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                  <div className="flex items-center space-x-3">
                    <DocumentIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{file.name}</div>
                      <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                    className="text-red-400 hover:text-red-600 disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Uploading and processing documents...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                className="bg-blue-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Status Message */}
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 p-3 rounded-md ${
              uploadStatus === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : uploadStatus === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            <div className="flex items-center">
              {uploadStatus === 'success' && <CheckCircleIcon className="h-5 w-5 mr-2" />}
              {uploadStatus === 'error' && <ExclamationTriangleIcon className="h-5 w-5 mr-2" />}
              <span className="text-sm">{statusMessage}</span>
            </div>
          </motion.div>
        )}

        {/* Upload Button */}
        <div className="mt-6">
          <button
            onClick={uploadDocuments}
            disabled={files.length === 0 || uploading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <ArrowPathIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Processing Documents...
              </>
            ) : (
              <>
                <CloudArrowUpIcon className="-ml-1 mr-3 h-5 w-5" />
                Upload & Train Knowledge Base
              </>
            )}
          </button>
        </div>
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Tips for Better Results</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Upload comprehensive company documentation, past RFP responses, and technical specifications</li>
          <li>• Include project case studies, team profiles, and capability statements</li>
          <li>• Ensure documents are well-formatted and contain relevant information for RFP responses</li>
          <li>• The more relevant data you provide, the better SMARTFILL AI can assist with RFP responses</li>
        </ul>
      </div>
    </div>
  );
};

export default KnowledgeBaseManager;
