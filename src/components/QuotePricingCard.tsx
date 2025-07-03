import React, { useState } from 'react';
import { Edit3, Check, X, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import { QuoteWithPricing } from '../types';
import { formatCurrency, formatProfit, getTotalChargesByCategory, formatChargeDescription } from '../utils/pricingCalculator';

interface QuotePricingCardProps {
  quote: QuoteWithPricing;
  onPriceUpdate: (quoteId: number, newPrice: number) => void;
  isExpanded?: boolean;
}

export const QuotePricingCard: React.FC<QuotePricingCardProps> = ({ 
  quote, 
  onPriceUpdate,
  isExpanded = false 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editPrice, setEditPrice] = useState(quote.customerPrice.toString());
  const [showChargeDetails, setShowChargeDetails] = useState(false);

  const handleSavePrice = () => {
    const newPrice = parseFloat(editPrice);
    if (!isNaN(newPrice) && newPrice > 0) {
      onPriceUpdate(quote.quoteId, newPrice);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditPrice(quote.customerPrice.toString());
    setIsEditing(false);
  };

  const profitMargin = quote.carrierTotalRate > 0 ? (quote.profit / quote.carrierTotalRate) * 100 : 0;

  // Get all charges from Project44 response
  const allCharges = quote.chargeBreakdown.otherCharges || [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Truck className="h-5 w-5 text-blue-500" />
            <div>
              <span className="font-medium text-gray-900">{quote.carrier.name}</span>
              {quote.carrier.mcNumber && (
                <span className="text-sm text-gray-500 ml-2">MC: {quote.carrier.mcNumber}</span>
              )}
              {quote.serviceLevel && (
                <span className="text-sm text-blue-600 ml-2">
                  {quote.serviceLevel.description || quote.serviceLevel.code}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {quote.isCustomPrice && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                Custom Price
              </span>
            )}
            {quote.transitDays && (
              <span className="text-sm text-gray-500">
                {quote.transitDays} day{quote.transitDays !== 1 ? 's' : ''}
              </span>
            )}
            <div className="text-right">
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(quote.customerPrice)}
              </div>
              <div className="text-sm text-gray-500">Customer Price</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Details */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Carrier Rate Summary */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Project44 Charges</h4>
              <button
                onClick={() => setShowChargeDetails(!showChargeDetails)}
                className="text-blue-600 hover:text-blue-700 transition-colors"
              >
                {showChargeDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
            
            {showChargeDetails ? (
              <div className="space-y-2 text-sm">
                {allCharges.length > 0 ? (
                  <>
                    {allCharges.map((charge, index) => (
                      <div key={index} className="flex justify-between text-gray-600">
                        <span className="text-xs">{formatChargeDescription(charge)}</span>
                        <span className="text-xs font-medium">{formatCurrency(charge.amount)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Total:</span>
                      <span>{formatCurrency(quote.carrierTotalRate)}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500 text-xs">
                    No detailed charge breakdown available
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Number of Charges:</span>
                  <span className="font-medium">{allCharges.length}</span>
                </div>
                <div className="border-t pt-1 flex justify-between">
                  <span className="font-medium text-gray-700">Carrier Total:</span>
                  <span className="font-bold">{formatCurrency(quote.carrierTotalRate)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Pricing & Profit */}
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Your Pricing</h4>
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </div>
            
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter custom price"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleSavePrice}
                    className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
                  >
                    <Check className="h-3 w-3" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center space-x-1 px-3 py-1 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer Price:</span>
                  <span className="font-bold text-green-600">{formatCurrency(quote.customerPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Your Profit:</span>
                  <span className="font-bold text-green-600">{formatProfit(quote.profit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Margin:</span>
                  <span className="font-medium text-green-600">{profitMargin.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Shipment Details (if expanded) */}
        {isExpanded && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Shipment Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Ready By:</span>
                <div className="font-medium">{quote.readyByDate}</div>
              </div>
              <div>
                <span className="text-gray-500">Weight:</span>
                <div className="font-medium">{quote.weight.toLocaleString()} lbs</div>
              </div>
              {quote.temperature && (
                <div>
                  <span className="text-gray-500">Temperature:</span>
                  <div className="font-medium">{quote.temperature}</div>
                </div>
              )}
              <div>
                <span className="text-gray-500">Pallets:</span>
                <div className="font-medium">{quote.pallets}</div>
              </div>
              {quote.contractId && (
                <div>
                  <span className="text-gray-500">Contract:</span>
                  <div className="font-medium text-xs">{quote.contractId}</div>
                </div>
              )}
              {quote.laneType && (
                <div>
                  <span className="text-gray-500">Lane Type:</span>
                  <div className="font-medium">{quote.laneType}</div>
                </div>
              )}
              {quote.quoteExpirationDateTime && (
                <div>
                  <span className="text-gray-500">Expires:</span>
                  <div className="font-medium text-xs">
                    {new Date(quote.quoteExpirationDateTime).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};