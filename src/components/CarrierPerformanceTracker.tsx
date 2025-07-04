import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Award, 
  AlertTriangle,
  Clock,
  DollarSign,
  Truck,
  Star,
  BarChart3,
  Target,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { ProcessingResult, QuoteWithPricing } from '../types';
import { formatCurrency } from '../utils/pricingCalculator';

interface CarrierPerformanceTrackerProps {
  results: ProcessingResult[];
  historicalData?: any[]; // For future integration with database
}

interface CarrierMetrics {
  name: string;
  totalQuotes: number;
  avgPrice: number;
  bestPrice: number;
  worstPrice: number;
  priceConsistency: number;
  avgTransitDays: number;
  marketShare: number;
  competitiveRank: number;
  reliability: 'high' | 'medium' | 'low';
  recommendation: string;
}

export const CarrierPerformanceTracker: React.FC<CarrierPerformanceTrackerProps> = ({ 
  results 
}) => {
  const [sortBy, setSortBy] = useState<'price' | 'consistency' | 'transit' | 'share'>('price');
  const [timeframe, setTimeframe] = useState<'current' | 'week' | 'month'>('current');

  const carrierMetrics = useMemo(() => {
    const successfulResults = results.filter(r => r.status === 'success' && r.quotes.length > 0);
    const allQuotes = successfulResults.flatMap(r => r.quotes) as QuoteWithPricing[];
    
    if (allQuotes.length === 0) return [];

    const totalRevenue = allQuotes.reduce((sum, q) => sum + q.customerPrice, 0);
    
    // Group quotes by carrier
    const carrierMap = new Map<string, QuoteWithPricing[]>();
    allQuotes.forEach(quote => {
      const carrierName = quote.carrier.name;
      if (!carrierMap.has(carrierName)) {
        carrierMap.set(carrierName, []);
      }
      carrierMap.get(carrierName)!.push(quote);
    });

    const metrics: CarrierMetrics[] = Array.from(carrierMap.entries()).map(([name, quotes]) => {
      const prices = quotes.map(q => q.customerPrice);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const bestPrice = Math.min(...prices);
      const worstPrice = Math.max(...prices);
      
      // Price consistency (lower standard deviation = more consistent)
      const priceVariance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
      const priceStdDev = Math.sqrt(priceVariance);
      const priceConsistency = Math.max(0, 100 - (priceStdDev / avgPrice) * 100);
      
      const transitDays = quotes.filter(q => q.transitDays).map(q => q.transitDays!);
      const avgTransitDays = transitDays.length > 0 ? transitDays.reduce((sum, t) => sum + t, 0) / transitDays.length : 0;
      
      const marketShare = (quotes.reduce((sum, q) => sum + q.customerPrice, 0) / totalRevenue) * 100;
      
      // Determine reliability based on consistency and performance
      let reliability: 'high' | 'medium' | 'low' = 'medium';
      if (priceConsistency > 80 && quotes.length >= 3) {
        reliability = 'high';
      } else if (priceConsistency < 60 || quotes.length < 2) {
        reliability = 'low';
      }
      
      // Generate recommendation
      let recommendation = '';
      if (reliability === 'high' && avgPrice <= avgPrice * 1.1) {
        recommendation = 'Preferred carrier - consistent pricing and good performance';
      } else if (reliability === 'low') {
        recommendation = 'Monitor closely - inconsistent pricing patterns';
      } else if (bestPrice === Math.min(...Array.from(carrierMap.values()).flat().map(q => q.customerPrice))) {
        recommendation = 'Best price leader - consider for cost-sensitive shipments';
      } else {
        recommendation = 'Standard option - good for capacity needs';
      }

      return {
        name,
        totalQuotes: quotes.length,
        avgPrice,
        bestPrice,
        worstPrice,
        priceConsistency,
        avgTransitDays,
        marketShare,
        competitiveRank: 0, // Will be set after sorting
        reliability,
        recommendation
      };
    });

    // Set competitive ranks
    const sortedByPrice = [...metrics].sort((a, b) => a.avgPrice - b.avgPrice);
    sortedByPrice.forEach((metric, index) => {
      metric.competitiveRank = index + 1;
    });

    // Sort by selected criteria
    return metrics.sort((a, b) => {
      switch (sortBy) {
        case 'price': return a.avgPrice - b.avgPrice;
        case 'consistency': return b.priceConsistency - a.priceConsistency;
        case 'transit': return a.avgTransitDays - b.avgTransitDays;
        case 'share': return b.marketShare - a.marketShare;
        default: return 0;
      }
    });
  }, [results, sortBy]);

  const topPerformers = carrierMetrics.slice(0, 3);
  const avgMarketPrice = carrierMetrics.reduce((sum, c) => sum + c.avgPrice, 0) / carrierMetrics.length;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Carrier Performance Analysis</h2>
          <div className="flex items-center space-x-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="price">Sort by Price</option>
              <option value="consistency">Sort by Consistency</option>
              <option value="transit">Sort by Transit Time</option>
              <option value="share">Sort by Market Share</option>
            </select>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {topPerformers.map((carrier, index) => (
          <div key={carrier.name} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-l-yellow-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Award className="h-6 w-6 text-yellow-500" />
                <span className="font-semibold text-gray-900">#{index + 1} Performer</span>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                carrier.reliability === 'high' ? 'bg-green-100 text-green-800' :
                carrier.reliability === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {carrier.reliability.toUpperCase()}
              </div>
            </div>
            
            <h3 className="font-bold text-lg text-gray-900 mb-2">{carrier.name}</h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Price:</span>
                <span className="font-medium">{formatCurrency(carrier.avgPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Consistency:</span>
                <span className="font-medium">{carrier.priceConsistency.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Market Share:</span>
                <span className="font-medium">{carrier.marketShare.toFixed(1)}%</span>
              </div>
              {carrier.avgTransitDays > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Transit:</span>
                  <span className="font-medium">{carrier.avgTransitDays.toFixed(1)} days</span>
                </div>
              )}
            </div>
            
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-700">{carrier.recommendation}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Performance Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Detailed Carrier Metrics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quotes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price Range</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consistency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Market Share</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {carrierMetrics.map((carrier) => (
                <tr key={carrier.name} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <Truck className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{carrier.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{carrier.totalQuotes}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(carrier.avgPrice)}</div>
                    <div className={`text-xs ${
                      carrier.avgPrice < avgMarketPrice ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {carrier.avgPrice < avgMarketPrice ? '↓' : '↑'} vs market avg
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatCurrency(carrier.bestPrice)} - {formatCurrency(carrier.worstPrice)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            carrier.priceConsistency > 80 ? 'bg-green-500' :
                            carrier.priceConsistency > 60 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${carrier.priceConsistency}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-900">{carrier.priceConsistency.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {carrier.avgTransitDays > 0 ? `${carrier.avgTransitDays.toFixed(1)} days` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{carrier.marketShare.toFixed(1)}%</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      carrier.competitiveRank <= 3 ? 'bg-green-100 text-green-800' :
                      carrier.competitiveRank <= 6 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      #{carrier.competitiveRank}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1">
                      {carrier.reliability === 'high' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : carrier.reliability === 'low' ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      )}
                      <span className={`text-xs font-medium ${
                        carrier.reliability === 'high' ? 'text-green-800' :
                        carrier.reliability === 'low' ? 'text-red-800' :
                        'text-yellow-800'
                      }`}>
                        {carrier.reliability.toUpperCase()}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {carrierMetrics.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Performance Data</h3>
          <p className="text-gray-600">Process some quotes to see carrier performance analysis.</p>
        </div>
      )}
    </div>
  );
};