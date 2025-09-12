import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { apiService } from '../../services/api';

interface RFPUploaderProps {
  onQuestionsExtracted: (questions: string[]) => void;
  knowledgeBaseReady: boolean;
  clientId?: string;
  clientName?: string;
}

const RFPUploader: React.FC<RFPUploaderProps> = ({ 
  onQuestionsExtracted, 
  knowledgeBaseReady, 
  clientId, 
  clientName 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setExtractionResult(null);
    }
  };

  const handleExtractQuestions = async () => {
    if (!file) {
      alert('Please select an RFP file first');
      return;
    }

    if (!knowledgeBaseReady) {
      alert('Please upload training documents first to build the knowledge base');
      return;
    }

    setIsProcessing(true);
    setStatus('processing');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/process-rfp', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setStatus('success');
        setExtractionResult(result);
        onQuestionsExtracted(result.questions);
      } else {
        setStatus('error');
        setExtractionResult(result);
      }
    } catch (error) {
      console.error('Question extraction failed:', error);
      setStatus('error');
      setExtractionResult({ message: 'Failed to extract questions' });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader className="animate-spin text-blue-500" size={20} />;
      case 'success':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={20} />;
      default:
        return <Upload className="text-gray-400" size={20} />;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'processing':
        return 'Extracting questions from RFP document...';
      case 'success':
        return `Successfully extracted ${extractionResult?.total_count || 0} questions`;
      case 'error':
        return extractionResult?.message || 'Failed to extract questions';
      default:
        return 'Upload RFP document to extract questions';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Step 2: Upload RFP Document
        </h3>
        <p className="text-gray-600">
          Upload your RFP document to extract questions that need to be answered.
        </p>
      </div>

      {/* Knowledge Base Check */}
      {!knowledgeBaseReady && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-yellow-600" size={20} />
            <p className="text-yellow-800 font-medium">Knowledge Base Required</p>
          </div>
          <p className="text-yellow-700 text-sm mt-1">
            Please complete Step 1 by uploading training documents before proceeding.
          </p>
        </div>
      )}

      {/* File Upload Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            {getStatusIcon()}
          </div>
          
          <div>
            <h4 className="text-lg font-medium text-gray-900">
              Select RFP Document
            </h4>
            <p className="text-sm text-gray-500 mt-1">
              {getStatusMessage()}
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="file"
              accept=".pdf,.docx,.doc,.xlsx,.xls"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={isProcessing || !knowledgeBaseReady}
            />

            {file && (
              <div className="text-left p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-500" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              </div>
            )}

            <motion.button
              onClick={handleExtractQuestions}
              disabled={!file || isProcessing || !knowledgeBaseReady}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isProcessing ? 'Extracting Questions...' : 'Extract Questions'}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Extraction Results */}
      {extractionResult && status === 'success' && (
        <motion.div 
          className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="text-green-500" size={20} />
            <h4 className="font-medium text-green-800">Questions Extracted Successfully!</h4>
          </div>
          <div className="text-sm text-green-700 space-y-1">
            <p>📝 Total questions found: {extractionResult.total_count}</p>
            <p>✅ Ready for AI processing</p>
            <p className="text-xs mt-2">
              The questions are now ready to be processed using your knowledge base.
              Proceed to the next step to generate answers.
            </p>
          </div>
        </motion.div>
      )}

      {extractionResult && status === 'error' && (
        <motion.div 
          className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="text-red-500" size={20} />
            <h4 className="font-medium text-red-800">Extraction Failed</h4>
          </div>
          <p className="text-sm text-red-700">{extractionResult.message}</p>
        </motion.div>
      )}
    </div>
  );
};

export default RFPUploader;
