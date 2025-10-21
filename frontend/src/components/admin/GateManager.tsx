'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Trash2, Plus } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'

interface Gate {
  _id?: string
  name: string
  typeCheck: number
  description: string
  isActive: boolean
  sortOrder: number
}

export function GateManager() {
  const [gates, setGates] = useState<Gate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { success, error: showError } = useToast()

  useEffect(() => {
    fetchGates()
  }, [])

  const fetchGates = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/gates/admin')
      setGates(response.data.data.gates || [])
    } catch (err: any) {
      console.error('Failed to load gates:', err)
      showError('Lỗi', 'Không thể tải danh sách gate')
    } finally {
      setLoading(false)
    }
  }

  const addGate = () => {
    const newGate: Gate = {
      name: '',
      typeCheck: gates.length + 1,
      description: '',
      isActive: true,
      sortOrder: gates.length
    }
    setGates([...gates, newGate])
  }

  const removeGate = async (index: number) => {
    const gate = gates[index]
    
    // Nếu gate đã tồn tại trong DB, gọi API xóa
    if (gate._id) {
      try {
        await apiClient.delete(`/gates/admin/${gate._id}`)
        success('Thành công', 'Đã xóa gate')
      } catch (err: any) {
        showError('Lỗi', err.response?.data?.message || 'Không thể xóa gate')
        return
      }
    }
    
    setGates(gates.filter((_, i) => i !== index))
  }

  const updateGate = (index: number, field: keyof Gate, value: any) => {
    const newGates = [...gates]
    newGates[index] = { ...newGates[index], [field]: value }
    setGates(newGates)
  }

  const saveGates = async () => {
    try {
      setSaving(true)
      
      // Validate
      for (const gate of gates) {
        if (!gate.name || !gate.typeCheck) {
          showError('Lỗi', 'Vui lòng điền đầy đủ tên và TypeCheck cho tất cả gate')
          return
        }
      }

      // Save or update each gate
      for (const gate of gates) {
        if (gate._id) {
          // Update existing
          await apiClient.put(`/gates/admin/${gate._id}`, {
            name: gate.name,
            typeCheck: gate.typeCheck,
            description: gate.description,
            isActive: gate.isActive,
            sortOrder: gate.sortOrder
          })
        } else {
          // Create new
          await apiClient.post('/gates/admin', {
            name: gate.name,
            typeCheck: gate.typeCheck,
            description: gate.description,
            isActive: gate.isActive,
            sortOrder: gate.sortOrder
          })
        }
      }

      success('Thành công', 'Đã lưu cấu hình gate')
      await fetchGates() // Refresh to get IDs
    } catch (err: any) {
      console.error('Failed to save gates:', err)
      showError('Lỗi', err.response?.data?.message || 'Không thể lưu cấu hình gate')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Quản lý các GATE để kiểm tra thẻ. Mỗi gate có một giá trị TypeCheck riêng.
        </p>
        <Button onClick={addGate} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Thêm Gate
        </Button>
      </div>

      <div className="space-y-3">
        {gates.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Chưa có gate nào. Nhấn &quot;Thêm Gate&quot; để bắt đầu.
            </CardContent>
          </Card>
        ) : (
          gates.map((gate, index) => (
            <Card key={index} className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* Tên Gate */}
                <div className="md:col-span-4">
                  <Label htmlFor={`gate-name-${index}`} className="text-xs">
                    Tên GATE
                  </Label>
                  <Input
                    id={`gate-name-${index}`}
                    value={gate.name}
                    onChange={(e) => updateGate(index, 'name', e.target.value)}
                    placeholder="VD: Check Live"
                    className="mt-1"
                  />
                </div>

                {/* TypeCheck */}
                <div className="md:col-span-2">
                  <Label htmlFor={`gate-type-${index}`} className="text-xs">
                    TypeCheck
                  </Label>
                  <Input
                    id={`gate-type-${index}`}
                    type="number"
                    value={gate.typeCheck}
                    onChange={(e) => updateGate(index, 'typeCheck', parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>

                {/* Mô tả */}
                <div className="md:col-span-4">
                  <Label htmlFor={`gate-desc-${index}`} className="text-xs">
                    Mô tả
                  </Label>
                  <Input
                    id={`gate-desc-${index}`}
                    value={gate.description}
                    onChange={(e) => updateGate(index, 'description', e.target.value)}
                    placeholder="Mô tả ngắn gọn"
                    className="mt-1"
                  />
                </div>

                {/* Active checkbox & Delete button */}
                <div className="md:col-span-2 flex items-end justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`gate-active-${index}`}
                      checked={gate.isActive}
                      onCheckedChange={(checked) => updateGate(index, 'isActive', checked)}
                    />
                    <Label
                      htmlFor={`gate-active-${index}`}
                      className="text-xs font-normal cursor-pointer"
                    >
                      Active
                    </Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeGate(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={saveGates} disabled={saving || gates.length === 0}>
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </Button>
      </div>
    </div>
  )
}
