'use client'

import React, { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SharedTable, TableColumn, TableAction } from '@/components/shared/Table'
import { SharedPagination, usePagination } from '@/components/shared/Pagination'
import { FormModal, ConfirmModal, SharedModal } from '@/components/shared/Modal'
import { FeatureCard, CardGrid } from '@/components/shared/Cards'
import { SharedForm } from '@/components/shared/Form'
import { useToast } from '@/components/shared/Toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiClient } from '@/lib/api'
import {
  Eye,
  Check,
  X,
  Trash2,
  Plus,
  Edit,
  CreditCard,
  Wallet,
  Building,
  QrCode,
  Image as ImageIcon
} from 'lucide-react'

interface PaymentMethod {
  _id: string
  name: string
  type: string
  bankName?: string
  accountNumber?: string
  accountName?: string
  qrCode?: string
  instructions?: string
  isActive: boolean
  isDefault: boolean
  totalTransactions: number
  totalAmount: number
  createdAt: string
}

interface PaymentRequest {
  _id: string
  userId: {
    _id: string
    username: string
    email: string
  }
  amount: number
  paymentMethodId?: { name: string; type: string; bankName?: string }
  paymentMethod?: { name: string; type: string; bankName?: string }
  status: 'pending' | 'approved' | 'rejected'
  proofImage?: string
  notes?: string
  adminNotes?: string
  createdAt: string
  processedAt?: string
}

