import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader,
  Eye,
  MessageSquare
} from 'lucide-react';
import apiService from '../../services/api';

interface RFPUploaderProps {
  onQuestionsExtracted: (questions: string[], filename: string) => void;
  isEnabled: boolean;
}

interface RFPFile {
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  questions?: string[];
  questionsCount?: number;
}

const RFPUploader: React.FC<RFPUploaderProps> = ({ onQuestionsExtracted, isEnabled }) => {
  const [file, setFile] = useState<RFPFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isEnabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isEnabled) return;
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleFile(droppedFiles[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (selectedFile: File) => {
    const newFile: RFPFile = {
      name: selectedFile.name,
      size: selectedFile.size,
      status: 'uploading',
      progress: 0
    };

    setFile(newFile);

    try {
      // Simulate upload progress
      for (let i = 0; i <= 50; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setFile(prev => prev ? { ...prev, progress: i } : null);
      }

      // Change to processing status
      setFile(prev => prev ? { ...prev, status: 'processing', progress: 60 } : null);

      // Process RFP file to extract questions
      const response = await apiService.processRFP(selectedFile);
      
      // Complete progress
      for (let i = 70; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setFile(prev => prev ? { ...prev, progress: i } : null);
      }

      // Mark as completed
      setFile(prev => prev ? {
        ...prev,
        status: 'completed',
        progress: 100,
        questions: response.questions,
        questionsCount: response.count
      } : null);

      // Notify parent component
      onQuestionsExtracted(response.questions, selectedFile.name);

    } catch (error) {
      console.error('RFP processing failed:', error);
      setFile(prev => prev ? { ...prev, status: 'error' } : null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 transition-all duration-300 ${
      !isEnabled ? 'opacity-50 pointer-events-none' : ''
    }`}>
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Step 2: Upload RFP Document
        </h3>
        <p className="text-gray-600">
          Upload your RFP Excel file. We'll automatically extract all questions for processing.
        </p>
        {!isEnabled && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-800 text-sm">
              Please complete Step 1 first by uploading training documents.
            </p>
          </div>
        )}
      </div>

      {/* Upload Area */}
      <motion.div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : file
            ? 'border-gray-300 bg-gray-50'
            : isEnabled
            ? 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
            : 'border-gray-200 bg-gray-100'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={isEnabled ? { scale: 1.02 } : {}}
        whileTap={isEnabled ? { scale: 0.98 } : {}}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept=".xlsx,.xls,.pdf,.docx,.doc,.csv,.txt"
          disabled={!isEnabled}
        />
        
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">
          Drop RFP document here
        </h4>
        <p className="text-gray-500 mb-4">
          Upload Excel, PDF, Word, or CSV files
        </p>
        <motion.button
          onClick={() => isEnabled && fileInputRef.current?.click()}
          className={`px-6 py-2 rounded-lg transition-colors ${
            isEnabled
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          whileHover={isEnabled ? { scale: 1.05 } : {}}
          whileTap={isEnabled ? { scale: 0.95 } : {}}
          disabled={!isEnabled}
        >
          Select RFP File
        </motion.button>
      </motion.div>

      {/* File Processing Status */}
      {file && (
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
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
                {file.status === 'processing' && (
                  <>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                    <Loader className="w-4 h-4 animate-spin text-orange-500" />
                  </>
                )}
                {file.status === 'completed' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {file.status === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>

            {/* Status Messages */}
            {file.status === 'uploading' && (
              <p className="text-sm text-blue-600">Uploading RFP document...</p>
            )}
            {file.status === 'processing' && (
              <p className="text-sm text-orange-600">Extracting questions from document...</p>
            )}
            {file.status === 'completed' && file.questionsCount && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-green-600 font-medium">
                    ✅ Successfully extracted {file.questionsCount} questions
                  </p>
                  <button
                    onClick={() => setShowQuestions(!showQuestions)}
                    className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{showQuestions ? 'Hide' : 'Preview'} Questions</span>
                  </button>
                </div>
                
                <AnimatePresence>
                  {showQuestions && file.questions && (
                    <motion.div
                      className="mt-3 p-3 bg-white border rounded-lg max-h-60 overflow-y-auto"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700">
                          Extracted Questions Preview
                        </span>
                      </div>
                      <div className="space-y-2">
                        {file.questions.slice(0, 5).map((question, index) => (
                          <div key={index} className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
                            <span className="font-medium text-blue-600">Q{index + 1}:</span> {question}
                          </div>
                        ))}
                        {file.questions.length > 5 && (
                          <p className="text-xs text-gray-500 italic">
                            ... and {file.questions.length - 5} more questions
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            {file.status === 'error' && (
              <p className="text-sm text-red-600">
                Failed to process RFP document. Please try again.
              </p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default RFPUploader;
