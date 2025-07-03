import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Truck, 
  Clock, 
  MapPin, 
  Package, 
  Award,
  Download,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle,
  Activity
} from 'lucide-react';
import { ProcessingResult, QuoteWithPricing } from '../types';
import { formatCurrency } from '../utils/pricingCalculator';

interface AnalyticsProps {
  results: ProcessingResult[];
  onExport: () => void;
}

interface CarrierMetrics {
  name: string;
  quoteCount: number;
  avgPrice: number;
  bestPrice: number;
  worstPrice: number;
  avgTransitDays: number;
  successRate: number;
  totalVolume: number;
  avgProfit: number;
  marketShare: number;
}

interface RouteMetrics {
  route: string;
  fromZip: string;
  toZip: string;
  quoteCount: number;
  avgPrice: number;
  bestPrice: number;
  carrierCount: number;
  avgTransitDays: number;
  totalWeight: number;
}

interface TimeSeriesData {
  date: string;
  avgPrice: number;
  quoteCount: number;
  carrierCount: number;
}

export const Analytics: React.FC<AnalyticsProps> = ({ results, onExport }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'carriers' | 'routes' | 'trends' | 'performance'>('overview');
  const [sortBy, setSortBy] = useState<'price' | 'volume' | 'quotes' | 'profit'>('price');

  // Calculate comprehensive metrics
  const analytics = useMemo(() => {
    const successfulResults = results.filter(r => r.status === 'success' && r.quotes.length > 0);
    const allQuotes = successfulResults.flatMap(r => r.quotes);
    
    if (allQuotes.length === 0) {
      return {
        overview: {
          totalRFQs: results.length,
          successfulRFQs: 0,
          totalQuotes: 0,
          avgQuotesPerRFQ: 0,
          successRate: 0,
          avgPrice: 0,
          avgProfit: 0,
          totalSavings: 0,
          avgTransitDays: 0,
          uniqueCarriers: 0,
          uniqueRoutes: 0,
          totalWeight: 0,
          avgWeight: 0
        },
        carriers: [],
        routes: [],
        timeSeries: [],
        priceDistribution: [],
        transitTimeDistribution: [],
        accessorialUsage: [],
        costSavingsAnalysis: {
          totalPotentialSavings: 0,
          avgSavingsPerShipment: 0,
          bestVsWorstCarrier: 0,
          optimizationOpportunities: []
        }
      };
    }

    // Overview metrics
    const totalQuotes = allQuotes.length;
    const avgPrice = allQuotes.reduce((sum, q) => sum + q.customerPrice, 0) / totalQuotes;
    const avgProfit = allQuotes.reduce((sum, q) => sum + q.profit, 0) / totalQuotes;
    const avgTransitDays = allQuotes.filter(q => q.transitDays).reduce((sum, q) => sum + (q.transitDays || 0), 0) / allQuotes.filter(q => q.transitDays).length;
    const totalWeight = successfulResults.reduce((sum, r) => sum + r.originalData.grossWeight, 0);
    
    // Calculate total potential savings (difference between highest and lowest quote per RFQ)
    const totalSavings = successfulResults.reduce((sum, result) => {
      if (result.quotes.length > 1) {
        const prices = result.quotes.map(q => q.customerPrice);
        const highest = Math.max(...prices);
        const lowest = Math.min(...prices);
        return sum + (highest - lowest);
      }
      return sum;
    }, 0);

    // Carrier metrics
    const carrierMap = new Map<string, {
      quotes: QuoteWithPricing[];
      rfqCount: number;
      totalWeight: number;
    }>();

    successfulResults.forEach(result => {
      result.quotes.forEach(quote => {
        const carrierName = quote.carrier.name;
        if (!carrierMap.has(carrierName)) {
          carrierMap.set(carrierName, { quotes: [], rfqCount: 0, totalWeight: 0 });
        }
        const carrier = carrierMap.get(carrierName)!;
        carrier.quotes.push(quote);
        carrier.totalWeight += result.originalData.grossWeight;
      });
      
      // Count unique carriers per RFQ
      const uniqueCarriersInRFQ = new Set(result.quotes.map(q => q.carrier.name));
      uniqueCarriersInRFQ.forEach(carrierName => {
        if (carrierMap.has(carrierName)) {
          carrierMap.get(carrierName)!.rfqCount++;
        }
      });
    });

    const carriers: CarrierMetrics[] = Array.from(carrierMap.entries()).map(([name, data]) => {
      const prices = data.quotes.map(q => q.customerPrice);
      const profits = data.quotes.map(q => q.profit);
      const transitDays = data.quotes.filter(q => q.transitDays).map(q => q.transitDays!);
      
      return {
        name,
        quoteCount: data.quotes.length,
        avgPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
        bestPrice: Math.min(...prices),
        worstPrice: Math.max(...prices),
        avgTransitDays: transitDays.length > 0 ? transitDays.reduce((sum, t) => sum + t, 0) / transitDays.length : 0,
        successRate: (data.rfqCount / successfulResults.length) * 100,
        totalVolume: data.totalWeight,
        avgProfit: profits.reduce((sum, p) => sum + p, 0) / profits.length,
        marketShare: (data.quotes.length / totalQuotes) * 100
      };
    });

    // Route metrics
    const routeMap = new Map<string, {
      quotes: QuoteWithPricing[];
      results: ProcessingResult[];
      totalWeight: number;
    }>();

    successfulResults.forEach(result => {
      const routeKey = `${result.originalData.fromZip}-${result.originalData.toZip}`;
      if (!routeMap.has(routeKey)) {
        routeMap.set(routeKey, { quotes: [], results: [], totalWeight: 0 });
      }
      const route = routeMap.get(routeKey)!;
      route.quotes.push(...result.quotes);
      route.results.push(result);
      route.totalWeight += result.originalData.grossWeight;
    });

    const routes: RouteMetrics[] = Array.from(routeMap.entries()).map(([routeKey, data]) => {
      const [fromZip, toZip] = routeKey.split('-');
      const prices = data.quotes.map(q => q.customerPrice);
      const transitDays = data.quotes.filter(q => q.transitDays).map(q => q.transitDays!);
      const uniqueCarriers = new Set(data.quotes.map(q => q.carrier.name));
      
      return {
        route: `${fromZip} → ${toZip}`,
        fromZip,
        toZip,
        quoteCount: data.quotes.length,
        avgPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
        bestPrice: Math.min(...prices),
        carrierCount: uniqueCarriers.size,
        avgTransitDays: transitDays.length > 0 ? transitDays.reduce((sum, t) => sum + t, 0) / transitDays.length : 0,
        totalWeight: data.totalWeight
      };
    });

    // Time series data (group by pickup date)
    const timeSeriesMap = new Map<string, {
      quotes: QuoteWithPricing[];
      carriers: Set<string>;
    }>();

    successfulResults.forEach(result => {
      const date = result.originalData.fromDate;
      if (!timeSeriesMap.has(date)) {
        timeSeriesMap.set(date, { quotes: [], carriers: new Set() });
      }
      const timeData = timeSeriesMap.get(date)!;
      timeData.quotes.push(...result.quotes);
      result.quotes.forEach(q => timeData.carriers.add(q.carrier.name));
    });

    const timeSeries: TimeSeriesData[] = Array.from(timeSeriesMap.entries())
      .map(([date, data]) => ({
        date,
        avgPrice: data.quotes.reduce((sum, q) => sum + q.customerPrice, 0) / data.quotes.length,
        quoteCount: data.quotes.length,
        carrierCount: data.carriers.size
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Price distribution
    const priceRanges = [
      { range: '$0-500', min: 0, max: 500 },
      { range: '$500-1000', min: 500, max: 1000 },
      { range: '$1000-2000', min: 1000, max: 2000 },
      { range: '$2000-5000', min: 2000, max: 5000 },
      { range: '$5000+', min: 5000, max: Infinity }
    ];

    const priceDistribution = priceRanges.map(range => ({
      range: range.range,
      count: allQuotes.filter(q => q.customerPrice >= range.min && q.customerPrice < range.max).length,
      percentage: (allQuotes.filter(q => q.customerPrice >= range.min && q.customerPrice < range.max).length / totalQuotes) * 100
    }));

    // Transit time distribution
    const transitTimeRanges = [
      { range: '1-2 days', min: 1, max: 2 },
      { range: '3-5 days', min: 3, max: 5 },
      { range: '6-10 days', min: 6, max: 10 },
      { range: '11+ days', min: 11, max: Infinity }
    ];

    const quotesWithTransit = allQuotes.filter(q => q.transitDays);
    const transitTimeDistribution = transitTimeRanges.map(range => ({
      range: range.range,
      count: quotesWithTransit.filter(q => q.transitDays! >= range.min && q.transitDays! <= range.max).length,
      percentage: quotesWithTransit.length > 0 ? (quotesWithTransit.filter(q => q.transitDays! >= range.min && q.transitDays! <= range.max).length / quotesWithTransit.length) * 100 : 0
    }));

    // Accessorial usage analysis
    const accessorialUsage = new Map<string, number>();
    successfulResults.forEach(result => {
      (result.originalData.accessorial || []).forEach(acc => {
        accessorialUsage.set(acc, (accessorialUsage.get(acc) || 0) + 1);
      });
    });

    const accessorialUsageArray = Array.from(accessorialUsage.entries())
      .map(([code, count]) => ({
        code,
        count,
        percentage: (count / successfulResults.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Cost savings analysis
    const costSavingsAnalysis = {
      totalPotentialSavings: totalSavings,
      avgSavingsPerShipment: totalSavings / successfulResults.length,
      bestVsWorstCarrier: carriers.length > 1 ? 
        Math.max(...carriers.map(c => c.avgPrice)) - Math.min(...carriers.map(c => c.avgPrice)) : 0,
      optimizationOpportunities: routes
        .filter(r => r.carrierCount > 1)
        .map(r => ({
          route: r.route,
          potentialSavings: (r.avgPrice - r.bestPrice) * (r.totalWeight / 1000), // Estimate based on weight
          currentAvgPrice: r.avgPrice,
          bestPrice: r.bestPrice
        }))
        .sort((a, b) => b.potentialSavings - a.potentialSavings)
        .slice(0, 5)
    };

    return {
      overview: {
        totalRFQs: results.length,
        successfulRFQs: successfulResults.length,
        totalQuotes,
        avgQuotesPerRFQ: totalQuotes / successfulResults.length,
        successRate: (successfulResults.length / results.length) * 100,
        avgPrice,
        avgProfit,
        totalSavings,
        avgTransitDays,
        uniqueCarriers: carrierMap.size,
        uniqueRoutes: routeMap.size,
        totalWeight,
        avgWeight: totalWeight / successfulResults.length
      },
      carriers: carriers.sort((a, b) => {
        switch (sortBy) {
          case 'price': return a.avgPrice - b.avgPrice;
          case 'volume': return b.totalVolume - a.totalVolume;
          case 'quotes': return b.quoteCount - a.quoteCount;
          case 'profit': return b.avgProfit - a.avgProfit;
          default: return a.avgPrice - b.avgPrice;
        }
      }),
      routes: routes.sort((a, b) => b.quoteCount - a.quoteCount),
      timeSeries,
      priceDistribution,
      transitTimeDistribution,
      accessorialUsage: accessorialUsageArray,
      costSavingsAnalysis
    };
  }, [results, sortBy]);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total RFQs</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalRFQs}</p>
              <p className="text-sm text-green-600">
                {analytics.overview.successRate.toFixed(1)}% success rate
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Quotes</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalQuotes}</p>
              <p className="text-sm text-blue-600">
                {analytics.overview.avgQuotesPerRFQ.toFixed(1)} avg per RFQ
              </p>
            </div>
            <Award className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Price</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.overview.avgPrice)}</p>
              <p className="text-sm text-green-600">
                {formatCurrency(analytics.overview.avgProfit)} avg profit
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Potential Savings</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.overview.totalSavings)}</p>
              <p className="text-sm text-green-600">
                {formatCurrency(analytics.costSavingsAnalysis.avgSavingsPerShipment)} per shipment
              </p>
            </div>
            <Target className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unique Carriers</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.uniqueCarriers}</p>
            </div>
            <Truck className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unique Routes</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.uniqueRoutes}</p>
            </div>
            <MapPin className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Transit</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.overview.avgTransitDays.toFixed(1)} days
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Weight</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.overview.totalWeight.toLocaleString()} lbs
              </p>
              <p className="text-sm text-gray-600">
                {analytics.overview.avgWeight.toFixed(0)} avg per RFQ
              </p>
            </div>
            <Package className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Price and Transit Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Distribution</h3>
          <div className="space-y-3">
            {analytics.priceDistribution.map((item, _index) => (
              <div key={_index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.range}</span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-12 text-right">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Transit Time Distribution</h3>
          <div className="space-y-3">
            {analytics.transitTimeDistribution.map((item, _index) => (
              <div key={_index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.range}</span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-12 text-right">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderCarriers = () => (
    <div className="space-y-6">
      {/* Sort Controls */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Carrier Performance Analysis</h3>
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="price">Average Price</option>
              <option value="volume">Total Volume</option>
              <option value="quotes">Quote Count</option>
              <option value="profit">Average Profit</option>
            </select>
          </div>
        </div>
      </div>

      {/* Carrier Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analytics.carriers.map((carrier, index) => {
          void index; // Explicitly mark index as used to avoid TS6133
          return (
            <div key={carrier.name} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${index === 0 ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                    <Truck className={`h-5 w-5 ${index === 0 ? 'text-yellow-600' : 'text-gray-600'}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{carrier.name}</h4>
                    <p className="text-sm text-gray-600">
                      {carrier.marketShare.toFixed(1)}% market share
                    </p>
                  </div>
                </div>
                {index === 0 && (
                  <Award className="h-6 w-6 text-yellow-500" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Avg Price</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(carrier.avgPrice)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Profit</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(carrier.avgProfit)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Quote Count</p>
                  <p className="text-lg font-bold text-gray-900">{carrier.quoteCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Success Rate</p>
                  <p className="text-lg font-bold text-blue-600">{carrier.successRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Best Price</p>
                  <p className="text-sm font-medium text-green-600">{formatCurrency(carrier.bestPrice)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Transit</p>
                  <p className="text-sm font-medium text-gray-900">
                    {carrier.avgTransitDays.toFixed(1)} days
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total Volume:</span>
                  <span className="font-medium text-gray-900">
                    {carrier.totalVolume.toLocaleString()} lbs
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderRoutes = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold text-gray-900">Route Performance Analysis</h3>
        <p className="text-sm text-gray-600 mt-1">
          Analyze pricing and carrier availability by shipping route
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Route
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quotes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Carriers
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Best Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Transit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.routes.map((route, _index) => (
                <tr key={route.route} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{route.route}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {route.quoteCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {route.carrierCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(route.avgPrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                    {formatCurrency(route.bestPrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {route.avgTransitDays.toFixed(1)} days
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {route.totalWeight.toLocaleString()} lbs
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderTrends = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold text-gray-900">Pricing and Volume Trends</h3>
        <p className="text-sm text-gray-600 mt-1">
          Track pricing patterns and quote volume over time
        </p>
      </div>

      {analytics.timeSeries.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Average Price by Date</h4>
            <div className="space-y-3">
              {analytics.timeSeries.map((item, _index) => (
                <div key={item.date} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.date}</span>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(item.avgPrice)}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({item.quoteCount} quotes)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Carrier Participation</h4>
            <div className="space-y-3">
              {analytics.timeSeries.map((item, _index) => (
                <div key={item.date} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.date}</span>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-900">
                      {item.carrierCount} carriers
                    </span>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ 
                          width: `${(item.carrierCount / Math.max(...analytics.timeSeries.map(t => t.carrierCount))) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Time Series Data</h3>
          <p className="text-gray-600">Process RFQs with different pickup dates to see trends.</p>
        </div>
      )}

      {/* Accessorial Usage */}
      {analytics.accessorialUsage.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Most Used Accessorial Services</h4>
          <div className="space-y-3">
            {analytics.accessorialUsage.map((item, _index) => (
              <div key={item.code} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{item.code}</span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full" 
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-16 text-right">
                    {item.count} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderPerformance = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold text-gray-900">Cost Optimization Analysis</h3>
        <p className="text-sm text-gray-600 mt-1">
          Identify opportunities to reduce shipping costs and improve efficiency
        </p>
      </div>

      {/* Cost Savings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Potential Savings</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(analytics.costSavingsAnalysis.totalPotentialSavings)}
              </p>
            </div>
            <Target className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Savings per Shipment</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(analytics.costSavingsAnalysis.avgSavingsPerShipment)}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Best vs Worst Carrier</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(analytics.costSavingsAnalysis.bestVsWorstCarrier)}
              </p>
              <p className="text-sm text-gray-600">Price difference</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Optimization Opportunities */}
      {analytics.costSavingsAnalysis.optimizationOpportunities.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Top Optimization Opportunities</h4>
          <div className="space-y-4">
            {analytics.costSavingsAnalysis.optimizationOpportunities.map((opp, _index) => (
              <div key={opp.route} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-gray-900">{opp.route}</h5>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(opp.potentialSavings)} savings
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Current Avg:</span>
                    <span className="ml-2 font-medium">{formatCurrency(opp.currentAvgPrice)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Best Available:</span>
                    <span className="ml-2 font-medium text-green-600">{formatCurrency(opp.bestPrice)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-blue-900 mb-4">Recommendations</h4>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-800 font-medium">Carrier Diversification</p>
              <p className="text-blue-700 text-sm">
                Consider using multiple carriers for better pricing competition and service reliability.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-800 font-medium">Route Optimization</p>
              <p className="text-blue-700 text-sm">
                Focus on routes with high volume and multiple carrier options for maximum savings.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-800 font-medium">Accessorial Management</p>
              <p className="text-blue-700 text-sm">
                Review frequently used accessorial services to negotiate better rates or find alternatives.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
        <p className="text-gray-600">Process some RFQs to see analytics and insights.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">RFQ Analytics</h2>
              <p className="text-sm text-gray-600">
                Comprehensive analysis of your Project44 RFQ performance
              </p>
            </div>
          </div>
          <button
            onClick={onExport}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export Analytics</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'carriers', label: 'Carriers', icon: Truck },
              { id: 'routes', label: 'Routes', icon: MapPin },
              { id: 'trends', label: 'Trends', icon: TrendingUp },
              { id: 'performance', label: 'Optimization', icon: Target }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'carriers' && renderCarriers()}
          {activeTab === 'routes' && renderRoutes()}
          {activeTab === 'trends' && renderTrends()}
          {activeTab === 'performance' && renderPerformance()}
        </div>
      </div>
    </div>
  );
};