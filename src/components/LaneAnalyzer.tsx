import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Truck, 
  BarChart3,
  Search,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { useDebounce } from '../hooks/useDebounce';
import { showSuccessToast, showErrorToast } from './Toast';

interface LaneData {
  origin: string;
  destination: string;
  shipmentCount: number;
  totalRevenue: number;
  totalProfit: number;
  avgPrice: number;
  avgProfit: number;
  avgMargin: number;
  avgTransitDays: number;
  topCarrier: string;
  competitiveIndex: number;
}

export const LaneAnalyzer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [lanes, setLanes] = useState<LaneData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'shipments' | 'revenue' | 'margin' | 'transit'>('shipments');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [timeframe, setTimeframe] = useState<'30' | '90' | '365' | 'all'>('90');
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    loadLaneData();
  }, [timeframe]);

  const loadLaneData = async () => {
    setLoading(true);
    try {
      // Get shipment data from Supabase
      let query = supabase.from('Shipments').select('*');
      
      // Apply timeframe filter if not 'all'
      if (timeframe !== 'all') {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeframe));
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
        
        query = query.gte('"Scheduled Pickup Date"', cutoffDateStr);
      }
      
      const { data: shipments, error } = await query;
      
      if (error) {
        throw error;
      }
      
      if (!shipments || shipments.length === 0) {
        setLanes([]);
        return;
      }
      
      // Group shipments by lane (origin-destination pair)
      const laneMap = new Map<string, any[]>();
      
      shipments.forEach(shipment => {
        const originZip = shipment["Zip"];
        const destZip = shipment["Zip_1"];
        
        if (!originZip || !destZip) return;
        
        const laneKey = `${originZip}-${destZip}`;
        if (!laneMap.has(laneKey)) {
          laneMap.set(laneKey, []);
        }
        
        laneMap.get(laneKey)!.push(shipment);
      });
      
      // Calculate metrics for each lane
      const laneData: LaneData[] = [];
      
      laneMap.forEach((laneShipments, laneKey) => {
        const [origin, destination] = laneKey.split('-');
        
        // Parse numeric values
        const parseNumeric = (value: string | null | undefined): number => {
          if (!value) return 0;
          const cleaned = value.toString().replace(/[^\d.-]/g, '');
          return parseFloat(cleaned) || 0;
        };
        
        const totalRevenue = laneShipments.reduce((sum, s) => sum + parseNumeric(s["Revenue"]), 0);
        const totalProfit = laneShipments.reduce((sum, s) => sum + parseNumeric(s["Profit"]), 0);
        
        // Calculate transit days (if available)
        const shipmentsWithTransit = laneShipments.filter(s => 
          s["Scheduled Delivery Date"] && s["Scheduled Pickup Date"]
        );
        
        let avgTransitDays = 0;
        if (shipmentsWithTransit.length > 0) {
          const transitDays = shipmentsWithTransit.map(s => {
            const pickupDate = new Date(s["Scheduled Pickup Date"]);
            const deliveryDate = new Date(s["Scheduled Delivery Date"]);
            return Math.round((deliveryDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24));
          });
          
          avgTransitDays = transitDays.reduce((sum, days) => sum + days, 0) / transitDays.length;
        }
        
        // Find top carrier
        const carrierCounts = new Map<string, number>();
        laneShipments.forEach(s => {
          const carrier = s["Booked Carrier"] || s["Quoted Carrier"];
          if (!carrier) return;
          
          carrierCounts.set(carrier, (carrierCounts.get(carrier) || 0) + 1);
        });
        
        let topCarrier = 'Unknown';
        let maxCount = 0;
        carrierCounts.forEach((count, carrier) => {
          if (count > maxCount) {
            maxCount = count;
            topCarrier = carrier;
          }
        });
        
        // Calculate competitive index (0-100)
        // Higher is better - based on profit margin and transit time
        const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        const competitiveIndex = Math.min(100, Math.max(0, 
          (avgMargin * 3) + (avgTransitDays > 0 ? (5 / avgTransitDays) * 20 : 0)
        ));
        
        laneData.push({
          origin,
          destination,
          shipmentCount: laneShipments.length,
          totalRevenue,
          totalProfit,
          avgPrice: totalRevenue / laneShipments.length,
          avgProfit: totalProfit / laneShipments.length,
          avgMargin,
          avgTransitDays,
          topCarrier,
          competitiveIndex
        });
      });
      
      setLanes(laneData);
      showSuccessToast(`Loaded ${laneData.length} lanes from ${shipments.length} shipments`);
    } catch (error) {
      console.error('Failed to load lane data:', error);
      showErrorToast('Failed to load lane data');
    } finally {
      setLoading(false);
    }
  };

  const filteredLanes = useMemo(() => {
    if (!debouncedSearchTerm) return lanes;
    
    return lanes.filter(lane => 
      lane.origin.includes(debouncedSearchTerm) ||
      lane.destination.includes(debouncedSearchTerm) ||
      lane.topCarrier.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [lanes, debouncedSearchTerm]);

  const sortedLanes = useMemo(() => {
    return [...filteredLanes].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'shipments':
          comparison = a.shipmentCount - b.shipmentCount;
          break;
        case 'revenue':
          comparison = a.totalRevenue - b.totalRevenue;
          break;
        case 'margin':
          comparison = a.avgMargin - b.avgMargin;
          break;
        case 'transit':
          comparison = a.avgTransitDays - b.avgTransitDays;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredLanes, sortBy, sortOrder]);

  const exportLaneData = () => {
    const csvContent = [
      ['Origin', 'Destination', 'Shipments', 'Total Revenue', 'Total Profit', 'Avg Price', 'Avg Profit', 'Avg Margin', 'Avg Transit', 'Top Carrier', 'Competitive Index'].join(','),
      ...sortedLanes.map(lane => [
        lane.origin,
        lane.destination,
        lane.shipmentCount,
        lane.totalRevenue,
        lane.totalProfit,
        lane.avgPrice,
        lane.avgProfit,
        lane.avgMargin.toFixed(1) + '%',
        lane.avgTransitDays.toFixed(1),
        lane.topCarrier,
        lane.competitiveIndex.toFixed(0)
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lane-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getCompetitiveIndexColor = (index: number) => {
    if (index >= 80) return 'text-green-600';
    if (index >= 60) return 'text-blue-600';
    if (index >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Lane Performance Analysis</h2>
              <p className="text-sm text-gray-600">
                Analyze profitability and performance by shipping lane
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="365">Last Year</option>
              <option value="all">All Time</option>
            </select>
            
            <button
              onClick={loadLaneData}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>Refresh</span>
            </button>
            
            <button
              onClick={exportLaneData}
              disabled={lanes.length === 0 || loading}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ZIP or carrier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
              <option value="shipments">Shipment Volume</option>
              <option value="revenue">Total Revenue</option>
              <option value="margin">Profit Margin</option>
              <option value="transit">Transit Time</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Lane Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lane</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shipments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Top Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedLanes.map((lane, index) => (
                <tr key={`${lane.origin}-${lane.destination}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-indigo-500" />
                      <span className="font-medium text-gray-900">
                        {lane.origin} → {lane.destination}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lane.shipmentCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(lane.totalRevenue)}</div>
                    <div className="text-xs text-green-600">
                      Profit: {formatCurrency(lane.totalProfit)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(lane.avgPrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${
                      lane.avgMargin >= 20 ? 'text-green-600' :
                      lane.avgMargin >= 15 ? 'text-blue-600' :
                      lane.avgMargin >= 10 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {lane.avgMargin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lane.avgTransitDays > 0 ? `${lane.avgTransitDays.toFixed(1)} days` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Truck className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{lane.topCarrier}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            lane.competitiveIndex >= 80 ? 'bg-green-500' :
                            lane.competitiveIndex >= 60 ? 'bg-blue-500' :
                            lane.competitiveIndex >= 40 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${lane.competitiveIndex}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium ${getCompetitiveIndexColor(lane.competitiveIndex)}`}>
                        {lane.competitiveIndex.toFixed(0)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="flex items-center space-x-2 text-gray-500">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Loading lane data...</span>
            </div>
          </div>
        )}
        
        {!loading && sortedLanes.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Lane Data Available</h3>
            <p className="text-gray-600">
              {debouncedSearchTerm ? 'No lanes match your search criteria.' : 'No shipment data found for the selected timeframe.'}
            </p>
          </div>
        )}
      </div>

      {/* Lane Insights */}
      {sortedLanes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Performing Lanes */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span>Top Performing Lanes</span>
            </h3>
            
            <div className="space-y-4">
              {sortedLanes
                .sort((a, b) => b.avgMargin - a.avgMargin)
                .slice(0, 5)
                .map((lane, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <span className="font-medium text-gray-900">
                        {lane.origin} → {lane.destination}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-600">{lane.avgMargin.toFixed(1)}%</div>
                      <div className="text-xs text-gray-500">{lane.shipmentCount} shipments</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          
          {/* Lanes Needing Attention */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span>Lanes Needing Attention</span>
            </h3>
            
            <div className="space-y-4">
              {sortedLanes
                .filter(lane => lane.shipmentCount >= 3) // Only consider lanes with enough volume
                .sort((a, b) => a.avgMargin - b.avgMargin)
                .slice(0, 5)
                .map((lane, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        !
                      </div>
                      <span className="font-medium text-gray-900">
                        {lane.origin} → {lane.destination}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-600">{lane.avgMargin.toFixed(1)}%</div>
                      <div className="text-xs text-gray-500">{formatCurrency(lane.avgPrice)} avg</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};