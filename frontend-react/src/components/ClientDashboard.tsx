import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Database, 
  FileText, 
  Upload, 
  ArrowLeft, 
  Settings,
  BarChart3,
  Clock,
  CheckCircle,
  List,
  FolderOpen,
  Activity,
  Users,
  TrendingUp,
  Shield,
  Bell,
  Monitor,
  HardDrive,
  Zap,
  Target,
  Calendar,
  Download,
  Filter,
  Search,
  RefreshCw,
  Plus,
  Eye,
  Trash2,
  Edit
} from 'lucide-react';
import RFPWorkflow from './dashboard/RFPWorkflow';
import KnowledgeBaseManager from './dashboard/KnowledgeBaseManager';

interface Client {
  id: string;
  name: string;
  documentsCount: number;
  lastUpdated: string;
  createdAt: string;
}

interface ClientDashboardProps {
  client: Client;
  onBack: () => void;
  onClientUpdate: (client: Client) => void;
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ 
  client, 
  onBack, 
  onClientUpdate 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'queue' | 'library' | 'analytics' | 'settings' | 'process'>('overview');
  const [knowledgeBaseStatus, setKnowledgeBaseStatus] = useState<'empty' | 'loading' | 'ready'>('empty');
  const [stats, setStats] = useState({
    totalDocuments: 0,
    lastTraining: null as string | null,
    avgProcessingTime: '0s',
    successRate: '100%'
  });
  const [processingQueue, setProcessingQueue] = useState<any[]>([]);
  const [documentLibrary, setDocumentLibrary] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  useEffect(() => {
    checkKnowledgeBaseStatus();
    loadProcessingQueue();
    loadDocumentLibrary();
    loadAnalytics();
  }, [client.id]);

  const checkKnowledgeBaseStatus = async () => {
    try {
      const response = await fetch(`http://localhost:8000/clients/${client.id}/knowledge-base/status`);
      if (response.ok) {
        const data = await response.json();
        setKnowledgeBaseStatus(data.status);
        setStats(data.stats || stats);
        
        // Update client document count if it changed
        if (data.stats?.totalDocuments !== client.documentsCount) {
          const updatedClient = { ...client, documentsCount: data.stats?.totalDocuments || 0 };
          onClientUpdate(updatedClient);
        }
      }
    } catch (error) {
      console.error('Error checking knowledge base status:', error);
      // Check localStorage for client data
      const clientData = localStorage.getItem(`client_${client.id}_data`);
      if (clientData) {
        const data = JSON.parse(clientData);
        setKnowledgeBaseStatus(data.documentsCount > 0 ? 'ready' : 'empty');
      }
    }
  };

  const loadProcessingQueue = async () => {
    try {
      const response = await fetch(`http://localhost:8000/clients/${client.id}/processing-queue`);
      if (response.ok) {
        const data = await response.json();
        setProcessingQueue(data.queue || []);
      }
    } catch (error) {
      console.error('Error loading processing queue:', error);
    }
  };

