// Analytics and tracking utilities for 3PL operations

export interface ShipmentMetrics {
  totalShipments: number;
  totalRevenue: number;
  totalProfit: number;
  avgMargin: number;
  avgTransitTime: number;
  onTimeDeliveryRate: number;
  carrierPerformance: CarrierMetrics[];
  laneAnalysis: LaneMetrics[];
  seasonalTrends: SeasonalData[];
}

export interface CarrierMetrics {
  name: string;
  shipmentCount: number;
  revenue: number;
  avgPrice: number;
  onTimeRate: number;
  damageRate: number;
  customerSatisfaction: number;
  marketShare: number;
}

export interface LaneMetrics {
  origin: string;
  destination: string;
  shipmentCount: number;
  avgPrice: number;
  avgTransitTime: number;
  competitiveIndex: number;
  profitability: number;
}

export interface SeasonalData {
  period: string;
  volume: number;
  avgPrice: number;
  profitMargin: number;
}

export const calculateKPIs = (shipments: any[]): ShipmentMetrics => {
  if (shipments.length === 0) {
    return {
      totalShipments: 0,
      totalRevenue: 0,
      totalProfit: 0,
      avgMargin: 0,
      avgTransitTime: 0,
      onTimeDeliveryRate: 0,
      carrierPerformance: [],
      laneAnalysis: [],
      seasonalTrends: []
    };
  }

  const totalRevenue = shipments.reduce((sum, s) => sum + (s.revenue || 0), 0);
  const totalProfit = shipments.reduce((sum, s) => sum + (s.profit || 0), 0);
  const avgMargin = totalRevenue >  0 ? (totalProfit / totalRevenue) * 100 : 0;
  
  // Group by carrier
  const carrierMap = new Map<string, any[]>();
  shipments.forEach(shipment => {
    const carrier = shipment.carrier || 'Unknown';
    if (!carrierMap.has(carrier)) {
      carrierMap.set(carrier, []);
    }
    carrierMap.get(carrier)!.push(shipment);
  });
  
  const carrierPerformance: CarrierMetrics[] = Array.from(carrierMap.entries())
    .map(([name, shipments]) => {
      const revenue = shipments.reduce((sum, s) => sum + (s.revenue || 0), 0);
      return {
        name,
        shipmentCount: shipments.length,
        revenue,
        avgPrice: revenue / shipments.length,
        onTimeRate: shipments.filter(s => s.onTime).length / shipments.length * 100,
        damageRate: shipments.filter(s => s.damaged).length / shipments.length * 100,
        customerSatisfaction: shipments.reduce((sum, s) => sum + (s.satisfaction || 0), 0) / shipments.length,
        marketShare: revenue / totalRevenue * 100
      };
    })
    .sort((a, b) => b.shipmentCount - a.shipmentCount);
  
  // Group by lane
  const laneMap = new Map<string, any[]>();
  shipments.forEach(shipment => {
    const lane = `${shipment.origin || 'Unknown'}-${shipment.destination || 'Unknown'}`;
    if (!laneMap.has(lane)) {
      laneMap.set(lane, []);
    }
    laneMap.get(lane)!.push(shipment);
  });
  
  const laneAnalysis: LaneMetrics[] = Array.from(laneMap.entries())
    .map(([lane, shipments]) => {
      const [origin, destination] = lane.split('-');
      const avgPrice = shipments.reduce((sum, s) => sum + (s.price || 0), 0) / shipments.length;
      const avgTransitTime = shipments.reduce((sum, s) => sum + (s.transitTime || 0), 0) / shipments.length;
      const revenue = shipments.reduce((sum, s) => sum + (s.revenue || 0), 0);
      const profit = shipments.reduce((sum, s) => sum + (s.profit || 0), 0);
      
      return {
        origin,
        destination,
        shipmentCount: shipments.length,
        avgPrice,
        avgTransitTime,
        competitiveIndex: 0, // Would need market data to calculate
        profitability: revenue > 0 ? (profit / revenue) * 100 : 0
      };
    })
    .sort((a, b) => b.shipmentCount - a.shipmentCount);
  
  // Group by month for seasonal trends
  const periodMap = new Map<string, any[]>();
  shipments.forEach(shipment => {
    const date = new Date(shipment.date);
    const period = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    if (!periodMap.has(period)) {
      periodMap.set(period, []);
    }
    periodMap.get(period)!.push(shipment);
  });
  
  const seasonalTrends: SeasonalData[] = Array.from(periodMap.entries())
    .map(([period, shipments]) => {
      const revenue = shipments.reduce((sum, s) => sum + (s.revenue || 0), 0);
      const profit = shipments.reduce((sum, s) => sum + (s.profit || 0), 0);
      
      return {
        period,
        volume: shipments.length,
        avgPrice: revenue / shipments.length,
        profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));
  
  return {
    totalShipments: shipments.length,
    totalRevenue,
    totalProfit,
    avgMargin,
    avgTransitTime: shipments.reduce((sum, s) => sum + (s.transitTime || 0), 0) / shipments.length,
    onTimeDeliveryRate: shipments.filter(s => s.onTime).length / shipments.length * 100,
    carrierPerformance,
    laneAnalysis,
    seasonalTrends
  };
};

export const generatePerformanceReport = (metrics: ShipmentMetrics): string => {
  const report = [
    '# 3PL Performance Report',
    '',
    `Generated: ${new Date().toLocaleDateString()}`,
    '',
    '## Summary Metrics',
    `- Total Shipments: ${metrics.totalShipments}`,
    `- Total Revenue: $${metrics.totalRevenue.toLocaleString()}`,
    `- Total Profit: $${metrics.totalProfit.toLocaleString()}`,
    `- Average Margin: ${metrics.avgMargin.toFixed(2)}%`,
    `- Average Transit Time: ${metrics.avgTransitTime.toFixed(1)} days`,
    `- On-Time Delivery Rate: ${metrics.onTimeDeliveryRate.toFixed(1)}%`,
    '',
    '## Top Carriers',
    ...metrics.carrierPerformance.slice(0, 5).map(c => 
      `- ${c.name}: ${c.shipmentCount} shipments, $${c.avgPrice.toLocaleString()} avg price, ${c.onTimeRate.toFixed(1)}% on-time`
    ),
    '',
    '## Top Lanes',
    ...metrics.laneAnalysis.slice(0, 5).map(l => 
      `- ${l.origin} → ${l.destination}: ${l.shipmentCount} shipments, $${l.avgPrice.toLocaleString()} avg price, ${l.profitability.toFixed(1)}% margin`
    ),
    '',
    '## Recommendations',
    '- Focus on high-margin carriers for strategic lanes',
    '- Consider volume commitments with top carriers',
    '- Monitor seasonal trends for capacity planning',
    '- Implement carrier scorecards for performance tracking',
    ''
  ].join('\n');
  
  return report;
};