export default function PaymentManagement() {
  const [activeTab, setActiveTab] = useState('methods')

  // Payment Methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [methodsLoading, setMethodsLoading] = useState(true)

  // Payment Requests
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [totalRequests, setTotalRequests] = useState(0)

  // Pagination for requests
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage
  } = usePagination(totalRequests, 10)

  // Modals
  const [methodModalOpen, setMethodModalOpen] = useState(false)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const { success, error: showError } = useToast()

  useEffect(() => {
    fetchPaymentMethods()
  }, [])

  useEffect(() => {
    if (activeTab === 'requests') {
      fetchPaymentRequests()
    }
  }, [activeTab, currentPage, itemsPerPage])

  const fetchPaymentMethods = async () => {
    try {
      setMethodsLoading(true)
      const response = await apiClient.get('/admin/payment-methods')
      setPaymentMethods(response.data.data.paymentMethods)
    } catch (error: any) {
      console.error('Failed to fetch payment methods:', error)
      showError('Lỗi tải dữ liệu', 'Không thể tải danh sách phương thức thanh toán')
    } finally {
      setMethodsLoading(false)
    }
  }

  const fetchPaymentRequests = async () => {
    try {
      setRequestsLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      })

      const response = await apiClient.get(`/admin/payment-requests?${params}`)
      setPaymentRequests(response.data.data.requests)
      setTotalRequests(response.data.data.pagination.total)
    } catch (error: any) {
      console.error('Failed to fetch payment requests:', error)
      showError('Lỗi tải dữ liệu', 'Không thể tải danh sách yêu cầu thanh toán')
    } finally {
      setRequestsLoading(false)
    }
  }

  // Payment Method handlers
  const handleCreateMethod = () => {
    setSelectedMethod(null)
    setIsEditing(false)
    setMethodModalOpen(true)
  }

  const handleEditMethod = (method: PaymentMethod) => {
    setSelectedMethod(method)
    setIsEditing(true)
    setMethodModalOpen(true)
  }

  const handleDeleteMethod = (method: PaymentMethod) => {
    setSelectedMethod(method)
    setDeleteModalOpen(true)
  }

  const handleSaveMethod = async (formData: any) => {
    try {
      setSaving(true)
      if (isEditing && selectedMethod) {
        await apiClient.put(`/admin/payment-methods/${selectedMethod._id}`, formData)
        success('Thành công', 'Cập nhật phương thức thanh toán thành công')
      } else {
        await apiClient.post('/admin/payment-methods', formData)
        success('Thành công', 'Tạo phương thức thanh toán thành công')
      }
      setMethodModalOpen(false)
      fetchPaymentMethods()
    } catch (error: any) {
      console.error('Failed to save payment method:', error)
      showError('Lỗi lưu', error.response?.data?.message || 'Không thể lưu phương thức thanh toán')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteMethodConfirm = async () => {
    if (!selectedMethod) return

    try {
      await apiClient.delete(`/admin/payment-methods/${selectedMethod._id}`)
      success('Thành công', 'Xóa phương thức thanh toán thành công')
      setDeleteModalOpen(false)
      fetchPaymentMethods()
    } catch (error: any) {
      console.error('Failed to delete payment method:', error)
      showError('Lỗi xóa', error.response?.data?.message || 'Không thể xóa phương thức thanh toán')
    }
  }

  // Payment Request handlers
  const handleViewRequest = (request: PaymentRequest) => {
    setSelectedRequest(request)
    setRequestModalOpen(true)
  }

  const handleUpdateRequestStatus = async (requestId: string, status: string, adminNotes?: string) => {
    try {
      await apiClient.put(`/admin/payment-requests/${requestId}`, {
        status,
        adminNotes
      })
      success('Thành công', `${status === 'approved' ? 'Duyệt' : 'Từ chối'} yêu cầu thành công`)
      setRequestModalOpen(false)
      fetchPaymentRequests()
    } catch (error: any) {
      console.error('Failed to update payment request:', error)
      showError('Lỗi cập nhật', error.response?.data?.message || 'Không thể cập nhật yêu cầu')
    }
  }

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'bank_transfer':
        return Building
      case 'e_wallet':
        return Wallet
      case 'crypto':
        return CreditCard
      default:
        return CreditCard
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Chờ duyệt</Badge>
      case 'approved':
        return <Badge variant="default">Đã duyệt</Badge>
      case 'rejected':
        return <Badge variant="destructive">Từ chối</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const requestColumns: TableColumn[] = [
    {
      key: '_id',
      label: 'ID',
      width: '100px',
      render: (value) => (
        <span className="font-mono text-xs">{value.slice(-8)}</span>
      )
    },
    {
      key: 'userId',
      label: 'Người dùng',
      render: (value) => (
        <div>
          <div className="font-medium">{value.username}</div>
          <div className="text-xs text-muted-foreground">{value.email}</div>
        </div>
      )
    },
    {
      key: 'amount',
      label: 'Số tiền',
      align: 'right',
      render: (value) => (
        <span className="font-medium">{value.toLocaleString()} VND</span>
      )
    },
    {
      key: 'paymentMethodId',
      label: 'Phương thức',
      render: (value) => value?.name || 'N/A'
    },
    {
      key: 'status',
      label: 'Trạng thái',
      align: 'center',
      render: (value) => getStatusBadge(value)
    },
    {
      key: 'createdAt',
      label: 'Ngày gửi',
      render: (value) => new Date(value).toLocaleDateString('vi-VN')
    }
  ]

  const requestActions: TableAction[] = [
    {
      label: 'Xem chi tiết',
      icon: <Eye className="h-4 w-4" />,
      onClick: handleViewRequest
    },
    {
      label: 'Duyệt',
      icon: <Check className="h-4 w-4" />,
      onClick: (request) => handleUpdateRequestStatus(request._id, 'approved'),
      show: (request) => request.status === 'pending'
    },
    {
      label: 'Từ chối',
      icon: <X className="h-4 w-4" />,
      onClick: (request) => handleUpdateRequestStatus(request._id, 'rejected'),
      variant: 'destructive',
      show: (request) => request.status === 'pending'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Quản lý Thanh toán</h1>
        <p className="text-muted-foreground">Quản lý phương thức và yêu cầu thanh toán</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="methods">Phương thức thanh toán</TabsTrigger>
          <TabsTrigger value="requests">Yêu cầu thanh toán</TabsTrigger>
        </TabsList>

        {/* Payment Methods Tab */}
        <TabsContent value="methods" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Phương thức thanh toán</h2>
            <Button onClick={handleCreateMethod}>
              <Plus className="h-4 w-4 mr-2" />
              Thêm phương thức
            </Button>
          </div>

          {methodsLoading ? (
            <CardGrid columns={3}>
              {[...Array(6)].map((_, i) => (
                <FeatureCard
                  key={i}
                  title=""
                  description=""
                  loading={true}
                />
              ))}
            </CardGrid>
          ) : (
            <CardGrid columns={3}>
              {paymentMethods.map((method) => (
                <FeatureCard
                  key={method._id}
                  title={method.name}
                  description={method.instructions || 'Không có hướng dẫn'}
                  icon={getMethodIcon(method.type)}
                  badge={{
                    text: method.isActive ? 'Hoạt động' : 'Tạm dừng',
                    variant: method.isActive ? 'default' : 'secondary'
                  }}
                  action={{
                    label: 'Quản lý',
                    onClick: () => handleEditMethod(method)
                  }}
                />
              ))}
            </CardGrid>
          )}
        </TabsContent>

        {/* Payment Requests Tab */}
        <TabsContent value="requests" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Yêu cầu thanh toán</h2>
            <div className="flex gap-2">
              <Badge variant="secondary">
                Chờ duyệt: {paymentRequests.filter(r => r.status === 'pending').length}
              </Badge>
              <Badge variant="default">
                Đã duyệt: {paymentRequests.filter(r => r.status === 'approved').length}
              </Badge>
            </div>
          </div>

          <SharedTable
            data={paymentRequests}
            columns={requestColumns}
            actions={requestActions}
            loading={requestsLoading}
            emptyMessage="Không có yêu cầu thanh toán nào"
          />

          <SharedPagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalRequests / itemsPerPage)}
            totalItems={totalRequests}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </TabsContent>
      </Tabs>

      {/* Payment Method Modal */}
      <SharedModal
        isOpen={methodModalOpen}
        onClose={() => setMethodModalOpen(false)}
        title={isEditing ? 'Chỉnh sửa phương thức thanh toán' : 'Thêm phương thức thanh toán'}
        size="lg"
      >
        <SharedForm
          fields={[
            {
              name: 'name',
              label: 'Tên phương thức',
              type: 'text',
              required: true,
              placeholder: 'VD: Vietcombank'
            },
            {
              name: 'type',
              label: 'Loại',
              type: 'select',
              required: true,
              options: [
                { value: 'bank_transfer', label: 'Chuyển khoản ngân hàng' },
                { value: 'e_wallet', label: 'Ví điện tử' },
                { value: 'crypto', label: 'Tiền điện tử' }
              ]
            },
            {
              name: 'bankName',
              label: 'Tên ngân hàng',
              type: 'text',
              placeholder: 'VD: Vietcombank'
            },
            {
              name: 'accountNumber',
              label: 'Số tài khoản',
              type: 'text',
              placeholder: 'VD: 1234567890'
            },
            {
              name: 'accountName',
              label: 'Tên chủ tài khoản',
              type: 'text',
              placeholder: 'VD: NGUYEN VAN A'
            },
            {
              name: 'instructions',
              label: 'Hướng dẫn',
              type: 'textarea',
              placeholder: 'Chi tiết hướng dẫn thanh toán...'
            },
            {
              name: 'qrCode',
              label: 'QR Code URL',
              type: 'text',
              placeholder: 'https://example.com/qr-code.png'
            }
          ]}
          initialData={selectedMethod || {}}
          onSubmit={handleSaveMethod}
          onCancel={() => setMethodModalOpen(false)}
          submitText={isEditing ? 'Cập nhật' : 'Tạo mới'}
          loading={saving}
          columns={2}
        />
      </SharedModal>
        {isEditing && selectedMethod && (
          <div className="mt-4 flex justify-between">
            <Button
              variant="destructive"
              onClick={() => { setMethodModalOpen(false); setDeleteModalOpen(true) }}
            >
              Xóa phương thức
            </Button>
          </div>
        )}


      {/* Payment Request Detail Modal */}
      <SharedModal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title="Chi tiết yêu cầu thanh toán"
        size="lg"
      >
        {selectedRequest && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Người dùng:</span>
                <div className="font-medium">{selectedRequest.userId.username}</div>
                <div className="text-sm text-muted-foreground">{selectedRequest.userId.email}</div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Số tiền:</span>
                <div className="font-medium text-lg">{selectedRequest.amount.toLocaleString()} VND</div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Phương thức:</span>
                <div className="font-medium">{selectedRequest.paymentMethodId?.name || selectedRequest.paymentMethod?.name || 'N/A'}</div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Trạng thái:</span>
                <div>{getStatusBadge(selectedRequest.status)}</div>
              </div>
            </div>

            {selectedRequest.notes && (
              <div>
                <span className="text-sm text-muted-foreground">Ghi chú từ người dùng:</span>
                <div className="mt-1 p-3 bg-muted rounded-lg">{selectedRequest.notes}</div>
              </div>
            )}

            {selectedRequest.proofImage && (
              <div>
                <span className="text-sm text-muted-foreground">Ảnh chứng từ:</span>
                <div className="mt-1">
                  <img
                    src={selectedRequest.proofImage}
                    alt="Proof"
                    className="max-w-full h-auto rounded-lg border"
                  />
                </div>
              </div>
            )}

            {selectedRequest.status === 'pending' && (
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => handleUpdateRequestStatus(selectedRequest._id, 'approved')}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Duyệt yêu cầu
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleUpdateRequestStatus(selectedRequest._id, 'rejected')}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Từ chối
                </Button>
              </div>
            )}
          </div>
        )}
      </SharedModal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteMethodConfirm}
        title="Xác nhận xóa phương thức thanh toán"
        description={`Bạn có chắc chắn muốn xóa phương thức "${selectedMethod?.name}"?`}
        confirmText="Xóa"
        variant="destructive"
      />
    </div>
  )
}