  const loadDocumentLibrary = async () => {
    try {
      const response = await fetch(`http://localhost:8000/clients/${client.id}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocumentLibrary(data.documents || []);
      }
    } catch (error) {
      console.error('Error loading document library:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch(`http://localhost:8000/clients/${client.id}/analytics`);
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  // Add a function to refresh status periodically
  const refreshStatusWithDelay = () => {
    setTimeout(() => {
      checkKnowledgeBaseStatus();
      loadDocumentLibrary(); // Refresh document library too
      loadAnalytics(); // Refresh analytics
    }, 2000); // Wait 2 seconds for backend to process
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusConfig = (status: string) => {
      switch (status) {
        case 'ready':
          return { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Ready for Processing' };
        case 'loading':
          return { color: 'bg-blue-100 text-blue-800', icon: Clock, text: 'Training in Progress' };
        default:
          return { color: 'bg-yellow-100 text-yellow-800', icon: Upload, text: 'Setup Required' };
      }
    };

    const config = getStatusConfig(status);
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="h-4 w-4 mr-2" />
        {config.text}
      </div>
    );
  };

  // Mock data for demonstrations
  const getFileTypeIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return <FileText className="h-5 w-5 text-gray-400" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={onBack}
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-800">{client.name}</h1>
                  <p className="text-sm text-gray-500">Client Dashboard</p>
                </div>
              </div>
            </div>
            <StatusBadge status={knowledgeBaseStatus} />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-6 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'upload', label: 'Upload Center', icon: Upload },
              { id: 'queue', label: 'Processing Queue', icon: List },
              { id: 'library', label: 'Document Library', icon: FolderOpen },
              { id: 'analytics', label: 'Analytics', icon: Activity },
              { id: 'settings', label: 'Settings', icon: Settings },
              { id: 'process', label: 'Process RFP', icon: FileText }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as any)}
                  className={`flex items-center px-1 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Database className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Training Documents</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.successRate}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Clock className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Processing</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.avgProcessingTime}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Last Updated</p>
                    <p className="text-sm font-bold text-gray-900">
                      {new Date(client.lastUpdated).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
                >
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600">Upload Training Documents</p>
                </button>

                <button
                  onClick={() => setActiveTab('process')}
                  disabled={knowledgeBaseStatus !== 'ready'}
                  className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600">Process New RFP</p>
                </button>

                <button
                  onClick={() => checkKnowledgeBaseStatus()}
                  className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-center"
                >
                  <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600">Refresh Status</p>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'upload' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload Center</h3>
              <p className="text-gray-600 mb-6">
                Upload training documents for {client.name} to build the knowledge base for RFP processing.
              </p>
              <KnowledgeBaseManager 
                clientId={client.id}
                clientName={client.name}
                onStatusChange={refreshStatusWithDelay}
              />
            </div>
          </motion.div>
        )}

        {activeTab === 'queue' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800">Processing Queue</h3>
                <button
                  onClick={() => checkKnowledgeBaseStatus()}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
              </div>
              
              <div className="space-y-4">
                {processingQueue.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <h4 className="font-medium text-gray-800">{item.name}</h4>
                          <p className="text-sm text-gray-500">Status: {item.status}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-600">{item.timeRemaining}</p>
                        <p className="text-xs text-gray-400">{item.progress}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          item.status === 'Completed' ? 'bg-green-500' : 
                          item.status === 'Processing' ? 'bg-blue-500' : 'bg-gray-400'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'library' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800">Document Library</h3>
                <div className="flex space-x-2">
                  <button className="flex items-center px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </button>
                  <button className="flex items-center px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Document</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Size</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Category</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Uploaded</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentLibrary.map((doc) => (
                      <tr key={doc.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <FileText className="h-5 w-5 text-gray-400 mr-3" />
                            <span className="font-medium text-gray-800">{doc.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{doc.type}</td>
                        <td className="py-3 px-4 text-gray-600">{doc.size}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                            {doc.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{doc.uploaded}</td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <button className="p-1 text-gray-400 hover:text-blue-600">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button className="p-1 text-gray-400 hover:text-green-600">
                              <Download className="h-4 w-4" />
                            </button>
                            <button className="p-1 text-gray-400 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-800">Performance</h4>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Response</span>
                    <span className="font-medium">{analyticsData?.performance?.avgResponseTime || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Success Rate</span>
                    <span className="font-medium text-green-600">{analyticsData?.performance?.successRate || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Processed</span>
                    <span className="font-medium">{analyticsData?.performance?.totalProcessed || 0}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-800">Knowledge Base</h4>
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Documents</span>
                    <span className="font-medium">{analyticsData?.knowledgeBase?.totalDocuments || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Text Chunks</span>
                    <span className="font-medium">{analyticsData?.knowledgeBase?.totalChunks || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Index Size</span>
                    <span className="font-medium">{analyticsData?.knowledgeBase?.indexSize || '0 KB'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-800">Usage Stats</h4>
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Daily Queries</span>
                    <span className="font-medium">{analyticsData?.usage?.dailyQueries || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Peak Hours</span>
                    <span className="font-medium">{analyticsData?.usage?.peakHours || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Users</span>
                    <span className="font-medium">{analyticsData?.usage?.activeUsers || 0}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-800">Trends</h4>
                  <Target className="h-5 w-5 text-orange-500" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Query Growth</span>
                    <span className="font-medium text-green-600">{analyticsData?.trends?.queryGrowth || '0%'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Accuracy</span>
                    <span className="font-medium text-green-600">{analyticsData?.trends?.accuracyTrend || '0%'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Satisfaction</span>
                    <span className="font-medium">{analyticsData?.trends?.userSatisfaction || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Weekly Usage Chart */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Usage Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{analyticsData?.usage?.weeklyQueries || 0}</p>
                  <p className="text-sm text-gray-600">Weekly Queries</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{analyticsData?.usage?.monthlyQueries || 0}</p>
                  <p className="text-sm text-gray-600">Monthly Queries</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{analyticsData?.performance?.qualityScore || 0}%</p>
                  <p className="text-sm text-gray-600">Quality Score</p>
                </div>
              </div>
            </div>

            {/* Charts Placeholder */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Trends</h3>
              <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Interactive charts coming soon</p>
                  <p className="text-sm text-gray-400">Data visualization dashboard in development</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Client Settings</h3>
              
              <div className="space-y-6">
                {/* General Settings */}
                <div>
                  <h4 className="font-medium text-gray-800 mb-4">General Settings</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-700">Client Name</p>
                        <p className="text-sm text-gray-500">Display name for this client</p>
                      </div>
                      <button className="flex items-center px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-700">Notifications</p>
                        <p className="text-sm text-gray-500">Receive processing status updates</p>
                      </div>
                      <div className="relative inline-block w-10 mr-2 align-middle select-none">
                        <input
                          type="checkbox"
                          name="notifications"
                          id="notifications"
                          className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                          defaultChecked
                        />
                        <label
                          htmlFor="notifications"
                          className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"
                        ></label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Processing Settings */}
                <div className="border-t pt-6">
                  <h4 className="font-medium text-gray-800 mb-4">Processing Settings</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Response Quality
                      </label>
                      <select className="w-full p-2 border border-gray-300 rounded-lg">
                        <option>High (Slower)</option>
                        <option>Medium (Balanced)</option>
                        <option>Fast (Quick)</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Auto-processing
                      </label>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="auto-processing"
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                        <label htmlFor="auto-processing" className="ml-2 text-sm text-gray-600">
                          Automatically process uploaded RFPs
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="border-t border-red-200 pt-6">
                  <h4 className="font-medium text-red-800 mb-4">Danger Zone</h4>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-800">Delete Client</p>
                        <p className="text-sm text-red-600">Permanently delete this client and all associated data</p>
                      </div>
                      <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                        Delete Client
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'process' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <RFPWorkflow clientId={client.id} clientName={client.name} isClientMode={true} />
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;
