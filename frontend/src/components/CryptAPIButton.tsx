'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface CryptAPIButtonProps {
  amount: number;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface PaymentData {
  paymentRequestId: string;
  orderId: string;
  coin: string;
  amount: number;
  address_in: string;
  minimum_transaction_coin: number;
  qr_code_base64?: string;
  payment_uri?: string;
  expiresAt: string;
  instructions: string;
}

interface SupportedCoins {
  [key: string]: {
    name: string;
    logo: string;
    minimum_transaction: number;
  };
}

const CryptAPIButton: React.FC<CryptAPIButtonProps> = ({
  amount,
  onSuccess,
  onError,
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [selectedCoin, setSelectedCoin] = useState('btc');
  const [supportedCoins, setSupportedCoins] = useState<SupportedCoins>({});
  const [showPayment, setShowPayment] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string>('pending');
  const [copied, setCopied] = useState(false);

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

  // Kiểm tra trạng thái đơn hàng
  const checkOrderStatus = async (orderId: string) => {
    try {
      const response = await apiClient.get(`/payments/cryptapi/status/${orderId}`);
      if (response.data.success) {
        const status = response.data.data.status;
        setOrderStatus(status);
        
        if (status === 'approved') {
          toast.success('Thanh toán thành công!');
          onSuccess?.(response.data.data);
          setShowPayment(false);
        }
      }
    } catch (error) {
      console.error('Failed to check order status:', error);
    }
  };

  // Tạo địa chỉ thanh toán
  const handleCreatePayment = async () => {
    if (!amount || amount <= 0) {
      toast.error('Số tiền không hợp lệ');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.post('/payments/cryptapi/create-address', {
        amount,
        coin: selectedCoin,
        confirmations: 1
      });

      if (response.data.success) {
        setPaymentData(response.data.data);
        setShowPayment(true);
        toast.success('Địa chỉ thanh toán đã được tạo');
        
        // Bắt đầu kiểm tra trạng thái định kỳ
        const interval = setInterval(() => {
          checkOrderStatus(response.data.data.orderId);
        }, 10000); // Kiểm tra mỗi 10 giây

        // Dọn dẹp interval sau 30 phút
        setTimeout(() => {
          clearInterval(interval);
        }, 30 * 60 * 1000);
      } else {
        toast.error(response.data.message || 'Không thể tạo địa chỉ thanh toán');
        onError?.(response.data.message || 'Payment creation failed');
      }
    } catch (error: any) {
      console.error('Create payment error:', error);
      const errorMessage = error.response?.data?.message || 'Lỗi tạo thanh toán';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Copy địa chỉ
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Đã copy địa chỉ');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Không thể copy');
    }
  };

  // Đóng modal thanh toán
  const closePayment = () => {
    setShowPayment(false);
    setPaymentData(null);
    setOrderStatus('pending');
  };

  if (showPayment && paymentData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Thanh toán {paymentData.coin.toUpperCase()}
              </h3>
              <button
                onClick={closePayment}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Trạng thái đơn hàng */}
            <div className="mb-4 p-3 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Trạng thái:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  orderStatus === 'approved' ? 'bg-green-100 text-green-800' :
                  orderStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {orderStatus === 'approved' ? 'Đã thanh toán' :
                   orderStatus === 'pending' ? 'Chờ thanh toán' : orderStatus}
                </span>
              </div>
            </div>

            {/* QR Code */}
            {paymentData.qr_code_base64 && (
              <div className="text-center mb-4">
                <img
                  src={`data:image/png;base64,${paymentData.qr_code_base64}`}
                  alt="QR Code"
                  className="mx-auto w-48 h-48 border rounded-lg"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Quét QR code để thanh toán
                </p>
              </div>
            )}

            {/* Thông tin thanh toán */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Địa chỉ nhận ({paymentData.coin.toUpperCase()})
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={paymentData.address_in}
                    readOnly
                    className="flex-1 p-2 border rounded text-sm bg-gray-50"
                  />
                  <button
                    onClick={() => copyToClipboard(paymentData.address_in)}
                    className={`px-3 py-2 rounded text-sm font-medium ${
                      copied ? 'bg-green-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {copied ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số tiền
                </label>
                <input
                  type="text"
                  value={`${paymentData.amount} USD`}
                  readOnly
                  className="w-full p-2 border rounded text-sm bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số tiền tối thiểu
                </label>
                <input
                  type="text"
                  value={`${paymentData.minimum_transaction_coin} ${paymentData.coin.toUpperCase()}`}
                  readOnly
                  className="w-full p-2 border rounded text-sm bg-gray-50"
                />
              </div>
            </div>

            {/* Hướng dẫn */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                {paymentData.instructions}
              </p>
            </div>

            {/* Thời gian hết hạn */}
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                Hết hạn: {new Date(paymentData.expiresAt).toLocaleString('vi-VN')}
              </p>
            </div>

            {/* Nút đóng */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={closePayment}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Chọn loại coin */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chọn loại tiền điện tử
        </label>
        <select
          value={selectedCoin}
          onChange={(e) => setSelectedCoin(e.target.value)}
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="btc">Bitcoin (BTC)</option>
          <option value="eth">Ethereum (ETH)</option>
          <option value="trc20/usdt">USDT (TRC20)</option>
          <option value="erc20/usdt">USDT (ERC20)</option>
          <option value="sol/sol">Solana (SOL)</option>
          <option value="polygon/pol">Polygon (POL)</option>
        </select>
      </div>

      {/* Nút tạo thanh toán */}
      <button
        onClick={handleCreatePayment}
        disabled={isLoading || !amount || amount <= 0}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          isLoading || !amount || amount <= 0
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Đang tạo địa chỉ...
          </div>
        ) : (
          `Thanh toán ${amount} USD bằng ${selectedCoin.toUpperCase()}`
        )}
      </button>
    </div>
  );
};

export default CryptAPIButton;
