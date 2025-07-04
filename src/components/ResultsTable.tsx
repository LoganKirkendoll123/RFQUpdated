import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RFQRow, Quote } from '../types';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface ResultsTableProps {
  rfqs: RFQRow[];
  quotes: { [index: number]: Quote[] };
  onQuoteSelect?: (quote: Quote, rfqIndex: number) => void;
  selectedQuotes?: { [rfqIndex: number]: Quote };
}

type SortField = 'carrier' | 'total' | 'transitDays' | 'serviceLevel';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export function ResultsTable({ rfqs, quotes, onQuoteSelect, selectedQuotes }: ResultsTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'total', direction: 'asc' });
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Memoized sorted and filtered data
  const sortedData = useMemo(() => {
    const data: Array<{
      rfqIndex: number;
      rfq: RFQRow;
      quotes: Quote[];
      bestQuote?: Quote;
    }> = [];

    rfqs.forEach((rfq, index) => {
      const rfqQuotes = quotes[index] || [];
      const bestQuote = rfqQuotes.length > 0 
        ? rfqQuotes.reduce((best, current) => {
            const bestTotal = best.rateQuoteDetail?.total || best.premiumsAndDiscounts || 0;
            const currentTotal = current.rateQuoteDetail?.total || current.premiumsAndDiscounts || 0;
            return currentTotal < bestTotal ? current : best;
          })
        : undefined;

      data.push({
        rfqIndex: index,
        rfq,
        quotes: rfqQuotes,
        bestQuote
      });
    });

    // Sort the data
    return data.sort((a, b) => {
      const aQuote = a.bestQuote;
      const bQuote = b.bestQuote;

      if (!aQuote && !bQuote) return 0;
      if (!aQuote) return 1;
      if (!bQuote) return -1;

      let aValue: any;
      let bValue: any;

      switch (sortConfig.field) {
        case 'carrier':
          aValue = aQuote.carrier?.name || '';
          bValue = bQuote.carrier?.name || '';
          break;
        case 'total':
          aValue = aQuote.rateQuoteDetail?.total || aQuote.premiumsAndDiscounts || 0;
          bValue = bQuote.rateQuoteDetail?.total || bQuote.premiumsAndDiscounts || 0;
          break;
        case 'transitDays':
          aValue = aQuote.transitDays || 0;
          bValue = bQuote.transitDays || 0;
          break;
        case 'serviceLevel':
          aValue = aQuote.serviceLevel?.name || '';
          bValue = bQuote.serviceLevel?.name || '';
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string') {
        const result = aValue.localeCompare(bValue);
        return sortConfig.direction === 'asc' ? result : -result;
      } else {
        const result = aValue - bValue;
        return sortConfig.direction === 'asc' ? result : -result;
      }
    });
  }, [rfqs, quotes, sortConfig]);

  const handleSort = useCallback((field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const toggleRowExpansion = useCallback((index: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 text-left font-medium text-gray-900 hover:text-blue-600"
    >
      <span>{children}</span>
      {sortConfig.field === field && (
        sortConfig.direction === 'asc' 
          ? <ChevronUpIcon className="w-4 h-4" />
          : <ChevronDownIcon className="w-4 h-4" />
      )}
    </button>
  );

  if (sortedData.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No RFQ data to display</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Route
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Details
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <SortButton field="carrier">Best Carrier</SortButton>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <SortButton field="total">Best Rate</SortButton>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <SortButton field="transitDays">Transit</SortButton>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Quotes
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedData.map(({ rfqIndex, rfq, quotes: rfqQuotes, bestQuote }) => (
            <React.Fragment key={rfqIndex}>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {rfq.fromZip} → {rfq.toZip}
                  </div>
                  <div className="text-sm text-gray-500">
                    {rfq.fromDate}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {rfq.pallets} pallets, {rfq.grossWeight} lbs
                  </div>
                  {rfq.temperature && (
                    <div className="text-sm text-blue-600">
                      {rfq.temperature}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {bestQuote ? (
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {bestQuote.carrier?.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {bestQuote.serviceLevel?.name || 'Standard'}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">No quotes</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {bestQuote ? (
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(bestQuote.rateQuoteDetail?.total || bestQuote.premiumsAndDiscounts || 0)}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {bestQuote?.transitDays ? (
                    <span className="text-sm text-gray-900">
                      {bestQuote.transitDays} days
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {rfqQuotes.length} quotes
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {rfqQuotes.length > 0 && (
                    <button
                      onClick={() => toggleRowExpansion(rfqIndex)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      {expandedRows.has(rfqIndex) ? 'Hide' : 'View'} Quotes
                    </button>
                  )}
                </td>
              </tr>
              
              {expandedRows.has(rfqIndex) && rfqQuotes.length > 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-4 bg-gray-50">
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">All Quotes for this RFQ:</h4>
                      <div className="grid gap-3">
                        {rfqQuotes
                          .sort((a, b) => {
                            const aTotal = a.rateQuoteDetail?.total || a.premiumsAndDiscounts || 0;
                            const bTotal = b.rateQuoteDetail?.total || b.premiumsAndDiscounts || 0;
                            return aTotal - bTotal;
                          })
                          .map((quote, quoteIndex) => (
                            <div
                              key={quoteIndex}
                              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                selectedQuotes?.[rfqIndex]?.quoteId === quote.quoteId
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}
                              onClick={() => onQuoteSelect?.(quote, rfqIndex)}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {quote.carrier?.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {quote.serviceLevel?.name || 'Standard Service'}
                                  </div>
                                  {quote.transitDays && (
                                    <div className="text-sm text-gray-500">
                                      Transit: {quote.transitDays} days
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-gray-900">
                                    {formatCurrency(quote.rateQuoteDetail?.total || quote.premiumsAndDiscounts || 0)}
                                  </div>
                                  {quote.rateQuoteDetail?.charges && quote.rateQuoteDetail.charges.length > 0 && (
                                    <div className="text-sm text-gray-500">
                                      {quote.rateQuoteDetail.charges.length} charges
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {quote.rateQuoteDetail?.charges && quote.rateQuoteDetail.charges.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="text-xs text-gray-500 mb-2">Charge Breakdown:</div>
                                  <div className="space-y-1">
                                    {quote.rateQuoteDetail.charges.slice(0, 3).map((charge, chargeIndex) => (
                                      <div key={chargeIndex} className="flex justify-between text-xs">
                                        <span className="text-gray-600">{charge.description}</span>
                                        <span className="text-gray-900">{formatCurrency(charge.amount)}</span>
                                      </div>
                                    ))}
                                    {quote.rateQuoteDetail.charges.length > 3 && (
                                      <div className="text-xs text-gray-500">
                                        +{quote.rateQuoteDetail.charges.length - 3} more charges
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}