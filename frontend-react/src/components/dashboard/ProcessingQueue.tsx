import React from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, Loader, FileText } from 'lucide-react';

const ProcessingQueue: React.FC = () => {
  const processingItems = [
    {
      id: 1,
      name: 'Enterprise Software RFP.xlsx',
      status: 'processing',
      progress: 65,
      startTime: '2 minutes ago',
      estimatedTime: '3 minutes remaining'
    },
    {
      id: 2,
      name: 'Marketing Services RFP.xlsx',
      status: 'completed',
      progress: 100,
      startTime: '10 minutes ago',
      questions: 42
    },
    {
      id: 3,
      name: 'IT Infrastructure RFP.xlsx',
      status: 'queued',
      progress: 0,
      startTime: 'Waiting in queue',
      position: 1
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Processing Queue
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Monitor the status of your RFP document processing
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {processingItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-4">
              <FileText className="h-8 w-8 text-blue-500" />
              {item.status === 'processing' && <Loader className="h-5 w-5 text-blue-500 animate-spin" />}
              {item.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {item.status === 'queued' && <Clock className="h-5 w-5 text-yellow-500" />}
            </div>
            
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {item.name}
            </h3>
            
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>Started: {item.startTime}</p>
              {item.status === 'processing' && (
                <>
                  <p>{item.estimatedTime}</p>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress}%` }}
                      className="bg-blue-500 h-2 rounded-full"
                    />
                  </div>
                </>
              )}
              {item.status === 'completed' && (
                <p className="text-green-600 dark:text-green-400">
                  ✓ {item.questions} questions extracted
                </p>
              )}
              {item.status === 'queued' && (
                <p className="text-yellow-600 dark:text-yellow-400">
                  Position #{item.position} in queue
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ProcessingQueue;
