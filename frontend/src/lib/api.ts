import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any[];
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  balance: number;
  bio?: string;
  avatar?: string;
  cardStats?: {
    total: number;
    live: number;
    dead: number;
    error: number;
  };
  successRate?: number;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface Card {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

export interface CheckCardsRequest {
  cards: Card[];
  checkType?: number;
}

export interface GenerateCardsRequest {
  bin: string;
  quantity: number;
  month?: string;
  year?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  bankName?: string;
  bankCode?: string;
  accountNumber: string;
  accountName: string;
  instructions: string;
  minAmount: number;
  maxAmount: number;
  fee?: number;
  feeType?: string;
}

export interface PaymentRequest {
  paymentMethodId: string;
  amount: number;
  notes?: string;
}

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private requestQueue: Map<string, Promise<any>> = new Map();

  constructor() {
    // Xác định API base URL theo thứ tự ưu tiên:
    // 1) localStorage.API_BASE_OVERRIDE (dùng khi cần override khẩn)
    // 2) window.location.origin (tự động dùng đúng domain hiện tại như https://checkcc.live)
    // 3) NEXT_PUBLIC_API_URL (chỉ khi không có window, ví dụ SSR)
    // 4) fallback cứng: https://checkcc.live
    let base = '';
    if (typeof window !== 'undefined') {
      try {
        const override = window.localStorage?.getItem('API_BASE_OVERRIDE');
        const host = window.location.hostname || '';
        const isLocal = /^localhost$|^127\.0\.0\.1$/i.test(host);
        if (override && override.trim().length > 0 && isLocal) {
          // CHỈ cho phép override khi đang chạy ở localhost
          base = override.replace(/\/+$/, '');
        } else if (window.location?.origin) {
          // Trên production, luôn dùng đúng domain hiện tại (ví dụ https://checkcc.live)
          base = window.location.origin.replace(/\/+$/, '');
        }
      } catch {}
    }
    if (!base) {
      base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '') || 'https://checkcc.live';
    }

    // Normalize base to ensure we don't end up with /api/api when env already contains /api
    let apiBase = base;
    if (/\/api\/?$/.test(apiBase)) {
      apiBase = apiBase.replace(/\/?$/, ''); // drop trailing slash only
    } else {
      apiBase = `${apiBase}/api`;
    }

    this.client = axios.create({
      baseURL: apiBase,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle 429 Too Many Requests with exponential backoff
        if (error.response?.status === 429) {
          const retryCount = originalRequest._retryCount || 0;
          const maxRetries = 3;

          if (retryCount < maxRetries) {
            originalRequest._retryCount = retryCount + 1;

            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, retryCount) * 1000;
            const retryAfter = error.response.headers['retry-after'];
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;

            console.warn(`Rate limited. Retrying in ${waitTime}ms (attempt ${retryCount + 1}/${maxRetries})`);

            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.client.request(originalRequest);
          } else {
            console.error('Max retries reached for rate limited request');
          }
        }

        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
          // Token expired, try to refresh
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
              const response = await this.refreshToken(refreshToken);
              if (response.data) {
                this.setToken(response.data.token);
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('refreshToken', response.data.refreshToken);

                // Retry original request
                originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
                return this.client.request(originalRequest);
              }
            } catch (refreshError) {
              // Refresh failed, clear auth but don't auto-redirect
              this.clearAuth();
              console.error('Token refresh failed:', refreshError);
            }
          } else {
            this.clearAuth();
          }
        }

        return Promise.reject(error);
      }
    );

    // Initialize token from localStorage
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        this.setToken(savedToken);
      }
    }
  }

  setToken(token: string) {
    this.token = token;
  }

  clearAuth() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  }


  public getBaseUrl(): string {
    return this.client.defaults.baseURL || '';
  }

  // Debounced request to prevent duplicate API calls
  private async debouncedRequest<T>(key: string, requestFn: () => Promise<T>, delay: number = 300): Promise<T> {
    // If there's already a pending request for this key, return it
    if (this.requestQueue.has(key)) {
      return this.requestQueue.get(key);
    }

    // Create new request promise
    const requestPromise = new Promise<T>((resolve, reject) => {
      setTimeout(async () => {
        try {
          const result = await requestFn();
          this.requestQueue.delete(key);
          resolve(result);
        } catch (error) {
          this.requestQueue.delete(key);
          reject(error);
        }
      }, delay);
    });

    // Store the promise in queue
    this.requestQueue.set(key, requestPromise);
    return requestPromise;
  }

  // Auth endpoints
  async login(data: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await this.client.post('/auth/login', data);
    return response.data;
  }

  async register(data: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.client.post('/auth/logout');
    return response.data;
  }

  async getMe(): Promise<ApiResponse<{ user: User }>> {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async updateProfile(data: any): Promise<ApiResponse<{ user: User }>> {
    const response = await this.client.put('/auth/profile', data);
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ token: string; refreshToken: string }>> {
    const response = await this.client.post('/auth/refresh', { refreshToken });
    return response.data;
  }

  // Card endpoints (legacy)
  async checkCards(data: CheckCardsRequest): Promise<ApiResponse> {
    const response = await this.client.post('/cards/check', data);
    return response.data;
  }

  // Checker (Zenno) endpoints
  async startCheck(payload: { cards: Card[] | string; checkType?: number }): Promise<ApiResponse<{ sessionId: string; estimatedCost: number; pricePerCard: number; total: number }>> {
    const response = await this.client.post('/checker/start', payload);
    return response.data;
  }

  async stopCheck(sessionId: string): Promise<ApiResponse<{ session: any }>> {
    const response = await this.client.post('/checker/start', { stop: true, sessionId });
    return response.data;
  }

  async getCheckStatus(sessionId: string): Promise<ApiResponse<{ session: any; results: Array<{ card: string; status: string; response?: string }> }>> {
    const response = await this.client.get(`/checker/status/${sessionId}`);
    return response.data;
  }

  async getCardHistory(params?: any): Promise<ApiResponse> {
    const response = await this.client.get('/cards/history', { params });
    return response.data;
  }

  async generateCards(data: GenerateCardsRequest): Promise<ApiResponse> {
    const response = await this.client.post('/cards/generate', data);
    return response.data;
  }

  async getCardStats(params?: any): Promise<ApiResponse> {
    const response = await this.client.get('/cards/stats', { params });
    return response.data;
  }

  // Payment endpoints
  async getPaymentMethods(): Promise<ApiResponse<{ methods: PaymentMethod[] }>> {
    const response = await this.client.get('/payments/methods');
    return response.data;
  }

  async createPaymentRequest(data: PaymentRequest): Promise<ApiResponse> {
    const response = await this.client.post('/payments/request', data);
    return response.data;
  }

  async getPaymentRequests(params?: any): Promise<ApiResponse> {
    const response = await this.client.get('/payments/requests', { params });
    return response.data;
  }

  async cancelPaymentRequest(id: string): Promise<ApiResponse> {
    const response = await this.client.delete(`/payments/requests/${id}`);
    return response.data;
  }

  async getPaymentStats(params?: any): Promise<ApiResponse> {
    const response = await this.client.get('/payments/stats', { params });
    return response.data;
  }

  // Admin endpoints
  async getAdminDashboard(params?: any): Promise<ApiResponse> {
    const response = await this.client.get('/admin/dashboard', { params });
    return response.data;
  }

  async getUsers(params?: any): Promise<ApiResponse> {
    const response = await this.client.get('/admin/users', { params });
    return response.data;
  }

  async updateUser(id: string, data: any): Promise<ApiResponse> {
    const response = await this.client.put(`/admin/users/${id}`, data);
    return response.data;
  }

  async getAdminPayments(params?: any): Promise<ApiResponse> {
    const response = await this.client.get('/admin/payments', { params });
    return response.data;
  }

  // Pricing tiers
  async getPricingTiers(): Promise<ApiResponse> {
    const response = await this.client.get('/admin/pricing-tiers');
    return response.data;
  }

  async getPublicConfig(): Promise<ApiResponse> {
    const response = await this.client.get('/config/public');
    return response.data;
  }

  async getCreditPackages(): Promise<ApiResponse> {
    const response = await this.client.get('/config/credit-packages');
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Generic HTTP methods for direct use
  async get(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    return await this.client.get(url, config);
  }

  async post(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    return await this.client.post(url, data, config);
  }

  async put(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    return await this.client.put(url, data, config);
  }

  async delete(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    return await this.client.delete(url, config);
  }
}

export const apiClient = new ApiClient();
export default apiClient;
