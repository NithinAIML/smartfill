import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  Upload, 
  FileText, 
  Brain, 
  Download,
  Mail,
  AlertCircle,
  Plus,
  X,
  ChevronRight
} from 'lucide-react';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  icon: React.ReactNode;
}

interface WorkflowStepperProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  steps: WorkflowStep[];
}

const WorkflowStepper: React.FC<WorkflowStepperProps> = ({ 
  currentStep, 
  onStepChange, 
  steps 
}) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <motion.div
              className={`flex flex-col items-center cursor-pointer transition-all duration-300 ${
                index <= currentStep ? 'opacity-100' : 'opacity-50'
              }`}
              onClick={() => index <= currentStep && onStepChange(index)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Step Icon */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
                  step.status === 'completed'
                    ? 'bg-green-500 text-white'
                    : step.status === 'active'
                    ? 'bg-blue-500 text-white'
                    : step.status === 'error'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step.status === 'completed' ? (
                  <CheckCircle className="w-6 h-6" />
                ) : step.status === 'error' ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  step.icon
                )}
              </div>
              
              {/* Step Info */}
              <div className="text-center">
                <p className="font-semibold text-sm text-gray-900">{step.title}</p>
                <p className="text-xs text-gray-500 max-w-24">{step.description}</p>
              </div>
            </motion.div>
            
            {/* Connector */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 transition-all duration-300 ${
                  index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default WorkflowStepper;
