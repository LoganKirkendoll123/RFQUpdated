import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Package, Clock, Thermometer, XCircle, CheckCircle, Truck } from 'lucide-react';
import { ProcessingResult } from '../types';
import { QuotePricingCard } from './QuotePricingCard';
import { formatCurrency } from '../utils/pricingCalculator';

interface RFQCardProps {
  result: ProcessingResult;
  onPriceUpdate: (quoteId: number, newPrice: number) => void;
}

export const RFQCard: React.FC<RFQCardProps> = ({ result, onPriceUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (result.status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (result.status) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const bestQuote = result.quotes.length > 0 
    ? result.quotes.reduce((best, current) => 
        (current as any).customerPrice < (best as any).customerPrice ? current : best
      )
    : null;

  return (
    <div className={`bg-white rounded-lg shadow-md border ${getStatusColor()} overflow-hidden`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                RFQ #{result.rowIndex + 1}
              </h3>
              <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                <div className="flex items-center space-x-1">
                  <MapPin className="h-4 w-4" />
                  <span>{result.originalData.fromZip} → {result.originalData.toZip}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Package className="h-4 w-4" />
                  <span>{result.originalData.pallets} pallets, {result.originalData.grossWeight.toLocaleString()} lbs</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{result.originalData.fromDate}</span>
                </div>
                {result.originalData.temperature && (
                  <div className="flex items-center space-x-1">
                    <Thermometer className="h-4 w-4" />
                    <span>{result.originalData.temperature}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            {bestQuote ? (
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency((bestQuote as any).customerPrice)}
                </div>
                <div className="text-sm text-gray-500">Best Price</div>
                <div className="text-sm text-green-600">
                  Profit: {formatCurrency((bestQuote as any).profit)}
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No quotes</div>
            )}
          </div>
        </div>

        {result.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2 text-red-700">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">{result.error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Quote Summary */}
      {result.quotes.length > 0 && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Truck className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">
                {result.quotes.length} quote{result.quotes.length !== 1 ? 's' : ''} received
              </span>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              <span>{isExpanded ? 'Hide' : 'Show'} Details</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Expanded Quote Details */}
      {isExpanded && result.quotes.length > 0 && (
        <div className="p-6 space-y-4">
          {result.quotes.map((quote) => (
            <QuotePricingCard
              key={quote.quoteId}
              quote={quote as any}
              onPriceUpdate={onPriceUpdate}
              isExpanded={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};