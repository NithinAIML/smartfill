import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  File,
  X,
  CheckCircle,
  AlertCircle,
  Loader,
  Zap,
  Target,
  FileQuestion,
  Database
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiService, ProcessResult } from '../../services/api';

interface UploadedFile {
  id: string;
  file: File;
  status: 'uploading' | 'processing' | 'completed' | 'error' | 'answering' | 'ready_for_download';
  progress: number;
  type: 'rfp' | 'supporting';
  questions?: string[];
  questionsCount?: number;
  outputFilePath?: string;
  error?: string;
  isManuallyClassified?: boolean;
}

const UploadCenter: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Conservative file type detection
  const detectFileType = (filename: string): 'rfp' | 'supporting' => {
    const lowerName = filename.toLowerCase();
    const rfpKeywords = ['rfp', 'request_for_proposal', 'tender', 'bid_document'];
    const hasRfpKeyword = rfpKeywords.some(keyword => lowerName.includes(keyword));
    return hasRfpKeyword ? 'rfp' : 'supporting';
  };

  // Function to change file classification
  const changeFileType = (fileId: string, newType: 'rfp' | 'supporting') => {
    setUploadedFiles((prev) =>
      prev.map((file) => {
        if (file.id === fileId) {
          const updatedFile = {
            ...file,
            type: newType,
            isManuallyClassified: true,
            questions: undefined,
            questionsCount: undefined,
            outputFilePath: undefined,
            error: undefined,
            status: 'uploading' as const,
            progress: 100
          };
          
          if (newType === 'rfp') {
            setTimeout(() => processRFPFile(fileId, file.file), 500);
          } else {
            setTimeout(() => ingestSupportingDocument(fileId, file.file), 500);
          }
          
          return updatedFile;
        }
        return file;
      })
    );
    
    toast.success(`File reclassified as ${newType === 'rfp' ? 'RFP Document' : 'Supporting Document'}`);
  };

  const simulateUpload = useCallback(async (fileId: string, file: File) => {
    const uploadInterval = setInterval(() => {
      setUploadedFiles((prev) =>
        prev.map((f) => {
          if (f.id === fileId) {
            const newProgress = Math.min(f.progress + Math.random() * 20 + 10, 100);
            return { ...f, progress: newProgress };
          }
          return f;
        })
      );
    }, 200);

    await new Promise(resolve => setTimeout(resolve, 2000));
    clearInterval(uploadInterval);

    setUploadedFiles((prev) =>
      prev.map((f) => {
        if (f.id === fileId) {
          return { ...f, progress: 100, status: 'processing' };
        }
        return f;
      })
    );

    const fileType = detectFileType(file.name);
    if (fileType === 'rfp') {
      await processRFPFile(fileId, file);
    } else {
      await ingestSupportingDocument(fileId, file);
    }
  }, []);

  const processRFPFile = async (fileId: string, file: File) => {
    try {
      const result: ProcessResult = await apiService.processRFP(file);
      
      setUploadedFiles((prev) =>
        prev.map((f) => {
          if (f.id === fileId) {
            return {
              ...f,
              status: 'completed',
              questions: result.questions,
              questionsCount: result.count
            };
          }
          return f;
        })
      );
      
      if (result.count === 0) {
        toast(`⚠️ No questions found in ${file.name}. Consider reclassifying as supporting document.`, {
          icon: '⚠️',
          style: {
            background: '#FEF3C7',
            color: '#92400E',
          },
        });
      } else {
        toast.success(`✅ RFP processed! ${result.count} questions extracted.`);
      }
    } catch (error) {
      setUploadedFiles((prev) =>
        prev.map((f) => {
          if (f.id === fileId) {
            return {
              ...f,
              status: 'error',
              error: 'Failed to process RFP'
            };
          }
          return f;
        })
      );
      toast.error('❌ Failed to process RFP document');
    }
  };

  const ingestSupportingDocument = async (fileId: string, file: File) => {
    try {
      await apiService.ingestDocuments([file]);
      
      setUploadedFiles((prev) =>
        prev.map((f) => {
          if (f.id === fileId) {
            return { ...f, status: 'completed' };
          }
          return f;
        })
      );
      
      toast.success('✅ Supporting document ingested successfully!');
    } catch (error) {
      setUploadedFiles((prev) =>
        prev.map((f) => {
          if (f.id === fileId) {
            return {
              ...f,
              status: 'error',
              error: 'Failed to ingest document'
            };
          }
          return f;
        })
      );
      toast.error('❌ Failed to ingest supporting document');
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'uploading' as const,
      progress: 0,
      type: detectFileType(file.name),
      isManuallyClassified: false
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    newFiles.forEach((uploadFile) => {
      simulateUpload(uploadFile.id, uploadFile.file);
    });
  }, [simulateUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc']
    },
    multiple: true
  });

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
      case 'pdf':
        return <FileText className="h-8 w-8 text-red-500" />;
      case 'docx':
      case 'doc':
        return <FileText className="h-8 w-8 text-blue-500" />;
      default:
        return <File className="h-8 w-8 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Loader className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'processing':
        return <Zap className="h-5 w-5 text-yellow-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const rfpFiles = uploadedFiles.filter(file => file.type === 'rfp');
  const supportingFiles = uploadedFiles.filter(file => file.type === 'supporting');
  const completedRFPs = rfpFiles.filter(file => file.status === 'completed');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Smart Upload Center
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Upload and auto-classify your documents with manual override controls
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileQuestion className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">RFP Documents</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{rfpFiles.length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Database className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Supporting Docs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{supportingFiles.length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <CheckCircle className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Processed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{completedRFPs.length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Target className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Questions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {completedRFPs.reduce((acc, file) => acc + (file.questionsCount || 0), 0)}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card"
      >
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
            isDragActive
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="space-y-4">
            <motion.div
              animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
              className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto"
            >
              <Upload className="h-8 w-8 text-white" />
            </motion.div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {isDragActive ? 'Drop files here' : 'Upload your documents'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Drag and drop your documents, or click to browse
              </p>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 space-y-2">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">🔍 Smart Classification:</p>
                  <p><strong>RFP Documents:</strong> Files with "rfp", "tender", "bid" keywords</p>
                  <p><strong>Supporting Documents:</strong> All other files (used for training)</p>
                  <p><strong>Manual Override:</strong> Use the buttons below each file to reclassify</p>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">.xlsx</span>
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">.pdf</span>
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">.docx</span>
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">.doc</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Uploaded Files ({uploadedFiles.length})
          </h3>
          <div className="space-y-4">
            {uploadedFiles.map((uploadFile) => (
              <div
                key={uploadFile.id}
                className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex-shrink-0">
                  {getFileIcon(uploadFile.file.name)}
                </div>
                <div className="flex-1 min-w-0 ml-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {uploadFile.file.name}
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        uploadFile.type === 'rfp'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {uploadFile.type === 'rfp' ? 'RFP Document' : 'Supporting'}
                      </span>
                      {getStatusIcon(uploadFile.status)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>{(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB</span>
                      {uploadFile.status === 'completed' && uploadFile.questionsCount !== undefined && (
                        <span className={`flex items-center ${uploadFile.questionsCount === 0 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                          <Target className="h-4 w-4 mr-1" />
                          {uploadFile.questionsCount} questions
                          {uploadFile.questionsCount === 0 && (
                            <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded">
                              No questions found
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* File Type Change Buttons */}
                      {uploadFile.status === 'completed' && (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => changeFileType(uploadFile.id, 'rfp')}
                            disabled={uploadFile.type === 'rfp'}
                            className={`p-2 text-xs rounded-lg transition-colors ${
                              uploadFile.type === 'rfp' 
                                ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' 
                                : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-600 dark:bg-gray-700 dark:hover:bg-purple-900/30'
                            }`}
                            title="Mark as RFP Document"
                          >
                            <FileQuestion className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => changeFileType(uploadFile.id, 'supporting')}
                            disabled={uploadFile.type === 'supporting'}
                            className={`p-2 text-xs rounded-lg transition-colors ${
                              uploadFile.type === 'supporting' 
                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' 
                                : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600 dark:bg-gray-700 dark:hover:bg-blue-900/30'
                            }`}
                            title="Mark as Supporting Document"
                          >
                            <Database className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      
                      <button
                        onClick={() => removeFile(uploadFile.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {uploadFile.status === 'uploading' && (
                    <div className="mt-2">
                      <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadFile.progress}%` }}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default UploadCenter;