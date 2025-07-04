import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart
} from 'lucide-react';
import { ProcessingResult, QuoteWithPricing } from '../types';
import { formatCurrency } from '../utils/pricingCalculator';

interface ProfitAnalyzerProps {
  results: ProcessingResult[];
  targetMargin?: number;
}

export const ProfitAnalyzer: React.FC<ProfitAnalyzerProps> = ({ 
  results, 
  targetMargin = 20 
}) => {
  const analysis = useMemo(() => {
    const successfulResults = results.filter(r => r.status === 'success' && r.quotes.length > 0);
    const allQuotes = successfulResults.flatMap(r => r.quotes) as QuoteWithPricing[];
    
    if (allQuotes.length === 0) {
      return {
        totalQuotes: 0,
        totalRevenue: 0,
        totalProfit: 0,
        avgMargin: 0,
        marginDistribution: [],
        profitByCarrier: [],
        marginTrends: [],
        riskAnalysis: {
          lowMarginQuotes: 0,
          highRiskQuotes: 0,
          recommendations: []
        }
      };
    }

    const totalRevenue = allQuotes.reduce((sum, q) => sum + q.customerPrice, 0);
    const totalProfit = allQuotes.reduce((sum, q) => sum + q.profit, 0);
    const avgMargin = (totalProfit / totalRevenue) * 100;

    // Margin distribution
    const marginBuckets = [
      { range: '0-10%', min: 0, max: 10 },
      { range: '10-15%', min: 10, max: 15 },
      { range: '15-20%', min: 15, max: 20 },
      { range: '20-25%', min: 20, max: 25 },
      { range: '25%+', min: 25, max: 100 }
    ];

    const marginDistribution = marginBuckets.map(bucket => {
      const quotesInBucket = allQuotes.filter(q => {
        const margin = (q.profit / q.customerPrice) * 100;
        return margin >= bucket.min && margin < bucket.max;
      });
      return {
        ...bucket,
        count: quotesInBucket.length,
        percentage: (quotesInBucket.length / allQuotes.length) * 100,
        revenue: quotesInBucket.reduce((sum, q) => sum + q.customerPrice, 0)
      };
    });

    // Profit by carrier
    const carrierMap = new Map<string, { quotes: QuoteWithPricing[], revenue: number, profit: number }>();
    allQuotes.forEach(quote => {
      const carrierName = quote.carrier.name;
      if (!carrierMap.has(carrierName)) {
        carrierMap.set(carrierName, { quotes: [], revenue: 0, profit: 0 });
      }
      const carrier = carrierMap.get(carrierName)!;
      carrier.quotes.push(quote);
      carrier.revenue += quote.customerPrice;
      carrier.profit += quote.profit;
    });

    const profitByCarrier = Array.from(carrierMap.entries())
      .map(([name, data]) => ({
        name,
        quoteCount: data.quotes.length,
        revenue: data.revenue,
        profit: data.profit,
        avgMargin: (data.profit / data.revenue) * 100,
        marketShare: (data.revenue / totalRevenue) * 100
      }))
      .sort((a, b) => b.profit - a.profit);

    // Risk analysis
    const lowMarginQuotes = allQuotes.filter(q => (q.profit / q.customerPrice) * 100 < targetMargin * 0.75);
    const highRiskQuotes = allQuotes.filter(q => (q.profit / q.customerPrice) * 100 < 10);

    const recommendations = [];
    if (lowMarginQuotes.length > allQuotes.length * 0.3) {
      recommendations.push('Consider increasing markup rates - 30%+ of quotes below target margin');
    }
    if (highRiskQuotes.length > 0) {
      recommendations.push(`${highRiskQuotes.length} quotes with margins below 10% - review pricing strategy`);
    }
    if (avgMargin < targetMargin) {
      recommendations.push(`Average margin (${avgMargin.toFixed(1)}%) below target (${targetMargin}%)`);
    }

    return {
      totalQuotes: allQuotes.length,
      totalRevenue,
      totalProfit,
      avgMargin,
      marginDistribution,
      profitByCarrier,
      riskAnalysis: {
        lowMarginQuotes: lowMarginQuotes.length,
        highRiskQuotes: highRiskQuotes.length,
        recommendations
      }
    };
  }, [results, targetMargin]);

  if (analysis.totalQuotes === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
        <p className="text-gray-600">Process some quotes to see profit analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analysis.totalRevenue)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Profit</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(analysis.totalProfit)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Margin</p>
              <p className={`text-2xl font-bold ${analysis.avgMargin >= targetMargin ? 'text-green-600' : 'text-orange-600'}`}>
                {analysis.avgMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">Target: {targetMargin}%</p>
            </div>
            <Target className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Risk Quotes</p>
              <p className="text-2xl font-bold text-red-600">{analysis.riskAnalysis.highRiskQuotes}</p>
              <p className="text-xs text-gray-500">Below 10% margin</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Margin Distribution */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Margin Distribution</h3>
        <div className="space-y-4">
          {analysis.marginDistribution.map((bucket, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 w-20">{bucket.range}</span>
              <div className="flex-1 mx-4">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div 
                    className={`h-4 rounded-full ${
                      index === 0 ? 'bg-red-500' :
                      index === 1 ? 'bg-orange-500' :
                      index === 2 ? 'bg-yellow-500' :
                      index === 3 ? 'bg-green-500' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${bucket.percentage}%` }}
                  />
                </div>
              </div>
              <div className="text-right w-32">
                <div className="text-sm font-medium text-gray-900">{bucket.count} quotes</div>
                <div className="text-xs text-gray-500">{formatCurrency(bucket.revenue)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Carriers by Profit */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Profit by Carrier</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Carrier</th>
                <th className="text-left py-2">Quotes</th>
                <th className="text-left py-2">Revenue</th>
                <th className="text-left py-2">Profit</th>
                <th className="text-left py-2">Avg Margin</th>
                <th className="text-left py-2">Market Share</th>
              </tr>
            </thead>
            <tbody>
              {analysis.profitByCarrier.slice(0, 10).map((carrier, index) => (
                <tr key={carrier.name} className="border-b">
                  <td className="py-2">
                    <div className="flex items-center space-x-2">
                      {index < 3 && <Award className="h-4 w-4 text-yellow-500" />}
                      <span className="font-medium">{carrier.name}</span>
                    </div>
                  </td>
                  <td className="py-2">{carrier.quoteCount}</td>
                  <td className="py-2 font-medium">{formatCurrency(carrier.revenue)}</td>
                  <td className="py-2 font-bold text-green-600">{formatCurrency(carrier.profit)}</td>
                  <td className="py-2">
                    <span className={`font-medium ${
                      carrier.avgMargin >= targetMargin ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {carrier.avgMargin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2">{carrier.marketShare.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk Analysis & Recommendations */}
      {analysis.riskAnalysis.recommendations.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-amber-900 mb-2">Recommendations</h3>
              <ul className="space-y-2">
                {analysis.riskAnalysis.recommendations.map((rec, index) => (
                  <li key={index} className="text-amber-800 text-sm">• {rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};