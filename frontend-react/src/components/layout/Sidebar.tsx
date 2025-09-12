import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Upload, 
  Clock, 
  Library, 
  BarChart3, 
  Settings, 
  Bot,
  ChevronLeft,
  Zap
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    {
      id: 'upload',
      icon: Upload,
      label: 'Upload Center',
      description: 'Select client to upload documents'
    },
    {
      id: 'processing',
      icon: Clock,
      label: 'Processing Queue',
      description: 'Select client to track processing'
    },
    {
      id: 'library',
      icon: Library,
      label: 'Document Library',
      description: 'Select client to manage documents'
    },
    {
      id: 'analytics',
      icon: BarChart3,
      label: 'Analytics',
      description: 'Select client to view insights'
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Settings',
      description: 'Select client to configure'
    }
  ];

  const handleMenuClick = (itemId: string) => {
    console.log(`Clicked ${itemId} - navigating to dashboard`);
    // Force navigation to dashboard root to show client selection
    navigate('/dashboard', { replace: true });
    // Force a page refresh to ensure we go to the main dashboard
    window.location.reload();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isOpen ? 280 : 80,
          transition: { duration: 0.3, ease: 'easeInOut' }
        }}
        className="relative bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg z-50"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            {isOpen ? (
              <motion.div
                key="logo-expanded"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center space-x-3"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gradient">SMARTFILL AI</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">RFP Platform</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="logo-collapsed"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mx-auto"
              >
                <Bot className="h-5 w-5 text-white" />
              </motion.div>
            )}
            
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <motion.div
                animate={{ rotate: isOpen ? 0 : 180 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronLeft className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </motion.div>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = false; // Always false since we're navigating away
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleMenuClick(item.id)}
                  className={`group relative flex items-center rounded-lg transition-all duration-200 w-full text-left ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className={`flex items-center w-full ${isOpen ? 'p-3' : 'p-2 justify-center'}`}>
                    <Icon className={`h-5 w-5 ${isOpen ? 'mr-3' : ''} flex-shrink-0`} />
                    
                    {isOpen && (
                      <motion.div
                        key="menu-text"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="flex-1 min-w-0"
                      >
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {item.description}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute right-0 top-0 bottom-0 w-1 bg-primary-600 rounded-l-full"
                    />
                  )}

                  {/* Tooltip for collapsed state */}
                  {!isOpen && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            {isOpen ? (
              <motion.div
                key="footer-expanded"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400"
              >
                <Zap className="h-4 w-4" />
                <span>Powered by AI</span>
              </motion.div>
            ) : (
              <motion.div
                key="footer-collapsed"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex justify-center"
              >
                <Zap className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </motion.div>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
