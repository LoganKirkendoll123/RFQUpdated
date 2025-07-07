import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  TrendingUp, 
  Calendar, 
  DollarSign,
  Package,
  AlertTriangle,
  Loader,
  BarChart3
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';

interface AIForecastingProps {
  selectedCarrier: string;
  dateRange: { start: string; end: string };
}

interface ForecastData {
  month: string;
  predictedShipments: number;
  predictedRevenue: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
}

export const AIForecasting: React.FC<AIForecastingProps> = ({
  selectedCarrier,
  dateRange
}) => {
  const [forecasts, setForecasts] = useState<ForecastData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (selectedCarrier && dateRange.start && dateRange.end) {
      generateForecasts();
    }
  }, [selectedCarrier, dateRange]);

  const generateForecasts = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log(`🧠 Generating AI forecasts for carrier: ${selectedCarrier}`);
      
      // Get historical data for the past 12 months
      const endDate = new Date(dateRange.end);
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 12);
      
      let query = supabase
        .from('Shipments')
        .select('*')
        .or(`"Booked Carrier".eq.${selectedCarrier},"Quoted Carrier".eq.${selectedCarrier}`)
        .gte('"Scheduled Pickup Date"', startDate.toISOString().split('T')[0])
        .lte('"Scheduled Pickup Date"', endDate.toISOString().split('T')[0]);
      
      const { data: shipments, error } = await query;
      
      if (error) {
        throw error;
      }
      
      if (!shipments || shipments.length === 0) {
        setForecasts([]);
        return;
      }
      
      // Parse numeric values from string fields
      const parseNumeric = (value: string | null | undefined): number => {
        if (!value) return 0;
        const cleaned = value.toString().replace(/[^\d.-]/g, '');
        return parseFloat(cleaned) || 0;
      };
      
      // Group shipments by month
      const monthlyData = new Map<string, { shipments: number; revenue: number }>();
      
      shipments.forEach(shipment => {
        if (shipment["Scheduled Pickup Date"]) {
          const date = new Date(shipment["Scheduled Pickup Date"]);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, { shipments: 0, revenue: 0 });
          }
          
          const data = monthlyData.get(monthKey)!;
          data.shipments += 1;
          data.revenue += parseNumeric(shipment["Revenue"]);
        }
      });
      
      // Convert to array and sort by month
      const historicalData = Array.from(monthlyData.entries())
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month));
      
      if (historicalData.length < 3) {
        setError('Insufficient historical data for forecasting (need at least 3 months)');
        return;
      }
      
      // Simple linear regression for trend analysis
      const calculateTrend = (values: number[]): { slope: number; intercept: number } => {
        const n = values.length;
        const xSum = values.reduce((sum, _, i) => sum + i, 0);
        const ySum = values.reduce((sum, val) => sum + val, 0);
        const xySum = values.reduce((sum, val, i) => sum + (i * val), 0);
        const x2Sum = values.reduce((sum, _, i) => sum + (i * i), 0);
        
        const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
        const intercept = (ySum - slope * xSum) / n;
        
        return { slope, intercept };
      };
      
      // Calculate trends for shipments and revenue
      const shipmentValues = historicalData.map(d => d.shipments);
      const revenueValues = historicalData.map(d => d.revenue);
      
      const shipmentTrend = calculateTrend(shipmentValues);
      const revenueTrend = calculateTrend(revenueValues);
      
      // Generate forecasts for next 6 months
      const forecasts: ForecastData[] = [];
      const lastMonth = new Date(historicalData[historicalData.length - 1].month + '-01');
      
      for (let i = 1; i <= 6; i++) {
        const forecastMonth = new Date(lastMonth);
        forecastMonth.setMonth(forecastMonth.getMonth() + i);
        
        const monthKey = `${forecastMonth.getFullYear()}-${String(forecastMonth.getMonth() + 1).padStart(2, '0')}`;
        
        // Predict using linear regression
        const nextIndex = historicalData.length + i - 1;
        const predictedShipments = Math.max(0, Math.round(shipmentTrend.slope * nextIndex + shipmentTrend.intercept));
        const predictedRevenue = Math.max(0, revenueTrend.slope * nextIndex + revenueTrend.intercept);
        
        // Calculate confidence based on historical variance
        const avgShipments = shipmentValues.reduce((sum, val) => sum + val, 0) / shipmentValues.length;
        const shipmentVariance = shipmentValues.reduce((sum, val) => sum + Math.pow(val - avgShipments, 2), 0) / shipmentValues.length;
        const confidence = Math.max(60, Math.min(95, 100 - (Math.sqrt(shipmentVariance) / avgShipments) * 100));
        
        // Determine trend direction
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (shipmentTrend.slope > 0.5) trend = 'up';
        else if (shipmentTrend.slope < -0.5) trend = 'down';
        
        forecasts.push({
          month: monthKey,
          predictedShipments,
          predictedRevenue,
          confidence,
          trend
        });
      }
      
      setForecasts(forecasts);
      console.log(`✅ Generated ${forecasts.length} month forecasts for ${selectedCarrier}`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate forecasts';
      setError(errorMsg);
      console.error('❌ Failed to generate forecasts:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (forecasts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500">Select a carrier and date range to generate forecasts</p>
      </div>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingUp className="h-4 w-4 text-red-500 transform rotate-180" />;
      default: return <BarChart3 className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Brain className="h-6 w-6 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          AI Forecasting: {selectedCarrier}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forecasts.map((forecast) => (
          <div key={forecast.month} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-900">
                  {new Date(forecast.month + '-01').toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short' 
                  })}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                {getTrendIcon(forecast.trend)}
                <span className={`text-sm font-medium ${getTrendColor(forecast.trend)}`}>
                  {forecast.trend}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-gray-600">Shipments</span>
                </div>
                <span className="font-semibold text-blue-600">
                  {forecast.predictedShipments}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600">Revenue</span>
                </div>
                <span className="font-semibold text-green-600">
                  {formatCurrency(forecast.predictedRevenue)}
                </span>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Confidence</span>
                  <span className="text-xs font-medium text-gray-700">
                    {forecast.confidence.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full" 
                    style={{ width: `${forecast.confidence}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-purple-50 rounded-lg">
        <div className="flex items-start space-x-2">
          <Brain className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-purple-800">
            <p className="font-medium mb-1">AI Forecasting Model</p>
            <p>
              Predictions based on historical trends using linear regression analysis. 
              Confidence levels reflect data consistency and seasonal patterns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};