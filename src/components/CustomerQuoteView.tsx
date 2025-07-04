import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  Truck, 
  Clock, 
  MapPin, 
  Package, 
  Calendar,
  Download,
  Eye,
  EyeOff,
  Star,
  Award,
  Shield,
  CheckCircle,
  TrendingUp,
  Filter,
  Search,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { ProcessingResult, QuoteWithPricing } from '../types';
import { formatCurrency } from '../utils/pricingCalculator';

interface CustomerQuoteViewProps {
  results: ProcessingResult[];
  customerName?: string;
  hideCarrierDetails?: boolean;
  showOnlyBestQuotes?: boolean;
}

export const CustomerQuoteView: React.FC<CustomerQuoteViewProps> = ({
  results,
  customerName = 'Valued Customer',
  hideCarrierDetails = false,
  showOnlyBestQuotes = false
}) => {
  const [sortBy, setSortBy] = useState<'price' | 'transit' | 'carrier'>('price');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterCarrier, setFilterCarrier] = useState('');
  const [showDetails, setShowDetails] = useState<{ [key: string]: boolean }>({});

  // Process and filter quotes
  const processedQuotes = useMemo(() => {
    const allQuotes = results.flatMap((result, resultIndex) => 
      result.quotes.map(quote => ({
        ...quote,
        resultIndex,
        shipmentInfo: {
          route: `${result.originalData.fromZip} → ${result.originalData.toZip}`,
          pallets: result.originalData.pallets,
          weight: result.originalData.grossWeight,
          pickupDate: result.originalData.fromDate,
          isReefer: result.originalData.isReefer,
          temperature: result.originalData.temperature
        }
      }))
    );

    // Filter by carrier if specified
    let filtered = filterCarrier 
      ? allQuotes.filter(q => q.carrier.name.toLowerCase().includes(filterCarrier.toLowerCase()))
      : allQuotes;

    // Show only best quotes per shipment if requested
    if (showOnlyBestQuotes) {
      const bestQuotes = new Map();
      filtered.forEach(quote => {
        const key = quote.resultIndex;
        if (!bestQuotes.has(key) || quote.customerPrice < bestQuotes.get(key).customerPrice) {
          bestQuotes.set(key, quote);
        }
      });
      filtered = Array.from(bestQuotes.values());
    }

    // Sort quotes
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'price':
          comparison = a.customerPrice - b.customerPrice;
          break;
        case 'transit':
          comparison = (a.transitDays || 999) - (b.transitDays || 999);
          break;
        case 'carrier':
          comparison = a.carrier.name.localeCompare(b.carrier.name);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [results, sortBy, sortOrder, filterCarrier, showOnlyBestQuotes]);

  const toggleDetails = (quoteId: number) => {
    setShowDetails(prev => ({
      ...prev,
      [quoteId]: !prev[quoteId]
    }));
  };

  const exportQuotes = () => {
    const csvContent = [
      ['Route', 'Carrier', 'Service Level', 'Price', 'Transit Days', 'Pickup Date'].join(','),
      ...processedQuotes.map(quote => [
        quote.shipmentInfo.route,
        quote.carrier.name,
        quote.serviceLevel?.description || 'Standard',
        quote.customerPrice,
        quote.transitDays || 'N/A',
        quote.shipmentInfo.pickupDate
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quotes-${customerName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalSavings = useMemo(() => {
    if (processedQuotes.length === 0) return 0;
    const highest = Math.max(...processedQuotes.map(q => q.customerPrice));
    const lowest = Math.min(...processedQuotes.map(q => q.customerPrice));
    return highest - lowest;
  }, [processedQuotes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Freight Quotes for {customerName}</h1>
            <p className="text-blue-100 mt-1">
              {processedQuotes.length} quote{processedQuotes.length !== 1 ? 's' : ''} available
              {totalSavings > 0 && (
                <span className="ml-2">• Potential savings: {formatCurrency(totalSavings)}</span>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportQuotes}
              className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by carrier..."
              value={filterCarrier}
              onChange={(e) => setFilterCarrier(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="price">Price</option>
              <option value="transit">Transit Time</option>
              <option value="carrier">Carrier</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </button>
          </div>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showOnlyBestQuotes}
              onChange={(e) => setShowOnlyBestQuotes(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show only best quotes</span>
          </label>
        </div>
      </div>

      {/* Quotes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {processedQuotes.map((quote, index) => (
          <div key={`${quote.resultIndex}-${quote.quoteId}`} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
            {/* Quote Header */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {index === 0 && (
                    <Award className="h-5 w-5 text-yellow-500" />
                  )}
                  <span className="font-semibold text-gray-900">
                    {hideCarrierDetails ? 'Carrier Option' : quote.carrier.name}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(quote.customerPrice)}
                  </div>
                  {quote.transitDays && (
                    <div className="text-sm text-gray-500">
                      {quote.transitDays} day{quote.transitDays !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quote Details */}
            <div className="p-4 space-y-3">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>{quote.shipmentInfo.route}</span>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Package className="h-4 w-4" />
                <span>{quote.shipmentInfo.pallets} pallets, {quote.shipmentInfo.weight.toLocaleString()} lbs</span>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>Pickup: {quote.shipmentInfo.pickupDate}</span>
              </div>

              {quote.serviceLevel && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Shield className="h-4 w-4" />
                  <span>{quote.serviceLevel.description}</span>
                </div>
              )}

              {quote.shipmentInfo.isReefer && (
                <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Temperature Controlled
                </div>
              )}
            </div>

            {/* Expandable Details */}
            {!hideCarrierDetails && (
              <div className="border-t border-gray-200">
                <button
                  onClick={() => toggleDetails(quote.quoteId)}
                  className="w-full px-4 py-3 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span>View Details</span>
                  {showDetails[quote.quoteId] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                
                {showDetails[quote.quoteId] && (
                  <div className="px-4 pb-4 space-y-2 text-sm">
                    {quote.carrier.scac && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">SCAC:</span>
                        <span className="font-medium">{quote.carrier.scac}</span>
                      </div>
                    )}
                    {quote.carrier.mcNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">MC Number:</span>
                        <span className="font-medium">{quote.carrier.mcNumber}</span>
                      </div>
                    )}
                    {quote.estimatedDeliveryDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Est. Delivery:</span>
                        <span className="font-medium">{new Date(quote.estimatedDeliveryDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {processedQuotes.length === 0 && (
        <div className="text-center py-12">
          <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Quotes Available</h3>
          <p className="text-gray-600">No quotes match your current filters.</p>
        </div>
      )}
    </div>
  );
};