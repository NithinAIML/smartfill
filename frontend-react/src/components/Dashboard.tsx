import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import ClientManager from './ClientManager';
import ClientDashboard from './ClientDashboard';
import ProcessingQueue from './dashboard/ProcessingQueue';
import DocumentLibrary from './dashboard/DocumentLibrary';
import Analytics from './dashboard/Analytics';
import Settings from './dashboard/Settings';

interface Client {
  id: string;
  name: string;
  documentsCount: number;
  lastUpdated: string;
  createdAt: string;
}

const Dashboard: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const handleClientSelected = (client: Client) => {
    console.log('Client selected:', client);
    setSelectedClient(client);
  };

  const handleBackToClients = () => {
    setSelectedClient(null);
  };

  const handleClientUpdate = (updatedClient: Client) => {
    setSelectedClient(updatedClient);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar - Only show when in ClientManager mode */}
      {!selectedClient && (
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Only show when in ClientManager mode */}
        {!selectedClient && (
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        )}
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <Routes>
              <Route 
                path="/" 
                element={
                  selectedClient ? (
                    <ClientDashboard 
                      client={selectedClient}
                      onBack={handleBackToClients}
                      onClientUpdate={handleClientUpdate}
                    />
                  ) : (
                    <ClientManager onClientSelected={handleClientSelected} />
                  )
                } 
              />
              {/* Redirect old sidebar routes to main dashboard */}
              <Route path="/upload" element={<ClientManager onClientSelected={handleClientSelected} />} />
              <Route path="/processing" element={<ClientManager onClientSelected={handleClientSelected} />} />
              <Route path="/library" element={<ClientManager onClientSelected={handleClientSelected} />} />
              <Route path="/analytics" element={<ClientManager onClientSelected={handleClientSelected} />} />
              <Route path="/settings" element={<ClientManager onClientSelected={handleClientSelected} />} />
            </Routes>
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
