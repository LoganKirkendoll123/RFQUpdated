import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Users, 
  Truck,
  Play,
  Download,
  Loader,
  AlertCircle,
  CheckCircle,
  Info,
  DollarSign,
  Target,
  BarChart3
} from 'lucide-react';
import { Project44APIClient, CarrierGroup } from '../utils/apiClient';
import { loadProject44Config } from '../utils/credentialStorage';
import { formatCurrency } from '../utils/pricingCalculator';
import { RFQRow } from '../types';

interface MarginAnalysisResult {
  customerName: string;
  targetCarrierRate: number;
  competitorRates: Array<{
    carrierId: string;
    carrierName: string;
    rate: number;
    margin: number;
    customerPrice: number;
  }>;
  recommendedMargin: number;
  recommendedPrice: number;
  shipmentCount: number;
}

interface CarrierRate {
  carrierId: string;
  carrierName: string;
  rate: number | string;
  error?: string;
}

export const MarginAnalysisTools: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedTargetGroup, setSelectedTargetGroup] = useState('');
  const [selectedTargetCarrier, setSelectedTargetCarrier] = useState('');
  const [selectedCompetitorGroup, setSelectedCompetitorGroup] = useState('');
  const [results, setResults] = useState<MarginAnalysisResult[]>([]);
  const [error, setError] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [project44Client, setProject44Client] = useState<Project44APIClient | null>(null);

  // Sample shipment data for testing
  const sampleShipments: RFQRow[] = [
    {
      fromDate: '2025-01-15',
      fromZip: '60607',
      toZip: '30033',
      pallets: 3,
      grossWeight: 2500,
      isStackable: false,
      accessorial: [],
      isReefer: false,
      freightClass: '70',
      originCity: 'Chicago',
      originState: 'IL',
      destinationCity: 'Atlanta',
      destinationState: 'GA'
    },
    {
      fromDate: '2025-01-16',
      fromZip: '90210',
      toZip: '10001',
      pallets: 5,
      grossWeight: 4000,
      isStackable: true,
      accessorial: [],
      isReefer: false,
      freightClass: '85',
      originCity: 'Los Angeles',
      originState: 'CA',
      destinationCity: 'New York',
      destinationState: 'NY'
    }
  ];

  useEffect(() => {
    initializeClient();
  }, []);

  const initializeClient = async () => {
    const config = loadProject44Config();
    if (config) {
      const client = new Project44APIClient(config);
      setProject44Client(client);
      await loadCarrierGroups(client);
    } else {
      setError('Project44 configuration not found. Please configure your API credentials first.');
    }
  };

  const loadCarrierGroups = async (client: Project44APIClient) => {
    try {
      setIsLoading(true);
      setProcessingStatus('Loading carrier groups...');
      
      // Load all carrier groups (both standard and volume)
      const groups = await client.getAvailableCarriersByGroup(false, false);
      setCarrierGroups(groups);
      
      console.log(`✅ Loaded ${groups.length} carrier groups for margin analysis`);
      setProcessingStatus(`Loaded ${groups.length} carrier groups`);
    } catch (error) {
      console.error('❌ Failed to load carrier groups:', error);
      setError(`Failed to load carrier groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getCarriersInGroup = (groupCode: string): Array<{id: string, name: string}> => {
    const group = carrierGroups.find(g => g.groupCode === groupCode);
    return group ? group.carriers : [];
  };

  const runMarginAnalysis = async () => {
    if (!project44Client || !selectedTargetGroup || !selectedTargetCarrier || !selectedCompetitorGroup) {
      setError('Please select target carrier group, target carrier, and competitor group');
      return;
    }

    setIsLoading(true);
    setError('');
    setResults([]);
    
    try {
      setProcessingStatus('Starting margin analysis...');
      
      // Get all carriers in the competitor group
      const competitorCarriers = getCarriersInGroup(selectedCompetitorGroup);
      console.log(`🎯 Analyzing against ${competitorCarriers.length} competitors in group ${selectedCompetitorGroup}`);
      
      if (competitorCarriers.length === 0) {
        throw new Error(`No carriers found in competitor group: ${selectedCompetitorGroup}`);
      }

      const analysisResults: MarginAnalysisResult[] = [];

      // Process each sample shipment
      for (let i = 0; i < sampleShipments.length; i++) {
        const shipment = sampleShipments[i];
        setProcessingStatus(`Processing shipment ${i + 1} of ${sampleShipments.length}...`);
        
        console.log(`📦 Processing shipment: ${shipment.fromZip} → ${shipment.toZip}`);

        // Get target carrier rate
        setProcessingStatus(`Getting target carrier rate for shipment ${i + 1}...`);
        const targetRates = await project44Client.getQuotes(shipment, [selectedTargetCarrier], false, false, false);
        
        if (targetRates.length === 0) {
          console.warn(`⚠️ No rate from target carrier ${selectedTargetCarrier} for shipment ${i + 1}`);
          continue;
        }

        const targetRate = targetRates[0].baseRate + targetRates[0].fuelSurcharge + targetRates[0].premiumsAndDiscounts;
        console.log(`🎯 Target carrier rate: ${formatCurrency(targetRate)}`);

        // Get competitor rates
        setProcessingStatus(`Getting competitor rates for shipment ${i + 1}...`);
        const competitorRates: CarrierRate[] = [];
        
        // Process competitors in batches to avoid overwhelming the API
        const batchSize = 3;
        for (let j = 0; j < competitorCarriers.length; j += batchSize) {
          const batch = competitorCarriers.slice(j, j + batchSize);
          const batchCarrierIds = batch.map(c => c.id);
          
          setProcessingStatus(`Getting rates from competitors ${j + 1}-${Math.min(j + batchSize, competitorCarriers.length)} for shipment ${i + 1}...`);
          
          try {
            const batchQuotes = await project44Client.getQuotes(shipment, batchCarrierIds, false, false, false);
            
            // Process each quote in the batch
            for (const quote of batchQuotes) {
              const carrierInfo = batch.find(c => c.id === quote.carrierCode || c.name === quote.carrier.name);
              if (carrierInfo) {
                const rate = quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts;
                competitorRates.push({
                  carrierId: carrierInfo.id,
                  carrierName: carrierInfo.name,
                  rate: rate
                });
                console.log(`💰 ${carrierInfo.name}: ${formatCurrency(rate)}`);
              }
            }
          } catch (error) {
            console.warn(`⚠️ Failed to get rates for batch ${j + 1}-${Math.min(j + batchSize, competitorCarriers.length)}:`, error);
            // Continue with other batches
          }
          
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`📊 Got ${competitorRates.length} competitor rates out of ${competitorCarriers.length} possible`);

        // Filter out invalid rates and calculate margins
        const validCompetitorRates = competitorRates
          .filter(cr => typeof cr.rate === 'number' && cr.rate > 0)
          .map(cr => {
            const rate = cr.rate as number;
            // Assume 15% margin for competitors (this could be configurable)
            const margin = 15;
            const customerPrice = rate / (1 - margin / 100);
            
            return {
              carrierId: cr.carrierId,
              carrierName: cr.carrierName,
              rate: rate,
              margin: margin,
              customerPrice: customerPrice
            };
          });

        if (validCompetitorRates.length === 0) {
          console.warn(`⚠️ No valid competitor rates for shipment ${i + 1}`);
          continue;
        }

        // Find the lowest competitor customer price
        const lowestCompetitorPrice = Math.min(...validCompetitorRates.map(cr => cr.customerPrice));
        
        // Calculate recommended margin to match the lowest competitor
        const recommendedMargin = lowestCompetitorPrice > targetRate ? 
          ((lowestCompetitorPrice - targetRate) / lowestCompetitorPrice) * 100 : 0;

        analysisResults.push({
          customerName: `Customer-${i + 1}`, // In real implementation, this would come from shipment data
          targetCarrierRate: targetRate,
          competitorRates: validCompetitorRates,
          recommendedMargin: recommendedMargin,
          recommendedPrice: lowestCompetitorPrice,
          shipmentCount: 1
        });
      }

      setResults(analysisResults);
      setProcessingStatus(`Analysis complete! Processed ${analysisResults.length} shipments with competitor data.`);
      
      console.log(`✅ Margin analysis complete: ${analysisResults.length} results`);
      
    } catch (error) {
      console.error('❌ Margin analysis failed:', error);
      setError(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setProcessingStatus('Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const exportResults = () => {
    if (results.length === 0) return;
    
    // Create CSV content
    const headers = [
      'Customer Name',
      'Target Carrier Rate',
      'Lowest Competitor Price',
      'Recommended Margin %',
      'Recommended Price',
      'Competitor Count',
      'Shipment Count'
    ];
    
    const csvContent = [
      headers.join(','),
      ...results.map(result => [
        result.customerName,
        result.targetCarrierRate.toFixed(2),
        result.recommendedPrice.toFixed(2),
        result.recommendedMargin.toFixed(2),
        result.recommendedPrice.toFixed(2),
        result.competitorRates.length,
        result.shipmentCount
      ].join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `margin-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">New Carrier Margin Discovery</h1>
            <p className="text-sm text-gray-600">
              Analyze competitor pricing to determine optimal margins for new carrier relationships
            </p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Target Carrier Group */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Carrier Group
            </label>
            <select
              value={selectedTargetGroup}
              onChange={(e) => {
                setSelectedTargetGroup(e.target.value);
                setSelectedTargetCarrier(''); // Reset carrier selection
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select target group...</option>
              {carrierGroups.map(group => (
                <option key={group.groupCode} value={group.groupCode}>
                  {group.groupName} ({group.carriers.length} carriers)
                </option>
              ))}
            </select>
          </div>

          {/* Target Carrier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Carrier
            </label>
            <select
              value={selectedTargetCarrier}
              onChange={(e) => setSelectedTargetCarrier(e.target.value)}
              disabled={!selectedTargetGroup}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
            >
              <option value="">Select target carrier...</option>
              {getCarriersInGroup(selectedTargetGroup).map(carrier => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </select>
          </div>

          {/* Competitor Group */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Competitor Group
            </label>
            <select
              value={selectedCompetitorGroup}
              onChange={(e) => setSelectedCompetitorGroup(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select competitor group...</option>
              {carrierGroups
                .filter(group => group.groupCode !== selectedTargetGroup)
                .map(group => (
                  <option key={group.groupCode} value={group.groupCode}>
                    {group.groupName} ({group.carriers.length} carriers)
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Analysis Info */}
        {selectedTargetGroup && selectedCompetitorGroup && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Analysis Plan:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Get rates from target carrier: <strong>{getCarriersInGroup(selectedTargetGroup).find(c => c.id === selectedTargetCarrier)?.name || 'Not selected'}</strong></li>
                  <li>Get rates from <strong>{getCarriersInGroup(selectedCompetitorGroup).length} competitors</strong> in {carrierGroups.find(g => g.groupCode === selectedCompetitorGroup)?.groupName}</li>
                  <li>Calculate recommended margins to match competitor pricing</li>
                  <li>Process <strong>{sampleShipments.length} sample shipments</strong></li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Run Analysis Button */}
        <div className="mt-6">
          <button
            onClick={runMarginAnalysis}
            disabled={isLoading || !selectedTargetGroup || !selectedTargetCarrier || !selectedCompetitorGroup}
            className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            <span>{isLoading ? 'Analyzing...' : 'Run Margin Analysis'}</span>
          </button>
        </div>
      </div>

      {/* Processing Status */}
      {(isLoading || processingStatus) && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3">
            {isLoading && <Loader className="h-5 w-5 animate-spin text-blue-500" />}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Processing Status</h3>
              <p className="text-sm text-gray-600">{processingStatus}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Margin Analysis Results</h3>
              <p className="text-sm text-gray-600 mt-1">
                {results.length} shipment{results.length !== 1 ? 's' : ''} analyzed
              </p>
            </div>
            <button
              onClick={exportResults}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export Results</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Competitor Count</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lowest Competitor Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommended Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((result, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {result.customerName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(result.targetCarrierRate)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {result.competitorRates.length} carriers
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(result.recommendedPrice)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        result.recommendedMargin > 15 ? 'bg-green-100 text-green-800' :
                        result.recommendedMargin > 10 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {result.recommendedMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(result.recommendedPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Target Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(results.reduce((sum, r) => sum + r.targetCarrierRate, 0) / results.length)}
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Recommended Margin</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(results.reduce((sum, r) => sum + r.recommendedMargin, 0) / results.length).toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Competitors</p>
                <p className="text-2xl font-bold text-gray-900">
                  {getCarriersInGroup(selectedCompetitorGroup).length}
                </p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Shipments Analyzed</p>
                <p className="text-2xl font-bold text-gray-900">{results.length}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};