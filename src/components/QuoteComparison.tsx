import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Clock, 
  Truck, 
  Award,
  BarChart3,
  Target,
  Zap,
  Shield
} from 'lucide-react';
import { QuoteWithPricing } from '../types';
import { formatCurrency } from '../utils/pricingCalculator';

interface QuoteComparisonProps {
  quotes: QuoteWithPricing[];
  title?: string;
}

export const QuoteComparison: React.FC<QuoteComparisonProps> = ({ 
  quotes, 
  title = "Quote Comparison" 
}) => {
  const [selectedQuotes, setSelectedQuotes] = useState<Set<number>>(new Set());

  const comparisonData = useMemo(() => {
    if (quotes.length === 0) return null;

    const sortedQuotes = [...quotes].sort((a, b) => a.customerPrice - b.customerPrice);
    const bestQuote = sortedQuotes[0];
    const worstQuote = sortedQuotes[sortedQuotes.length - 1];
    const avgPrice = quotes.reduce((sum, q) => sum + q.customerPrice, 0) / quotes.length;
    const avgTransit = quotes.filter(q => q.transitDays).reduce((sum, q) => sum + (q.transitDays || 0), 0) / quotes.filter(q => q.transitDays).length;

    return {
      bestQuote,
      worstQuote,
      avgPrice,
      avgTransit,
      totalSavings: worstQuote.customerPrice - bestQuote.customerPrice,
      priceRange: {
        min: bestQuote.customerPrice,
        max: worstQuote.customerPrice,
        spread: ((worstQuote.customerPrice - bestQuote.customerPrice) / bestQuote.customerPrice) * 100
      }
    };
  }, [quotes]);

  const toggleQuoteSelection = (quoteId: number) => {
    setSelectedQuotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(quoteId)) {
        newSet.delete(quoteId);
      } else {
        newSet.add(quoteId);
      }
      return newSet;
    });
  };

  const selectedQuotesList = quotes.filter(q => selectedQuotes.has(q.quoteId));

  if (!comparisonData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No quotes available for comparison</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Best Price</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(comparisonData.bestQuote.customerPrice)}
              </p>
              <p className="text-xs text-gray-500">{comparisonData.bestQuote.carrier.name}</p>
            </div>
            <Award className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Price</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(comparisonData.avgPrice)}
              </p>
              <p className="text-xs text-gray-500">Market average</p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Potential Savings</p>
              <p className="text-xl font-bold text-purple-600">
                {formatCurrency(comparisonData.totalSavings)}
              </p>
              <p className="text-xs text-gray-500">{comparisonData.priceRange.spread.toFixed(1)}% spread</p>
            </div>
            <TrendingDown className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Transit</p>
              <p className="text-xl font-bold text-orange-600">
                {comparisonData.avgTransit.toFixed(1)} days
              </p>
              <p className="text-xs text-gray-500">Delivery time</p>
            </div>
            <Clock className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Quote Selection */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Quotes to Compare</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quotes.map(quote => (
            <div
              key={quote.quoteId}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedQuotes.has(quote.quoteId)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => toggleQuoteSelection(quote.quoteId)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{quote.carrier.name}</span>
                <span className="text-lg font-bold text-green-600">
                  {formatCurrency(quote.customerPrice)}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {quote.serviceLevel?.description || 'Standard Service'}
                {quote.transitDays && ` • ${quote.transitDays} days`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Quotes Comparison */}
      {selectedQuotesList.length > 1 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Detailed Comparison ({selectedQuotesList.length} quotes)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Carrier</th>
                  <th className="text-left py-2">Service Level</th>
                  <th className="text-left py-2">Price</th>
                  <th className="text-left py-2">Transit</th>
                  <th className="text-left py-2">vs Best</th>
                  <th className="text-left py-2">Profit</th>
                </tr>
              </thead>
              <tbody>
                {selectedQuotesList.map(quote => {
                  const vsBase = quote.customerPrice - comparisonData.bestQuote.customerPrice;
                  return (
                    <tr key={quote.quoteId} className="border-b">
                      <td className="py-2 font-medium">{quote.carrier.name}</td>
                      <td className="py-2">{quote.serviceLevel?.description || 'Standard'}</td>
                      <td className="py-2 font-bold text-green-600">
                        {formatCurrency(quote.customerPrice)}
                      </td>
                      <td className="py-2">{quote.transitDays || 'N/A'} days</td>
                      <td className="py-2">
                        {vsBase === 0 ? (
                          <span className="text-green-600 font-medium">Best Price</span>
                        ) : (
                          <span className="text-red-600">+{formatCurrency(vsBase)}</span>
                        )}
                      </td>
                      <td className="py-2 text-green-600 font-medium">
                        {formatCurrency(quote.profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};