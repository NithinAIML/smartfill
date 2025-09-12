import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  Brain, 
  Download,
  CheckCircle,
  Circle,
  Clock,
  Database,
  AlertCircle
} from 'lucide-react';

import WorkflowStepper from './WorkflowStepper';
import TrainingUploaderNew from './TrainingUploaderNew';
import RFPUploaderNew from './RFPUploaderNew';
import RAGProcessorNew from './RAGProcessorNew';
import DocumentGenerator from './DocumentGenerator';
import { apiService } from '../../services/api';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  icon: React.ReactNode;
}

interface RFPWorkflowProps {
  clientId?: string;
  clientName?: string;
  isClientMode?: boolean; // New prop to indicate client-specific mode
}

const RFPWorkflow: React.FC<RFPWorkflowProps> = ({ clientId, clientName, isClientMode = false }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [knowledgeBaseReady, setKnowledgeBaseReady] = useState(false);
  const [extractedQuestions, setExtractedQuestions] = useState<string[]>([]);
  const [rfpFilename, setRfpFilename] = useState('');
  const [generatedAnswers, setGeneratedAnswers] = useState<Record<string, string>>({});
  const [gapQuestions, setGapQuestions] = useState<string[]>([]);
  const [trainingFilesCount, setTrainingFilesCount] = useState(0);

  // Check knowledge base status on component mount
  useEffect(() => {
    checkKnowledgeBaseStatus();
  }, [clientId]);

  const checkKnowledgeBaseStatus = async () => {
    try {
      if (clientId) {
        // Use client-specific knowledge base status
        const response = await apiService.getClientKnowledgeBaseStatus(clientId);
        setKnowledgeBaseReady(response.status === 'ready');
        setTrainingFilesCount(response.stats.totalDocuments);
        
        // If knowledge base exists, mark training step as completed
        if (response.status === 'ready') {
          updateStepStatus(0, 'completed');
          if (currentStep === 0) {
            updateStepStatus(1, 'active');
            setCurrentStep(1);
          }
        }
      } else {
        // Fallback to general knowledge base status
        const response = await apiService.getKnowledgeBaseStatus();
        setKnowledgeBaseReady(response.ready);
        
        if (response.ready && response.document_count) {
          setTrainingFilesCount(response.document_count);
          // If knowledge base exists, mark training step as completed
          updateStepStatus(0, 'completed');
          if (currentStep === 0) {
            updateStepStatus(1, 'active');
            setCurrentStep(1);
          }
        }
      }
    } catch (error) {
      console.error('Error checking knowledge base status:', error);
      setKnowledgeBaseReady(false);
    }
  };

  const [steps, setSteps] = useState<WorkflowStep[]>([
    {
      id: 'training',
      title: 'Knowledge Base',
      description: 'Upload training documents',
      status: 'active',
      icon: <Database className="w-6 h-6" />
    },
    {
      id: 'rfp',
      title: 'RFP Upload',
      description: 'Extract questions',
      status: 'pending',
      icon: <FileText className="w-6 h-6" />
    },
    {
      id: 'processing',
      title: 'AI Processing',
      description: 'Generate answers',
      status: 'pending',
      icon: <Brain className="w-6 h-6" />
    },
    {
      id: 'document',
      title: 'Final Document',
      description: 'Download & email',
      status: 'pending',
      icon: <Download className="w-6 h-6" />
    }
  ]);

  const updateStepStatus = (stepIndex: number, status: WorkflowStep['status']) => {
    setSteps(prev => prev.map((step, index) => 
      index === stepIndex ? { ...step, status } : step
    ));
  };

  const handleKnowledgeBaseReady = (fileCount: number) => {
    setKnowledgeBaseReady(true);
    setTrainingFilesCount(fileCount);
    updateStepStatus(0, 'completed');
    updateStepStatus(1, 'active');
    setCurrentStep(1);
  };

  const handleQuestionsExtracted = (questions: string[]) => {
    setExtractedQuestions(questions);
    updateStepStatus(1, 'completed');
    updateStepStatus(2, 'active');
    setCurrentStep(2);
  };

  const handleProcessingComplete = (answers: Record<string, string>, gaps: string[]) => {
    setGeneratedAnswers(answers);
    setGapQuestions(gaps);
    updateStepStatus(2, 'completed');
    updateStepStatus(3, 'active');
    setCurrentStep(3);
  };

  const handleStepChange = (stepIndex: number) => {
    // Only allow navigation to completed or active steps
    const step = steps[stepIndex];
    if (step.status === 'completed' || step.status === 'active') {
      setCurrentStep(stepIndex);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Client Mode - Knowledge Base Not Ready */}
        {isClientMode && !knowledgeBaseReady && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-8 text-center"
          >
            <FileText className="h-16 w-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-gray-800 mb-2">RFP Processing</h3>
            <p className="text-gray-600 mb-6">
              To process RFP documents for <span className="font-semibold">{clientName}</span>, 
              please set up the knowledge base first by uploading training documents.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                <p className="text-yellow-800 text-sm">
                  Knowledge base is required to generate accurate RFP responses
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Go to the Knowledge Base tab to upload training documents first.
            </p>
          </motion.div>
        )}

        {/* Normal Workflow (when KB ready or not in client mode) */}
        {(!isClientMode || knowledgeBaseReady) && (
          <>
            {/* Header */}
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                {isClientMode ? `RFP Processing for ${clientName}` : 'SmartFill AI RFP Assistant'}
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                {isClientMode ? 
                  'Upload your RFP document to extract questions and generate professional responses using your custom knowledge base.' :
                  'Transform your RFP response process with AI. Upload your documents, extract questions automatically, and generate professional responses using advanced RAG technology.'
                }
              </p>
            </motion.div>

        {/* Workflow Stepper */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <WorkflowStepper 
            currentStep={currentStep}
            onStepChange={handleStepChange}
            steps={steps}
          />
        </motion.div>

        {/* Step Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {currentStep === 0 && (
            <TrainingUploaderNew 
              onKnowledgeBaseReady={handleKnowledgeBaseReady}
              initialKnowledgeBaseReady={knowledgeBaseReady}
              clientId={clientId}
              clientName={clientName}
            />
          )}

          {currentStep === 1 && (
            <RFPUploaderNew 
              onQuestionsExtracted={handleQuestionsExtracted}
              knowledgeBaseReady={knowledgeBaseReady}
              clientId={clientId}
              clientName={clientName}
            />
          )}

          {currentStep === 2 && (
            <RAGProcessorNew 
              questions={extractedQuestions}
              knowledgeBaseReady={knowledgeBaseReady}
              onProcessingComplete={handleProcessingComplete}
              clientId={clientId}
              clientName={clientName}
            />
          )}

          {currentStep === 3 && (
            <DocumentGenerator 
              answers={generatedAnswers}
              questions={extractedQuestions}
              rfpFilename={rfpFilename}
              isEnabled={Object.keys(generatedAnswers).length > 0}
            />
          )}
        </motion.div>

        {/* Progress Summary (always visible at bottom) */}
        <motion.div
          className="mt-8 bg-white rounded-xl shadow-lg p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{trainingFilesCount}</div>
              <div className="text-sm text-gray-600">Training Documents</div>
              <div className="text-xs text-gray-500">
                {knowledgeBaseReady ? '✅ KB Ready' : '⏳ Pending'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{extractedQuestions.length}</div>
              <div className="text-sm text-gray-600">Questions Extracted</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{Object.keys(generatedAnswers).length}</div>
              <div className="text-sm text-gray-600">Answers Generated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{gapQuestions.length}</div>
              <div className="text-sm text-gray-600">Need Context</div>
            </div>
          </div>
        </motion.div>
            </>
        )}
      </div>
    </div>
  );
};

export default RFPWorkflow;
