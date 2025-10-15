'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  ChevronUp, 
  ChevronDown, 
  Search, 
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface TableColumn {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, row: any) => React.ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
}

export interface TableAction {
  label: string
  icon: React.ReactNode
  onClick: (row: any) => void
  variant?: 'default' | 'destructive' | 'outline'
  show?: (row: any) => boolean
}

export interface SharedTableProps {
  data: any[]
  columns: TableColumn[]
  actions?: TableAction[]
  searchable?: boolean
  searchPlaceholder?: string
  filterable?: boolean
  sortable?: boolean
  loading?: boolean
  emptyMessage?: string
  className?: string
  onRowClick?: (row: any) => void
}

export function SharedTable({
  data,
  columns,
  actions = [],
  searchable = true,
  searchPlaceholder = "Search...",
  filterable = true,
  sortable = true,
  loading = false,
  emptyMessage = "No data available",
  className = "",
  onRowClick
}: SharedTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})

  // Filter and search data
  const filteredData = useMemo(() => {
    let filtered = data

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(row =>
        columns.some(column => {
          const value = row[column.key]
          return value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        })
      )
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter(row =>
          row[key]?.toString().toLowerCase().includes(value.toLowerCase())
        )
      }
    })

    return filtered
  }, [data, searchTerm, filters, columns])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [filteredData, sortConfig])

  const handleSort = (key: string) => {
    if (!sortable) return

    setSortConfig(current => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        }
      }
      return { key, direction: 'asc' }
    })
  }

  const handleFilter = (key: string, value: string) => {
    setFilters(current => ({
      ...current,
      [key]: value
    }))
  }

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ChevronUp className="h-4 w-4 opacity-0" />
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />
  }

  if (loading) {
    return (
      <div className="w-full">
        <div className="animate-pulse">
          <div className="h-10 bg-muted rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* Search and Filters */}
      {(searchable || filterable) && (
        <div className="flex flex-col sm:flex-row gap-4">
          {searchable && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
          
          {filterable && (
            <div className="flex gap-2">
              {columns.filter(col => col.filterable).map(column => (
                <div key={column.key} className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Filter ${column.label}`}
                    value={filters[column.key] || ''}
                    onChange={(e) => handleFilter(column.key, e.target.value)}
                    className="pl-10 w-40"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 text-left text-sm font-medium text-muted-foreground ${
                      column.width ? `w-${column.width}` : ''
                    } ${
                      column.align === 'center' ? 'text-center' : 
                      column.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {column.sortable !== false && sortable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => handleSort(column.key)}
                        >
                          {getSortIcon(column.key)}
                        </Button>
                      )}
                    </div>
                  </th>
                ))}
                {actions.length > 0 && (
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-20">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedData.length === 0 ? (
                <tr>
                  <td 
                    colSpan={columns.length + (actions.length > 0 ? 1 : 0)}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sortedData.map((row, index) => (
                  <tr
                    key={index}
                    className={`hover:bg-muted/50 transition-colors ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-3 text-sm ${
                          column.align === 'center' ? 'text-center' : 
                          column.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {column.render 
                          ? column.render(row[column.key], row)
                          : row[column.key]
                        }
                      </td>
                    ))}
                    {actions.length > 0 && (
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {actions.map((action, actionIndex) => {
                              if (action.show && !action.show(row)) return null
                              
                              return (
                                <DropdownMenuItem
                                  key={actionIndex}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    action.onClick(row)
                                  }}
                                  className={
                                    action.variant === 'destructive' 
                                      ? 'text-destructive focus:text-destructive' 
                                      : ''
                                  }
                                >
                                  {action.icon}
                                  <span className="ml-2">{action.label}</span>
                                </DropdownMenuItem>
                              )
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results info */}
      {sortedData.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {sortedData.length} of {data.length} results
        </div>
      )}
    </div>
  )
}
