'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onItemsPerPageChange?: (itemsPerPage: number) => void
  showItemsPerPage?: boolean
  showInfo?: boolean
  showFirstLast?: boolean
  itemsPerPageOptions?: number[]
  className?: string
  disabled?: boolean
}

export function SharedPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showItemsPerPage = true,
  showInfo = true,
  showFirstLast = true,
  itemsPerPageOptions = [10, 20, 50, 100],
  className = '',
  disabled = false
}: PaginationProps) {
  
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  // Generate page numbers to show
  const getPageNumbers = () => {
    const delta = 2 // Number of pages to show on each side of current page
    const range = []
    const rangeWithDots = []

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i)
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  }

  const pageNumbers = getPageNumbers()

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && !disabled) {
      onPageChange(page)
    }
  }

  const handleItemsPerPageChange = (value: string) => {
    if (onItemsPerPageChange && !disabled) {
      onItemsPerPageChange(parseInt(value))
    }
  }

  if (totalPages <= 1 && !showItemsPerPage && !showInfo) {
    return null
  }

  return (
    <div className={cn(
      "flex flex-col sm:flex-row items-center justify-between gap-4 px-2",
      className
    )}>
      {/* Items per page selector */}
      {showItemsPerPage && onItemsPerPageChange && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Show</span>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={handleItemsPerPageChange}
            disabled={disabled}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itemsPerPageOptions.map((option) => (
                <SelectItem key={option} value={option.toString()}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">per page</span>
        </div>
      )}

      {/* Page info */}
      {showInfo && totalItems > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {startItem} to {endItem} of {totalItems} results
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center space-x-1">
          {/* First page */}
          {showFirstLast && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1 || disabled}
              className="h-8 w-8 p-0"
            >
              <ChevronsLeft className="h-4 w-4" />
              <span className="sr-only">First page</span>
            </Button>
          )}

          {/* Previous page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || disabled}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>

          {/* Page numbers */}
          <div className="flex items-center space-x-1">
            {pageNumbers.map((page, index) => {
              if (page === '...') {
                return (
                  <span
                    key={`dots-${index}`}
                    className="px-2 py-1 text-sm text-muted-foreground"
                  >
                    ...
                  </span>
                )
              }

              const pageNumber = page as number
              const isCurrentPage = pageNumber === currentPage

              return (
                <Button
                  key={pageNumber}
                  variant={isCurrentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(pageNumber)}
                  disabled={disabled}
                  className={cn(
                    "h-8 w-8 p-0",
                    isCurrentPage && "pointer-events-none"
                  )}
                >
                  {pageNumber}
                </Button>
              )
            })}
          </div>

          {/* Next page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || disabled}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>

          {/* Last page */}
          {showFirstLast && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages || disabled}
              className="h-8 w-8 p-0"
            >
              <ChevronsRight className="h-4 w-4" />
              <span className="sr-only">Last page</span>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// Hook for pagination logic
export function usePagination(
  totalItems: number,
  initialItemsPerPage: number = 10
) {
  const [currentPage, setCurrentPage] = React.useState(1)
  const [itemsPerPage, setItemsPerPage] = React.useState(initialItemsPerPage)

  const totalPages = Math.ceil(totalItems / itemsPerPage)

  // Reset to first page when items per page changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage])

  // Reset to last page if current page exceeds total pages
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage

  return {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    startIndex,
    endIndex,
    startItem: startIndex + 1,
    endItem: Math.min(endIndex, totalItems)
  }
}

// Simple pagination component for basic use cases
export function SimplePagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center space-x-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || disabled}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      
      <span className="text-sm text-muted-foreground px-4">
        Page {currentPage} of {totalPages}
      </span>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || disabled}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
