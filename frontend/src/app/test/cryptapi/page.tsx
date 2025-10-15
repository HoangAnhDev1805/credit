'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { toast } from 'react-hot-toast';
import CryptAPIButton from '@/components/CryptAPIButton';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  data?: any;
}

export default function CryptAPITestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [supportedCoins, setSupportedCoins] = useState<any>({});
  const [selectedCoin, setSelectedCoin] = useState('btc');
  const [testAmount, setTestAmount] = useState(10);

  // Kiểm tra quyền admin
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const response = await apiClient.get('/auth/me');
        if (response.data.data.role !== 'admin') {
          toast.error('Chỉ admin mới có thể truy cập trang này');
          window.location.href = '/dashboard';
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        toast.error('Vui lòng đăng nhập');
        window.location.href = '/auth/login';
      }
    };

    checkAdminAccess();
  }, []);

  // Lấy danh sách coins hỗ trợ
  useEffect(() => {
    const fetchSupportedCoins = async () => {
      try {
        const response = await apiClient.get('/payments/cryptapi/coins');
        if (response.data.success) {
          setSupportedCoins(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch supported coins:', error);
      }
    };

    fetchSupportedCoins();
  }, []);

  const addTestResult = (name: string, status: 'pending' | 'success' | 'error', message?: string, data?: any) => {
    setTestResults(prev => {
      const existing = prev.find(r => r.name === name);
      if (existing) {
        return prev.map(r => r.name === name ? { ...r, status, message, data } : r);
      }
      return [...prev, { name, status, message, data }];
    });
  };

  // Test connection
  const runConnectionTest = async () => {
    addTestResult('Connection Test', 'pending');
    try {
      const response = await apiClient.get('/payments/cryptapi/test');
      if (response.data.success) {
        addTestResult('Connection Test', 'success', 'CryptAPI connection OK', response.data.data);
        toast.success('CryptAPI connection successful');
      } else {
        addTestResult('Connection Test', 'error', response.data.message || 'Connection failed');
        toast.error('Connection test failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Connection test failed';
      addTestResult('Connection Test', 'error', errorMessage);
      toast.error(errorMessage);
    }
  };

  // Test supported coins
  const runCoinsTest = async () => {
    addTestResult('Supported Coins Test', 'pending');
    try {
      const response = await apiClient.get('/payments/cryptapi/coins');
      if (response.data.success) {
        const coinCount = Object.keys(response.data.data).length;
        addTestResult('Supported Coins Test', 'success', `Found ${coinCount} supported coins`, response.data.data);
        toast.success(`Found ${coinCount} supported coins`);
      } else {
        addTestResult('Supported Coins Test', 'error', 'Failed to fetch coins');
        toast.error('Failed to fetch supported coins');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch coins';
      addTestResult('Supported Coins Test', 'error', errorMessage);
      toast.error(errorMessage);
    }
  };

  // Test estimate
  const runEstimateTest = async () => {
    addTestResult('Fee Estimate Test', 'pending');
    try {
      const response = await apiClient.get(`/payments/cryptapi/estimate?coin=${selectedCoin}&addresses=1&priority=default`);
      if (response.data.success) {
        addTestResult('Fee Estimate Test', 'success', 'Fee estimate retrieved', response.data.data);
        toast.success('Fee estimate successful');
      } else {
        addTestResult('Fee Estimate Test', 'error', 'Failed to get estimate');
        toast.error('Failed to get fee estimate');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to get estimate';
      addTestResult('Fee Estimate Test', 'error', errorMessage);
      toast.error(errorMessage);
    }
  };

  // Test convert
  const runConvertTest = async () => {
    addTestResult('Currency Convert Test', 'pending');
    try {
      const response = await apiClient.get(`/payments/cryptapi/convert?coin=${selectedCoin}&value=100&from=USD`);
      if (response.data.success) {
        addTestResult('Currency Convert Test', 'success', '100 USD converted successfully', response.data.data);
        toast.success('Currency conversion successful');
      } else {
        addTestResult('Currency Convert Test', 'error', 'Failed to convert currency');
        toast.error('Failed to convert currency');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to convert currency';
      addTestResult('Currency Convert Test', 'error', errorMessage);
      toast.error(errorMessage);
    }
  };

  // Test create address
  const runCreateAddressTest = async () => {
    addTestResult('Create Address Test', 'pending');
    try {
      const response = await apiClient.post('/payments/cryptapi/create-address', {
        amount: testAmount,
        coin: selectedCoin,
        confirmations: 1
      });
      
      if (response.data.success) {
        addTestResult('Create Address Test', 'success', 'Payment address created successfully', response.data.data);
        toast.success('Payment address created');
      } else {
        addTestResult('Create Address Test', 'error', response.data.message || 'Failed to create address');
        toast.error('Failed to create payment address');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to create address';
      addTestResult('Create Address Test', 'error', errorMessage);
      toast.error(errorMessage);
    }
  };

  // Run all tests
  const runFullTest = async () => {
    setIsRunningTests(true);
    setTestResults([]);
    
    try {
      await runConnectionTest();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await runCoinsTest();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await runEstimateTest();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await runConvertTest();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await runCreateAddressTest();
      
      toast.success('All tests completed');
    } catch (error) {
      toast.error('Test suite failed');
    } finally {
      setIsRunningTests(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '⚪';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔧 CryptAPI Integration Test
          </h1>
          <p className="text-gray-600">
            Trang test tích hợp CryptAPI - Chỉ dành cho Admin
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Test Controls */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Test Coin
                  </label>
                  <select
                    value={selectedCoin}
                    onChange={(e) => setSelectedCoin(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="btc">Bitcoin (BTC)</option>
                    <option value="eth">Ethereum (ETH)</option>
                    <option value="trc20/usdt">USDT (TRC20)</option>
                    <option value="erc20/usdt">USDT (ERC20)</option>
                    <option value="sol/sol">Solana (SOL)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Test Amount (USD)
                  </label>
                  <input
                    type="number"
                    value={testAmount}
                    onChange={(e) => setTestAmount(Number(e.target.value))}
                    min="1"
                    max="1000"
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Test Actions</h2>
              
              <div className="space-y-3">
                <button
                  onClick={runConnectionTest}
                  disabled={isRunningTests}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Test Connection
                </button>
                
                <button
                  onClick={runCoinsTest}
                  disabled={isRunningTests}
                  className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Test Supported Coins
                </button>
                
                <button
                  onClick={runEstimateTest}
                  disabled={isRunningTests}
                  className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  Test Fee Estimate
                </button>
                
                <button
                  onClick={runConvertTest}
                  disabled={isRunningTests}
                  className="w-full py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  Test Currency Convert
                </button>
                
                <button
                  onClick={runCreateAddressTest}
                  disabled={isRunningTests}
                  className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  Test Create Address
                </button>
                
                <hr className="my-4" />
                
                <button
                  onClick={runFullTest}
                  disabled={isRunningTests}
                  className="w-full py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold"
                >
                  {isRunningTests ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Running Tests...
                    </div>
                  ) : (
                    'Run Full Test Suite'
                  )}
                </button>
              </div>
            </div>

            {/* Live UI Test */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Live UI Test</h2>
              <p className="text-gray-600 mb-4">
                Test CryptAPI component với UI thật
              </p>
              
              <CryptAPIButton
                amount={testAmount}
                onSuccess={(data) => {
                  toast.success('Payment successful!');
                  console.log('Payment success:', data);
                }}
                onError={(error) => {
                  toast.error(`Payment error: ${error}`);
                  console.error('Payment error:', error);
                }}
              />
            </div>
          </div>

          {/* Test Results */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            
            {testResults.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Chưa có kết quả test. Chạy test để xem kết quả.
              </p>
            ) : (
              <div className="space-y-4">
                {testResults.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{result.name}</h3>
                      <span className={`text-lg ${getStatusColor(result.status)}`}>
                        {getStatusIcon(result.status)}
                      </span>
                    </div>
                    
                    {result.message && (
                      <p className={`text-sm ${getStatusColor(result.status)} mb-2`}>
                        {result.message}
                      </p>
                    )}
                    
                    {result.data && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                          View Data
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
