import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

interface User {
  id: string;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      
      login: async (username: string, password: string) => {
        try {
          // Try backend authentication first
          const response = await axios.post('http://localhost:8000/login', {
            username,
            password,
          });
          
          if (response.data.message === 'Login successful') {
            const user = {
              id: '1',
              username,
              role: username === 'admin' ? 'admin' : 'user',
            };
            
            set({ user, isAuthenticated: true });
            return true;
          }
          return false;
        } catch (error) {
          console.error('Backend login failed, trying local auth:', error);
          
          // Fallback to local authentication
          const validCredentials = {
            'admin': 'password123',
            'user': 'secret'
          };
          
          if (validCredentials[username as keyof typeof validCredentials] === password) {
            const user = {
              id: '1',
              username,
              role: username === 'admin' ? 'admin' : 'user',
            };
            
            set({ user, isAuthenticated: true });
            return true;
          }
          return false;
        }
      },
      
      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
      
      checkAuth: () => {
        const state = get();
        if (state.user) {
          set({ isAuthenticated: true });
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
