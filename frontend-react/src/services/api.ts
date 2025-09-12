const API_BASE_URL = 'http://localhost:8000';

export interface ApiResponse {
  status: string;
  message?: string;
  [key: string]: any;
}

export interface Question {
  id: string;
  text: string;
  answer?: string;
  status: 'pending' | 'answered' | 'reviewing';
}

export interface ProcessResult {
  status: string;
  questions: string[];
  count: number;
  filename: string;
}

export interface AnswerResult {
  status: string;
  message: string;
  file_path: string;
  questions_count: number;
  answers_generated: number;
  answers?: Record<string, string>;
  needs_context?: string[];
}

export interface Client {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  status: 'active' | 'inactive';
}

export interface ClientStats {
  totalDocuments: number;
  lastTraining: string | null;
  avgProcessingTime: string;
  successRate: string;
}

export interface KnowledgeBaseStatus {
  status: 'empty' | 'ready' | 'training';
  stats: ClientStats;
}

class ApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Authentication
  async login(username: string, password: string): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    return this.makeRequest('/login', {
      method: 'POST',
      body: formData,
    });
  }

  // Training document upload
  async uploadTrainingDocuments(files: File[]): Promise<ApiResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    return this.makeRequest('/upload-training-documents', {
      method: 'POST',
      body: formData,
    });
  }

  // Knowledge base status
  async getKnowledgeBaseStatus(): Promise<ApiResponse> {
    return this.makeRequest('/knowledge-base-status', {
      method: 'GET',
    });
  }

  // Process questions with context
  async processQuestionsWithContext(questions: string[], contextInputs: string[]): Promise<ApiResponse> {
    const formData = new FormData();
    questions.forEach(question => {
      formData.append('questions', question);
    });
    contextInputs.forEach(context => {
      formData.append('context_inputs', context);
    });

    return this.makeRequest('/process-questions-with-context', {
      method: 'POST',
      body: formData,
    });
  }

  // Reset knowledge base
  async resetKnowledgeBase(): Promise<ApiResponse> {
    return this.makeRequest('/reset-knowledge-base', {
      method: 'POST',
    });
  }

  // Document ingestion
  async ingestDocuments(files: File[]): Promise<ApiResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    return this.makeRequest('/ingest', {
      method: 'POST',
      body: formData,
    });
  }

  // RFP processing
  async processRFP(file: File): Promise<ProcessResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.makeRequest('/process-rfp', {
      method: 'POST',
      body: formData,
    });
  }

  // Answer generation
  async answerRFP(file: File): Promise<AnswerResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.makeRequest('/answer-rfp', {
      method: 'POST',
      body: formData,
    });
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Send results via email
  async sendResultsEmail(
    recipientEmail: string, 
    questionsAnswers: string, 
    subject?: string
  ): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('recipient_email', recipientEmail);
    formData.append('questions_answers', questionsAnswers);
    if (subject) {
      formData.append('subject', subject);
    }

    return this.makeRequest('/send-email', {
      method: 'POST',
      body: formData,
    });
  }

  // Generate Word document
  async generateDocument(questionsAnswers: string): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('questions_answers', questionsAnswers);

    return this.makeRequest('/generate-document', {
      method: 'POST',
      body: formData,
    });
  }

  // Get download URL
  getDownloadUrl(filename: string): string {
    return `${API_BASE_URL}/download?file=${encodeURIComponent(filename)}`;
  }

  // Client Management
  async getClients(): Promise<{ clients: Client[] }> {
    return this.makeRequest('/clients', {
      method: 'GET',
    });
  }

  async createClient(client: Omit<Client, 'id' | 'createdAt'>): Promise<ApiResponse> {
    const newClient: Client = {
      ...client,
      id: `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    return this.makeRequest('/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client: newClient }),
    });
  }

  async deleteClient(clientId: string): Promise<ApiResponse> {
    return this.makeRequest(`/clients/${clientId}`, {
      method: 'DELETE',
    });
  }

  async getClientKnowledgeBaseStatus(clientId: string): Promise<KnowledgeBaseStatus> {
    return this.makeRequest(`/clients/${clientId}/knowledge-base/status`, {
      method: 'GET',
    });
  }

  // Client-specific training document upload
  async uploadClientTrainingDocuments(clientId: string, files: File[]): Promise<ApiResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    return this.makeRequest(`/clients/${clientId}/upload-training-documents`, {
      method: 'POST',
      body: formData,
    });
  }

  // Client-specific RFP processing
  async answerRFPForClient(clientId: string, file: File): Promise<AnswerResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.makeRequest(`/clients/${clientId}/answer-rfp`, {
      method: 'POST',
      body: formData,
    });
  }
}

export const apiService = new ApiService();
export default apiService;
