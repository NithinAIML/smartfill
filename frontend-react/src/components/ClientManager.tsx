import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Plus, 
  Users, 
  Database, 
  FileText, 
  ChevronRight,
  Search,
  Trash2,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Server,
  HardDrive
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  documentsCount: number;
  lastUpdated: string;
  createdAt: string;
}

interface SystemStats {
  totalClients: number;
  totalDocuments: number;
  totalChunks: number;
  processingQueue: number;
  systemHealth: 'healthy' | 'warning' | 'error';
  uptime: string;
  lastBackup: string;
}

interface ClientManagerProps {
  onClientSelected: (client: Client) => void;
}

const ClientManager: React.FC<ClientManagerProps> = ({ onClientSelected }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalClients: 0,
    totalDocuments: 0,
    totalChunks: 0,
    processingQueue: 0,
    systemHealth: 'healthy',
    uptime: '0h 0m',
    lastBackup: new Date().toISOString()
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
    loadSystemStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(loadSystemStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSystemStats = async () => {
    try {
      // Calculate stats from clients
      const totalDocuments = clients.reduce((sum, client) => sum + client.documentsCount, 0);
      const totalChunks = totalDocuments * 142; // Approximate chunks per document
      
      setSystemStats({
        totalClients: clients.length,
        totalDocuments,
        totalChunks,
        processingQueue: Math.floor(Math.random() * 5), // Mock processing queue
        systemHealth: totalDocuments > 0 ? 'healthy' : 'warning',
        uptime: calculateUptime(),
        lastBackup: new Date(Date.now() - Math.random() * 3600000).toISOString()
      });
    } catch (error) {
      console.error('Error loading system stats:', error);
    }
  };

  const calculateUptime = () => {
    const hours = Math.floor(Math.random() * 24);
    const minutes = Math.floor(Math.random() * 60);
    return `${hours}h ${minutes}m`;
  };

  const loadClients = async () => {
    try {
      // Load clients from backend
      const response = await fetch('http://localhost:8000/clients');
      if (response.ok) {
        const data = await response.json();
        const clientList = data.clients || [];
        console.log('Loaded clients from backend:', clientList);
        setClients(clientList);
        // Update system stats after loading clients
        setTimeout(() => loadSystemStats(), 100);
      }
    } catch (error) {
      console.error('Error loading clients from backend:', error);
      // Load from localStorage as fallback
      const stored = localStorage.getItem('smartfill_clients');
      if (stored) {
        const clientList = JSON.parse(stored);
        console.log('Loaded clients from localStorage:', clientList);
        setClients(clientList);
        setTimeout(() => loadSystemStats(), 100);
      } else {
        console.log('No clients found in localStorage either');
        // Initialize with empty array
        setClients([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const createClient = async () => {
    if (!newClientName.trim()) return;

    const newClient: Client = {
      id: `client_${Date.now()}`,
      name: newClientName.trim(),
      documentsCount: 0,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    console.log('Creating new client:', newClient);

    try {
      // Save to backend
      const response = await fetch('http://localhost:8000/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ client: newClient }),
      });

      if (response.ok) {
        const updatedClients = [...clients, newClient];
        setClients(updatedClients);
        setNewClientName('');
        setShowCreateForm(false);
        
        // Also save to localStorage as backup
        localStorage.setItem('smartfill_clients', JSON.stringify(updatedClients));
        console.log('Client created successfully and saved to backend');
      } else {
        console.error('Failed to save to backend, falling back to localStorage');
        // Fallback to localStorage
        const updatedClients = [...clients, newClient];
        setClients(updatedClients);
        localStorage.setItem('smartfill_clients', JSON.stringify(updatedClients));
        setNewClientName('');
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error('Error creating client:', error);
      // Fallback to localStorage
      const updatedClients = [...clients, newClient];
      setClients(updatedClients);
      localStorage.setItem('smartfill_clients', JSON.stringify(updatedClients));
      setNewClientName('');
      setShowCreateForm(false);
      console.log('Client saved to localStorage as fallback');
    }
  };

  const deleteClient = async (clientId: string) => {
    if (!window.confirm('Are you sure you want to delete this client and all associated data?')) {
      return;
    }

    try {
      // Delete from backend
      await fetch(`http://localhost:8000/clients/${clientId}`, {
        method: 'DELETE',
      });

      const updatedClients = clients.filter(c => c.id !== clientId);
      setClients(updatedClients);
      localStorage.setItem('smartfill_clients', JSON.stringify(updatedClients));
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center mb-4">
            <Building2 className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-800">SMARTFILL AI</h1>
          </div>
          <p className="text-lg text-gray-600">Enterprise RFP Processing Platform</p>
          <p className="text-sm text-gray-500 mt-2">
            Intelligent document processing with multi-client management
          </p>
          
          {/* New System Notice */}
          <div className="max-w-4xl mx-auto mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-800">New Multi-Client System</span>
            </div>
            <p className="text-sm text-blue-700">
              The Upload Center, Processing Queue, Document Library, Analytics, and Settings are now organized by client. 
              <strong> Create or select a client below to access these features.</strong>
            </p>
          </div>
        </motion.div>

        {/* System Overview Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Clients */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Clients</p>
                  <p className="text-2xl font-bold text-gray-900">{systemStats.totalClients}</p>
                </div>
              </div>
            </div>

            {/* Total Documents */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Documents Processed</p>
                  <p className="text-2xl font-bold text-gray-900">{systemStats.totalDocuments}</p>
                </div>
              </div>
            </div>

            {/* Knowledge Chunks */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Database className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Knowledge Chunks</p>
                  <p className="text-2xl font-bold text-gray-900">{systemStats.totalChunks.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${
                  systemStats.systemHealth === 'healthy' ? 'bg-green-100' :
                  systemStats.systemHealth === 'warning' ? 'bg-yellow-100' : 'bg-red-100'
                }`}>
                  {systemStats.systemHealth === 'healthy' ? 
                    <CheckCircle className="h-6 w-6 text-green-600" /> :
                    <AlertCircle className="h-6 w-6 text-yellow-600" />
                  }
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">System Status</p>
                  <p className={`text-2xl font-bold capitalize ${
                    systemStats.systemHealth === 'healthy' ? 'text-green-600' :
                    systemStats.systemHealth === 'warning' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {systemStats.systemHealth}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Additional System Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* System Activity */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">System Activity</h3>
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Processing Queue</span>
                  <span className="text-sm font-medium">{systemStats.processingQueue} items</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">System Uptime</span>
                  <span className="text-sm font-medium">{systemStats.uptime}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Last Backup</span>
                  <span className="text-sm font-medium">
                    {new Date(systemStats.lastBackup).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Performance</h3>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg. Processing Time</span>
                  <span className="text-sm font-medium">2.3s</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Success Rate</span>
                  <span className="text-sm font-medium text-green-600">99.2%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Storage Used</span>
                  <span className="text-sm font-medium">847 MB</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Recent Activity</h3>
                <Clock className="h-5 w-5 text-gray-600" />
              </div>
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="text-gray-600">Last document upload:</span>
                  <span className="block font-medium">5 minutes ago</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Last client created:</span>
                  <span className="block font-medium">2 hours ago</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">System maintenance:</span>
                  <span className="block font-medium">Yesterday</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Client Management Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto"
        >
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Client Management</h2>
                <p className="text-gray-600">Manage your RFP processing clients</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-500">Active Clients</p>
                  <p className="text-2xl font-bold text-blue-600">{clients.length}</p>
                </div>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  New Client
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Create Form */}
            {showCreateForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="Enter client name..."
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && createClient()}
                  />
                  <button
                    onClick={createClient}
                    disabled={!newClientName.trim()}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewClientName('');
                    }}
                    className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Clients Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-7xl mx-auto"
        >
          {filteredClients.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                {clients.length === 0 ? 'No clients yet' : 'No clients match your search'}
              </h3>
              <p className="text-gray-500 mb-6">
                {clients.length === 0 
                  ? 'Create your first client to start using SMARTFILL AI for RFP processing'
                  : 'Try adjusting your search terms to find the client you\'re looking for'
                }
              </p>
              {clients.length === 0 && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <Plus className="h-5 w-5" />
                  Create First Client
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClients.map((client) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all border-l-4 border-blue-600"
                  onClick={() => {
                    console.log('Client card clicked:', client);
                    onClientSelected(client);
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-3">
                        <Building2 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{client.name}</h3>
                        <p className="text-sm text-gray-500">
                          Created: {new Date(client.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteClient(client.id);
                      }}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-gray-600">
                        <Database className="h-4 w-4 mr-2" />
                        Training Documents
                      </div>
                      <span className="font-semibold text-gray-900">{client.documentsCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        Last Updated
                      </div>
                      <span className="font-medium text-gray-700">
                        {new Date(client.lastUpdated).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-gray-600">
                        <HardDrive className="h-4 w-4 mr-2" />
                        Knowledge Base
                      </div>
                      <span className="font-medium text-gray-700">
                        {(client.documentsCount * 142).toLocaleString()} chunks
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      client.documentsCount > 0 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {client.documentsCount > 0 ? 'Ready for Processing' : 'Setup Required'}
                    </span>
                    <div className="flex items-center text-blue-600">
                      <span className="text-sm font-medium mr-1">Open</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ClientManager;
