import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Download, 
  Mail, 
  FileText, 
  CheckCircle, 
  Send,
  Loader,
  Eye
} from 'lucide-react';
import apiService from '../../services/api';

interface DocumentGeneratorProps {
  answers: Record<string, string>;
  questions: string[];
  rfpFilename: string;
  isEnabled: boolean;
}

interface DocumentState {
  status: 'idle' | 'generating' | 'ready' | 'error';
  downloadUrl?: string;
  filename?: string;
}

interface EmailState {
  isOpen: boolean;
  isSending: boolean;
  sent: boolean;
  email: string;
  subject: string;
  message: string;
}

const DocumentGenerator: React.FC<DocumentGeneratorProps> = ({ 
  answers, 
  questions, 
  rfpFilename, 
  isEnabled 
}) => {
  const [documentState, setDocumentState] = useState<DocumentState>({ status: 'idle' });
  const [emailState, setEmailState] = useState<EmailState>({
    isOpen: false,
    isSending: false,
    sent: false,
    email: '',
    subject: `RFP Response - ${rfpFilename}`,
    message: 'Please find attached the completed RFP response document.'
  });
  const [showPreview, setShowPreview] = useState(false);

  const generateDocument = async () => {
    setDocumentState({ status: 'generating' });

    try {
      // Simulate brief processing time
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setDocumentState({
        status: 'ready',
        downloadUrl: 'ready', // Just a placeholder since we generate client-side
        filename: `${rfpFilename || 'RFP_Analysis'}_SMARTFILL_AI.doc`
      });

    } catch (error) {
      console.error('Document generation failed:', error);
      setDocumentState({ status: 'error' });
    }
  };

  const downloadDocument = () => {
    try {
      // Create document content
      const header = 'SMARTFILL AI';
      const subtitle = 'AI based RFP smart filling solution';
      const timestamp = new Date().toLocaleString();
      
      let htmlContent = `
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: 'Arial', sans-serif; margin: 40px; line-height: 1.6; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; }
              .title { font-size: 28px; font-weight: bold; color: #1e40af; margin-bottom: 10px; }
              .subtitle { font-size: 16px; color: #6b7280; font-style: italic; }
              .timestamp { font-size: 12px; color: #9ca3af; margin-top: 10px; }
              .qa-section { margin: 30px 0; }
              .question { font-weight: bold; color: #1f2937; margin: 20px 0 10px 0; padding: 10px; background-color: #f8fafc; border-left: 4px solid #3b82f6; }
              .answer { margin: 0 0 20px 20px; color: #374151; }
              .question-number { color: #3b82f6; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">${header}</div>
              <div class="subtitle">${subtitle}</div>
              <div class="timestamp">Generated on: ${timestamp}</div>
            </div>
            <div class="qa-section">
      `;

      questions.forEach((question, index) => {
        const questionNumber = index + 1;
        const answer = answers[question] || 'No answer provided';
        
        htmlContent += `
          <div class="question">
            <span class="question-number">Q${questionNumber}:</span> ${question}
          </div>
          <div class="answer">${answer}</div>
        `;
      });

      htmlContent += `
            </div>
          </body>
        </html>
      `;

      // Create blob and download
      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${rfpFilename || 'RFP_Analysis'}_SMARTFILL_AI.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  const sendEmail = async () => {
    setEmailState(prev => ({ ...prev, isSending: true }));

    try {
      // Format questions and answers for email
      let questionsAnswersText = '';
      questions.forEach((question, index) => {
        const questionNumber = index + 1;
        const answer = answers[question] || 'No answer provided';
        questionsAnswersText += `Q${questionNumber}: ${question}\nA${questionNumber}: ${answer}\n\n`;
      });

      await apiService.sendResultsEmail(
        emailState.email,
        questionsAnswersText,
        emailState.subject
      );
      
      setEmailState(prev => ({ 
        ...prev, 
        isSending: false, 
        sent: true, 
        isOpen: false 
      }));

    } catch (error) {
      console.error('Email sending failed:', error);
      setEmailState(prev => ({ ...prev, isSending: false }));
    }
  };

  const answeredCount = Object.keys(answers).length;
  const completionRate = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 transition-all duration-300 ${
      !isEnabled ? 'opacity-50 pointer-events-none' : ''
    }`}>
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Step 4: Generate Final Document
        </h3>
        <p className="text-gray-600">
          Create a professional RFP response document with all questions and AI-generated answers.
        </p>
        {!isEnabled && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-800 text-sm">
              Please complete the AI processing step first.
            </p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{questions.length}</p>
          <p className="text-sm text-blue-800">Total Questions</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{answeredCount}</p>
          <p className="text-sm text-green-800">Answered</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{completionRate}%</p>
          <p className="text-sm text-purple-800">Complete</p>
        </div>
      </div>

      {/* Preview Section */}
      {answeredCount > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-3"
          >
            <Eye className="w-4 h-4" />
            <span>{showPreview ? 'Hide' : 'Preview'} Document Content</span>
          </button>

          {showPreview && (
            <motion.div
              className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <div className="bg-white p-6 rounded">
                <h3 className="text-xl font-bold text-gray-900 mb-6">RFP Response Document</h3>
                
                {questions.map((question, index) => (
                  <div key={index} className="mb-6 pb-4 border-b border-gray-200 last:border-b-0">
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Question {index + 1}: {question}
                    </h4>
                    <div className="text-gray-700 text-sm">
                      {answers[question] || (
                        <span className="text-yellow-600 italic">Answer pending...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Document Generation */}
      <div className="space-y-4">
        {documentState.status === 'idle' && (
          <motion.button
            onClick={generateDocument}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={!isEnabled || answeredCount === 0}
          >
            <FileText className="w-5 h-5" />
            <span>Generate Document</span>
          </motion.button>
        )}

        {documentState.status === 'generating' && (
          <div className="w-full py-3 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center space-x-2">
            <Loader className="w-5 h-5 animate-spin" />
            <span>Generating document...</span>
          </div>
        )}

        {documentState.status === 'ready' && (
          <motion.div
            className="bg-green-50 border border-green-200 rounded-lg p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex items-center space-x-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="font-medium text-green-800">Document Ready!</span>
            </div>
            <p className="text-green-700 text-sm mb-4">
              Your RFP response document has been generated successfully.
            </p>
            
            <div className="flex space-x-3">
              <motion.button
                onClick={downloadDocument}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </motion.button>
              
              <motion.button
                onClick={() => setEmailState(prev => ({ ...prev, isOpen: true }))}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Mail className="w-4 h-4" />
                <span>Email</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {documentState.status === 'error' && (
          <div className="w-full py-3 bg-red-100 text-red-700 rounded-lg flex items-center justify-center space-x-2">
            <span>Failed to generate document. Please try again.</span>
          </div>
        )}
      </div>

      {/* Email Modal */}
      {emailState.isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Document via Email</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={emailState.email}
                  onChange={(e) => setEmailState(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="recipient@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailState.subject}
                  onChange={(e) => setEmailState(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={emailState.message}
                  onChange={(e) => setEmailState(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setEmailState(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={emailState.isSending}
              >
                Cancel
              </button>
              <motion.button
                onClick={sendEmail}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={emailState.isSending || !emailState.email}
              >
                {emailState.isSending ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{emailState.isSending ? 'Sending...' : 'Send'}</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Email Success Notification */}
      {emailState.sent && (
        <motion.div
          className="fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
        >
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5" />
            <span>Email sent successfully!</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DocumentGenerator;
