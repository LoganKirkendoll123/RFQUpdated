import React, { useState, useEffect } from 'react';
import { 
  Award, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Clock, 
  Package,
  AlertTriangle,
  CheckCircle,
  Loader
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';

interface CarrierScorecardProps {
  selectedCarrier: string;
  dateRange: { start: string; end: string };
}

interface ScorecardMetrics {
  totalShipments: number;
  totalRevenue: number;
  totalProfit: number;
  avgMargin: number;
  onTimePickup: number;
  onTimeDelivery: number;
  avgTransitDays: number;
  totalWeight: number;
  avgRevenuePerShipment: number;
  profitMargin: number;
}

export const CarrierScorecard: React.FC<CarrierScorecardProps> = ({
  selectedCarrier,
  dateRange
}) => {
  const [metrics, setMetrics] = useState<ScorecardMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (selectedCarrier && dateRange.start && dateRange.end) {
      loadScorecardMetrics();
    }
  }, [selectedCarrier, dateRange]);

  const loadScorecardMetrics = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log(`📊 Loading scorecard metrics for carrier: ${selectedCarrier}`);
      
      let query = supabase
        .from('Shipments')
        .select('*')
        .or(`"Booked Carrier".eq.${selectedCarrier},"Quoted Carrier".eq.${selectedCarrier}`)
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end);
      
      const { data: shipments, error } = await query;
      
      if (error) {
        throw error;
      }
      
      if (!shipments || shipments.length === 0) {
        setMetrics({
          totalShipments: 0,
          totalRevenue: 0,
          totalProfit: 0,
          avgMargin: 0,
          onTimePickup: 0,
          onTimeDelivery: 0,
          avgTransitDays: 0,
          totalWeight: 0,
          avgRevenuePerShipment: 0,
          profitMargin: 0
        });
        return;
      }
      
      // Parse numeric values from string fields
      const parseNumeric = (value: string | null | undefined): number => {
        if (!value) return 0;
        const cleaned = value.toString().replace(/[^\d.-]/g, '');
        return parseFloat(cleaned) || 0;
      };
      
      // Calculate metrics
      const totalShipments = shipments.length;
      const totalRevenue = shipments.reduce((sum, s) => sum + parseNumeric(s["Revenue"]), 0);
      const totalProfit = shipments.reduce((sum, s) => sum + parseNumeric(s["Profit"]), 0);
      const totalWeight = shipments.reduce((sum, s) => sum + parseNumeric(s["Tot Weight"]), 0);
      
      // Calculate on-time performance with 1 buffer day (excluding weekends)
      const addBusinessDays = (date: Date, days: number): Date => {
        const result = new Date(date);
        let addedDays = 0;
        
        while (addedDays < days) {
          result.setDate(result.getDate() + 1);
          // Skip weekends
          if (result.getDay() !== 0 && result.getDay() !== 6) {
            addedDays++;
          }
        }
        
        return result;
      };
      
      let onTimePickups = 0;
      let onTimeDeliveries = 0;
      let validPickupDates = 0;
      let validDeliveryDates = 0;
      let totalTransitDays = 0;
      let validTransitDays = 0;
      
      shipments.forEach(shipment => {
        // On-time pickup calculation
        if (shipment["Scheduled Pickup Date"] && shipment["Actual Pickup Date"]) {
          const scheduledPickup = new Date(shipment["Scheduled Pickup Date"]);
          const actualPickup = new Date(shipment["Actual Pickup Date"]);
          const allowedPickup = addBusinessDays(scheduledPickup, 1); // 1 buffer day
          
          validPickupDates++;
          if (actualPickup <= allowedPickup) {
            onTimePickups++;
          }
        }
        
        // On-time delivery calculation
        if (shipment["Scheduled Delivery Date"] && shipment["Actual Delivery Date"]) {
          const scheduledDelivery = new Date(shipment["Scheduled Delivery Date"]);
          const actualDelivery = new Date(shipment["Actual Delivery Date"]);
          const allowedDelivery = addBusinessDays(scheduledDelivery, 1); // 1 buffer day
          
          validDeliveryDates++;
          if (actualDelivery <= allowedDelivery) {
            onTimeDeliveries++;
          }
        }
        
        // Transit days calculation
        if (shipment["Actual Pickup Date"] && shipment["Actual Delivery Date"]) {
          const pickup = new Date(shipment["Actual Pickup Date"]);
          const delivery = new Date(shipment["Actual Delivery Date"]);
          const transitMs = delivery.getTime() - pickup.getTime();
          const transitDays = Math.ceil(transitMs / (1000 * 60 * 60 * 24));
          
          if (transitDays > 0 && transitDays < 30) { // Reasonable range
            totalTransitDays += transitDays;
            validTransitDays++;
          }
        }
      });
      
      const onTimePickup = validPickupDates > 0 ? (onTimePickups / validPickupDates) * 100 : 0;
      const onTimeDelivery = validDeliveryDates > 0 ? (onTimeDeliveries / validDeliveryDates) * 100 : 0;
      const avgTransitDays = validTransitDays > 0 ? totalTransitDays / validTransitDays : 0;
      const avgRevenuePerShipment = totalShipments > 0 ? totalRevenue / totalShipments : 0;
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      const avgMargin = profitMargin; // Same as profit margin for now
      
      setMetrics({
        totalShipments,
        totalRevenue,
        totalProfit,
        avgMargin,
        onTimePickup,
        onTimeDelivery,
        avgTransitDays,
        totalWeight,
        avgRevenuePerShipment,
        profitMargin
      });
      
      console.log(`✅ Loaded scorecard metrics for ${selectedCarrier}:`, {
        totalShipments,
        totalRevenue,
        totalProfit,
        onTimePickup: `${onTimePickup.toFixed(1)}%`,
        onTimeDelivery: `${onTimeDelivery.toFixed(1)}%`
      });
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load scorecard metrics';
      setError(errorMsg);
      console.error('❌ Failed to load scorecard metrics:', err);
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

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500">Select a carrier and date range to view scorecard</p>
      </div>
    );
  }

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 95) return 'text-green-600';
    if (percentage >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceIcon = (percentage: number) => {
    if (percentage >= 95) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (percentage >= 85) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Award className="h-6 w-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Carrier Scorecard: {selectedCarrier}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Financial Metrics */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">Revenue</span>
          </div>
          <div className="text-2xl font-bold text-green-900">
            {formatCurrency(metrics.totalRevenue)}
          </div>
          <div className="text-sm text-green-700">
            {formatCurrency(metrics.avgRevenuePerShipment)} avg/shipment
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Profit</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {formatCurrency(metrics.totalProfit)}
          </div>
          <div className="text-sm text-blue-700">
            {metrics.profitMargin.toFixed(1)}% margin
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            {getPerformanceIcon(metrics.onTimePickup)}
            <span className="text-sm font-medium text-purple-800">On-Time Pickup</span>
          </div>
          <div className={`text-2xl font-bold ${getPerformanceColor(metrics.onTimePickup)}`}>
            {metrics.onTimePickup.toFixed(1)}%
          </div>
          <div className="text-sm text-purple-700">
            +1 buffer day (excl. weekends)
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            {getPerformanceIcon(metrics.onTimeDelivery)}
            <span className="text-sm font-medium text-orange-800">On-Time Delivery</span>
          </div>
          <div className={`text-2xl font-bold ${getPerformanceColor(metrics.onTimeDelivery)}`}>
            {metrics.onTimeDelivery.toFixed(1)}%
          </div>
          <div className="text-sm text-orange-700">
            +1 buffer day (excl. weekends)
          </div>
        </div>

        {/* Volume Metrics */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Package className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-800">Shipments</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {metrics.totalShipments}
          </div>
          <div className="text-sm text-gray-700">
            {metrics.totalWeight.toLocaleString()} lbs total
          </div>
        </div>

        <div className="bg-indigo-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-5 w-5 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-800">Avg Transit</span>
          </div>
          <div className="text-2xl font-bold text-indigo-900">
            {metrics.avgTransitDays.toFixed(1)}
          </div>
          <div className="text-sm text-indigo-700">
            days
          </div>
        </div>

        {/* Overall Grade */}
        <div className="bg-yellow-50 rounded-lg p-4 md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <Award className="h-5 w-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">Overall Grade</span>
          </div>
          <div className="text-2xl font-bold text-yellow-900">
            {(() => {
              const avgPerformance = (metrics.onTimePickup + metrics.onTimeDelivery) / 2;
              if (avgPerformance >= 95) return 'A+';
              if (avgPerformance >= 90) return 'A';
              if (avgPerformance >= 85) return 'B+';
              if (avgPerformance >= 80) return 'B';
              if (avgPerformance >= 75) return 'C+';
              if (avgPerformance >= 70) return 'C';
              return 'D';
            })()}
          </div>
          <div className="text-sm text-yellow-700">
            Based on on-time performance
          </div>
        </div>
      </div>
    </div>
  );
};