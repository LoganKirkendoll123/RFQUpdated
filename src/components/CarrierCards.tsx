import React, { useState } from 'react';
import { 
  Truck, 
  Award, 
  Shield, 
  Clock, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp,
  Star,
  Package,
  MapPin,
  Calendar,
  Zap
} from 'lucide-react';
import { QuoteWithPricing } from '../types';
import { formatCurrency } from '../utils/pricingCalculator';
import { QuotePricingCard } from './QuotePricingCard';

interface CarrierCardProps {
  carrierName: string;
  carrierInfo: {
    scac?: string;
    mcNumber?: string;
    dotNumber?: string;
  };
  quotes: QuoteWithPricing[];
  onPriceUpdate: (quoteId: number, newPrice: number) => void;
  shipmentInfo: {
    fromZip: string;
    toZip: string;
    weight: number;
    pallets: number;
    pickupDate: string;
  };
}

interface CarrierCardsProps {
  quotes: QuoteWithPricing[];
  onPriceUpdate: (quoteId: number, newPrice: number) => void;
  shipmentInfo: {
    fromZip: string;
    toZip: string;
    weight: number;
    pallets: number;
    pickupDate: string;
  };
}

const CarrierCard: React.FC<CarrierCardProps> = ({ 
  carrierName, 
  carrierInfo,
  quotes, 
  onPriceUpdate, 
  shipmentInfo 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Sort quotes by customer price (best first)
  const sortedQuotes = [...quotes].sort((a, b) => a.customerPrice - b.customerPrice);
  const bestQuote = sortedQuotes[0];
  const worstQuote = sortedQuotes[sortedQuotes.length - 1];
  
  // Calculate carrier statistics
  const avgPrice = quotes.reduce((sum, q) => sum + q.customerPrice, 0) / quotes.length;
  const avgProfit = quotes.reduce((sum, q) => sum + q.profit, 0) / quotes.length;
  const avgTransitDays = quotes
    .filter(q => q.transitDays)
    .reduce((sum, q) => sum + (q.transitDays || 0), 0) / quotes.filter(q => q.transitDays).length;
  
  // Get unique service levels
  const serviceLevels = [...new Set(quotes.map(q => q.serviceLevel?.code).filter(Boolean))];
  
  const getServiceLevelIcon = (serviceCode?: string) => {
    if (!serviceCode) return Clock;
    
    if (serviceCode.includes('GUARANTEED') || serviceCode.includes('GTD')) return Shield;
    if (serviceCode.includes('EXPEDITED') || serviceCode.includes('PRIORITY') || serviceCode.includes('URGENT')) return Zap;
    if (serviceCode.includes('ECONOMY') || serviceCode.includes('DEFERRED')) return Clock;
    return Truck;
  };
  
  const getServiceLevelColor = (serviceCode?: string) => {
    if (!serviceCode) return 'text-gray-500';
    
    if (serviceCode.includes('GUARANTEED') || serviceCode.includes('GTD')) return 'text-green-600';
    if (serviceCode.includes('EXPEDITED') || serviceCode.includes('PRIORITY') || serviceCode.includes('URGENT')) return 'text-orange-600';
    if (serviceCode.includes('ECONOMY') || serviceCode.includes('DEFERRED')) return 'text-purple-600';
    return 'text-blue-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-200">
      {/* Carrier Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{carrierName}</h3>
              <div className="flex items-center space-x-4 mt-1">
                {carrierInfo.scac && (
                  <div className="flex items-center space-x-1 text-sm text-gray-600">
                    <Award className="h-4 w-4" />
                    <span>SCAC: {carrierInfo.scac}</span>
                  </div>
                )}
                {carrierInfo.mcNumber && (
                  <div className="flex items-center space-x-1 text-sm text-gray-600">
                    <Shield className="h-4 w-4" />
                    <span>MC: {carrierInfo.mcNumber}</span>
                  </div>
                )}
                {carrierInfo.dotNumber && (
                  <div className="flex items-center space-x-1 text-sm text-gray-600">
                    <TrendingUp className="h-4 w-4" />
                    <span>DOT: {carrierInfo.dotNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center space-x-2 mb-1">
              <Star className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-medium text-gray-600">
                {quotes.length} quote{quotes.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              {serviceLevels.length} service level{serviceLevels.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(bestQuote.customerPrice)}</div>
            <div className="text-xs text-gray-500">Best Price</div>
            {bestQuote.serviceLevel && (
              <div className={`text-xs font-medium mt-1 ${getServiceLevelColor(bestQuote.serviceLevel.code)}`}>
                {bestQuote.serviceLevel.description || bestQuote.serviceLevel.code}
              </div>
            )}
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(avgPrice)}</div>
            <div className="text-xs text-gray-500">Avg Price</div>
            <div className="text-xs text-gray-600 mt-1">
              Range: {formatCurrency(worstQuote.customerPrice - bestQuote.customerPrice)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(avgProfit)}</div>
            <div className="text-xs text-gray-500">Avg Profit</div>
            <div className="text-xs text-gray-600 mt-1">
              Best: {formatCurrency(bestQuote.profit)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {avgTransitDays ? `${avgTransitDays.toFixed(1)}` : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Avg Transit Days</div>
            {bestQuote.transitDays && (
              <div className="text-xs text-gray-600 mt-1">
                Best: {bestQuote.transitDays} days
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Service Level Summary */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Available Service Levels</h4>
        <div className="flex flex-wrap gap-2">
          {sortedQuotes.map((quote, index) => {
            const ServiceIcon = getServiceLevelIcon(quote.serviceLevel?.code);
            const isLowestPrice = index === 0;
            
            return (
              <div
                key={quote.quoteId}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all duration-200 ${
                  isLowestPrice 
                    ? 'border-green-500 bg-green-50 shadow-sm' 
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <ServiceIcon className={`h-4 w-4 ${getServiceLevelColor(quote.serviceLevel?.code)}`} />
                <div className="text-sm">
                  <div className={`font-medium ${isLowestPrice ? 'text-green-800' : 'text-gray-800'}`}>
                    {quote.serviceLevel?.description || quote.serviceLevel?.code || 'Standard'}
                  </div>
                  <div className={`text-xs ${isLowestPrice ? 'text-green-600' : 'text-gray-600'}`}>
                    {formatCurrency(quote.customerPrice)}
                    {quote.transitDays && ` • ${quote.transitDays}d`}
                  </div>
                </div>
                {isLowestPrice && (
                  <div className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    BEST
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Shipment Details */}
      <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span className="text-gray-700">
              {shipmentInfo.fromZip} → {shipmentInfo.toZip}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4 text-blue-600" />
            <span className="text-gray-700">
              {shipmentInfo.pallets} pallets
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4 text-blue-600" />
            <span className="text-gray-700">
              {shipmentInfo.weight.toLocaleString()} lbs
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="text-gray-700">
              {shipmentInfo.pickupDate}
            </span>
          </div>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <div className="px-6 py-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">
            {isExpanded ? 'Hide' : 'Show'} Detailed Quotes
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </button>
      </div>

      {/* Detailed Quotes */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-4">
          {sortedQuotes.map((quote) => (
            <QuotePricingCard
              key={quote.quoteId}
              quote={quote}
              onPriceUpdate={onPriceUpdate}
              isExpanded={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const CarrierCards: React.FC<CarrierCardsProps> = ({ 
  quotes, 
  onPriceUpdate, 
  shipmentInfo 
}) => {
  // Group quotes by carrierCode (from Project44 response), fallback to carrier name
  const carrierGroups = quotes.reduce((groups, quote) => {
    // Use carrierCode as primary grouping key, fallback to carrier name
    const carrierKey = quote.carrierCode || quote.carrier.name;
    const carrierName = quote.carrier.name;
    
    if (!groups[carrierKey]) {
      groups[carrierKey] = {
        name: carrierName,
        info: {
          scac: quote.carrier.scac || quote.carrierCode,
          mcNumber: quote.carrier.mcNumber,
          dotNumber: quote.carrier.dotNumber
        },
        quotes: []
      };
    }
    
    groups[carrierKey].quotes.push(quote);
    return groups;
  }, {} as Record<string, {
    name: string;
    info: {
      scac?: string;
      mcNumber?: string;
      dotNumber?: string;
    };
    quotes: QuoteWithPricing[];
  }>);

  // Sort carriers by their best quote price
  const sortedCarriers = Object.entries(carrierGroups).sort(([, groupA], [, groupB]) => {
    const bestPriceA = Math.min(...groupA.quotes.map(q => q.customerPrice));
    const bestPriceB = Math.min(...groupB.quotes.map(q => q.customerPrice));
    return bestPriceA - bestPriceB;
  });

  if (quotes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Quotes Available</h3>
        <p className="text-gray-600">No carrier quotes found for this shipment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Carrier Comparison</h2>
            <p className="text-sm text-gray-600 mt-1">
              {sortedCarriers.length} carrier{sortedCarriers.length !== 1 ? 's' : ''} • 
              {quotes.length} total quote{quotes.length !== 1 ? 's' : ''} • 
              Best price: {formatCurrency(Math.min(...quotes.map(q => q.customerPrice)))}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(Math.min(...quotes.map(q => q.customerPrice)))}
            </div>
            <div className="text-sm text-gray-500">Lowest Quote</div>
          </div>
        </div>
      </div>

      {/* Carrier Cards */}
      <div className="space-y-6">
        {sortedCarriers.map(([carrierKey, carrierGroup], index) => (
          <div key={carrierKey} className="relative">
            {index === 0 && (
              <div className="absolute -top-2 -right-2 z-10">
                <div className="bg-green-500 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg">
                  BEST PRICE
                </div>
              </div>
            )}
            <CarrierCard
              carrierName={carrierGroup.name}
              carrierInfo={carrierGroup.info}
              quotes={carrierGroup.quotes}
              onPriceUpdate={onPriceUpdate}
              shipmentInfo={shipmentInfo}
            />
          </div>
        ))}
      </div>
    </div>
  );
};