import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  CheckCircle, 
  AlertTriangle, 
  Loader,
  MessageSquare,
  RefreshCw,
  Plus,
  X,
  Send
} from 'lucide-react';
import apiService from '../../services/api';

interface RAGProcessorProps {
  questions: string[];
  rfpFilename: string;
  onComplete: (answers: Record<string, string>, gaps: string[]) => void;
  isEnabled: boolean;
}

interface ProcessingQuestion {
  question: string;
  index: number;
  status: 'pending' | 'processing' | 'completed' | 'needs_context';
  answer?: string;
}

interface GapQuestion {
  question: string;
  index: number;
  additionalContext: string;
}

const RAGProcessor: React.FC<RAGProcessorProps> = ({ 
  questions, 
  rfpFilename, 
  onComplete, 
  isEnabled 
}) => {
  const [processingQuestions, setProcessingQuestions] = useState<ProcessingQuestion[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessing, setCurrentProcessing] = useState<number>(-1);
  const [gapQuestions, setGapQuestions] = useState<GapQuestion[]>([]);
  const [showGapForm, setShowGapForm] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (questions.length > 0) {
      const initialQuestions: ProcessingQuestion[] = questions.map((q, index) => ({
        question: q,
        index,
        status: 'pending'
      }));
      setProcessingQuestions(initialQuestions);
    }
  }, [questions]);

  const startProcessing = async () => {
    setIsProcessing(true);
    setCurrentProcessing(0);

    try {
      // Create a file object for the API call
      const file = new File([JSON.stringify({ questions })], rfpFilename, { type: 'application/json' });
      
      const result = await apiService.answerRFP(file);
      
      // Process the results
      const newAnswers: Record<string, string> = {};
      const gaps: string[] = [];
      
      // Update questions with results
      setProcessingQuestions(prev => prev.map(pq => {
        if (result.answers && result.answers[pq.question]) {
          newAnswers[pq.question] = result.answers[pq.question];
          return { ...pq, status: 'completed', answer: result.answers[pq.question] };
        } else if (result.needs_context?.includes(pq.question)) {
          gaps.push(pq.question);
          return { ...pq, status: 'needs_context' };
        } else {
          return { ...pq, status: 'completed', answer: 'No sufficient context found.' };
        }
      }));

      setAnswers(newAnswers);
      
      if (gaps.length > 0) {
        const gapQs: GapQuestion[] = gaps.map((q, idx) => ({
          question: q,
          index: questions.indexOf(q),
          additionalContext: ''
        }));
        setGapQuestions(gapQs);
        setShowGapForm(true);
      } else {
        onComplete(newAnswers, []);
      }

    } catch (error) {
      console.error('RAG processing failed:', error);
      // Mark all as error or needs context
      setProcessingQuestions(prev => prev.map(pq => ({ ...pq, status: 'needs_context' })));
    } finally {
      setIsProcessing(false);
      setCurrentProcessing(-1);
    }
  };

  const handleGapContextSubmit = () => {
    // For now, we'll mark gap questions as completed with the additional context
    const updatedAnswers = { ...answers };
    const updatedQuestions = processingQuestions.map(pq => {
      const gapQ = gapQuestions.find(gq => gq.question === pq.question);
      if (gapQ && gapQ.additionalContext.trim()) {
        updatedAnswers[pq.question] = `Based on additional context: ${gapQ.additionalContext}`;
        return { ...pq, status: 'completed' as const, answer: updatedAnswers[pq.question] };
      }
      return pq;
    });

    setProcessingQuestions(updatedQuestions);
    setAnswers(updatedAnswers);
    setShowGapForm(false);
    onComplete(updatedAnswers, []);
  };

  const updateGapContext = (index: number, context: string) => {
    setGapQuestions(prev => prev.map((gq, idx) => 
      idx === index ? { ...gq, additionalContext: context } : gq
    ));
  };

  const completedCount = processingQuestions.filter(pq => pq.status === 'completed').length;
  const needsContextCount = processingQuestions.filter(pq => pq.status === 'needs_context').length;
  const progressPercentage = processingQuestions.length > 0 
    ? Math.round((completedCount / processingQuestions.length) * 100) 
    : 0;

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 transition-all duration-300 ${
      !isEnabled ? 'opacity-50 pointer-events-none' : ''
    }`}>
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Step 3: AI Answer Generation
        </h3>
        <p className="text-gray-600">
          Our AI will analyze each question and generate answers using your training documents.
        </p>
        {!isEnabled && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-800 text-sm">
              Please complete previous steps first.
            </p>
          </div>
        )}
      </div>

      {/* Processing Overview */}
      {processingQuestions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Brain className="w-6 h-6 text-blue-500" />
              <div>
                <h4 className="font-medium text-gray-900">
                  {processingQuestions.length} Questions to Process
                </h4>
                <p className="text-sm text-gray-500">
                  {completedCount} completed • {needsContextCount} need context
                </p>
              </div>
            </div>
            
            {!isProcessing && completedCount === 0 && (
              <motion.button
                onClick={startProcessing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={!isEnabled}
              >
                Start Processing
              </motion.button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <motion.div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 text-center">
            {progressPercentage}% Complete ({completedCount}/{processingQuestions.length})
          </p>
        </div>
      )}

      {/* Questions List */}
      {processingQuestions.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {processingQuestions.map((pq, index) => (
            <motion.div
              key={index}
              className={`p-4 rounded-lg border transition-all duration-300 ${
                pq.status === 'completed' 
                  ? 'border-green-200 bg-green-50'
                  : pq.status === 'needs_context'
                  ? 'border-yellow-200 bg-yellow-50'
                  : pq.status === 'processing'
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm font-medium text-gray-500">Q{index + 1}</span>
                    {pq.status === 'completed' && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {pq.status === 'needs_context' && (
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    )}
                    {pq.status === 'processing' && (
                      <Loader className="w-4 h-4 animate-spin text-blue-500" />
                    )}
                  </div>
                  <p className="text-gray-900 mb-2">{pq.question}</p>
                  
                  {pq.answer && (
                    <div className="mt-3 p-3 bg-white rounded border">
                      <div className="flex items-center space-x-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700">AI Answer</span>
                      </div>
                      <p className="text-gray-700 text-sm">{pq.answer}</p>
                    </div>
                  )}
                  
                  {pq.status === 'needs_context' && (
                    <div className="mt-3 p-3 bg-yellow-100 rounded border border-yellow-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <span className="text-yellow-800 text-sm font-medium">
                          Additional Context Needed
                        </span>
                      </div>
                      <p className="text-yellow-700 text-sm mb-3">
                        Our training documents don't contain sufficient information to answer this question confidently.
                      </p>
                      <textarea
                        placeholder="Please provide relevant information, examples, or context that would help answer this question..."
                        className="w-full p-2 border border-yellow-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
                        rows={3}
                        onChange={(e) => {
                          // Update additional context for this question
                          const updatedGaps = gapQuestions.map(gq => 
                            gq.question === pq.question 
                              ? { ...gq, additionalContext: e.target.value }
                              : gq
                          );
                          if (!gapQuestions.find(gq => gq.question === pq.question)) {
                            updatedGaps.push({
                              question: pq.question,
                              index: pq.index,
                              additionalContext: e.target.value
                            });
                          }
                          setGapQuestions(updatedGaps);
                        }}
                      />
                      <div className="flex space-x-2 mt-2">
                        <button
                          className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                          onClick={() => {
                            // Generate answer with provided context
                            const gapQ = gapQuestions.find(gq => gq.question === pq.question);
                            if (gapQ && gapQ.additionalContext.trim()) {
                              const newAnswer = `Based on additional context: ${gapQ.additionalContext}`;
                              setAnswers(prev => ({ ...prev, [pq.question]: newAnswer }));
                              setProcessingQuestions(prev => prev.map(q => 
                                q.question === pq.question 
                                  ? { ...q, status: 'completed' as const, answer: newAnswer }
                                  : q
                              ));
                            }
                          }}
                        >
                          Generate Answer
                        </button>
                        <label className="flex items-center space-x-2 text-sm text-gray-600">
                          <input type="file" className="hidden" accept=".pdf,.docx,.doc,.txt" />
                          <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm">
                            Upload File
                          </button>
                          <span>or upload supporting document</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Gap Questions Form */}
      <AnimatePresence>
        {showGapForm && gapQuestions.length > 0 && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl max-h-[80vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Provide Additional Context
                </h3>
                <button
                  onClick={() => setShowGapForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <p className="text-gray-600 mb-6">
                Some questions need additional context. Please provide relevant information 
                to help generate better answers.
              </p>

              <div className="space-y-6">
                {gapQuestions.map((gq, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-500">Question {gq.index + 1}</span>
                      <p className="text-gray-900 mt-1">{gq.question}</p>
                    </div>
                    <textarea
                      value={gq.additionalContext}
                      onChange={(e) => updateGapContext(index, e.target.value)}
                      placeholder="Provide additional context, examples, or specific information that would help answer this question..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowGapForm(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Skip for Now
                </button>
                <motion.button
                  onClick={handleGapContextSubmit}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Send className="w-4 h-4" />
                  <span>Update Answers</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RAGProcessor;
