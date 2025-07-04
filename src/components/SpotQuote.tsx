import React, { useState } from 'react';
import { Zap, MapPin, Package, Calendar, DollarSign, Truck, Clock, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { RFQRow, ProcessingResult, QuoteWithPricing } from '../types';
import { Project44APIClient, FreshXAPIClient } from '../utils/apiClient';
import { calculatePricingWithCustomerMargins } from '../utils/pricingCalculator';
import { PricingSettings } from '../types';
import { ResultsTable } from './ResultsTable';

interface SpotQuoteProps {
  project44Client: Project44APIClient | null;
  freshxClient: FreshXAPIClient | null;
  selectedCarriers: { [carrierId: string]: boolean };
  pricingSettings: PricingSettings;
  selectedCustomer: string;
}

export const SpotQuote: React.FC<SpotQuoteProps> = ({
  project44Client,
  freshxClient,
  selectedCarriers,
  pricingSettings,
  selectedCustomer
}) => {
  const [formData, setFormData] = useState({
    fromZip: '',
    toZip: '',
    pallets: 1,
    grossWeight: 1000,
    fromDate: new Date().toISOString().split('T')[0],
    isReefer: false,
    temperature: 'AMBIENT' as const,
    commodity: 'FOODSTUFFS' as const,
    freightClass: '70',
    isStackable: false
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [error, setError] = useState<string>('');

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSpotQuote = async () => {
    if (!formData.fromZip || !formData.toZip) {
      setError('Please enter both origin and destination ZIP codes');
      return;
    }

    if (!project44Client && !freshxClient) {
      setError('No API clients available. Please configure your API keys.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setResults([]);

    try {
      // Create RFQ data from form
      const rfqData: RFQRow = {
        fromDate: formData.fromDate,
        fromZip: formData.fromZip,
        toZip: formData.toZip,
        pallets: formData.pallets,
        grossWeight: formData.grossWeight,
        isStackable: formData.isStackable,
        accessorial: [],
        isReefer: formData.isReefer,
        temperature: formData.temperature,
        commodity: formData.commodity,
        freightClass: formData.freightClass
      };

      const result: ProcessingResult = {
        rowIndex: 0,
        originalData: rfqData,
        quotes: [],
        status: 'processing'
      };

      // Determine routing based on isReefer field
      if (formData.isReefer && freshxClient) {
        console.log('🌡️ Getting FreshX spot quote...');
        const quotes = await freshxClient.getQuotes(rfqData);
        
        // Apply pricing to quotes
        const quotesWithPricing = await Promise.all(
          quotes.map(quote => 
            calculatePricingWithCustomerMargins(quote, pricingSettings, selectedCustomer)
          )
        );
        
        result.quotes = quotesWithPricing;
        result.status = 'success';
      } else if (!formData.isReefer && project44Client) {
        console.log('🚛 Getting Project44 spot quote...');
        
        const selectedCarrierIds = Object.entries(selectedCarriers)
          .filter(([_, selected]) => selected)
          .map(([carrierId, _]) => carrierId);

        // Determine if this should be Volume LTL
        const isVolumeMode = formData.pallets >= 10 || formData.grossWeight >= 15000;
        
        const quotes = await project44Client.getQuotes(
          rfqData, 
          selectedCarrierIds, 
          isVolumeMode, 
          false, 
          false
        );
        
        // Apply pricing to quotes
        const quotesWithPricing = await Promise.all(
          quotes.map(quote => 
            calculatePricingWithCustomerMargins(quote, pricingSettings, selectedCustomer)
          )
        );
        
        result.quotes = quotesWithPricing;
        result.status = 'success';
      } else {
        throw new Error('No suitable API client available for this quote type');
      }

      setResults([result]);
      console.log(`✅ Spot quote completed: ${result.quotes.length} quotes received`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get spot quote';
      setError(errorMessage);
      console.error('❌ Spot quote failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePriceUpdate = (resultIndex: number, quoteId: number, newPrice: number) => {
    setResults(prevResults => {
      const newResults = [...prevResults];
      const result = newResults[resultIndex];
      
      if (result && result.quotes) {
        const updatedQuotes = result.quotes.map(quote => {
          if (quote.quoteId === quoteId) {
            return calculatePricingWithCustomerMargins(quote, pricingSettings, selectedCustomer, newPrice);
          }
          return quote;
        });
        
        newResults[resultIndex] = {
          ...result,
          quotes: updatedQuotes
        };
      }
      
      return newResults;
    });
  };

  const exportResults = () => {
    console.log('📊 Exporting spot quote results...');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-600 p-2 rounded-lg">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Spot Quote</h2>
            <p className="text-sm text-gray-600">
              Get instant quotes for single shipments using smart routing
            </p>
          </div>
        </div>
      </div>

      {/* Quick Quote Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipment Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Origin ZIP */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="inline h-4 w-4 mr-1" />
              Origin ZIP
            </label>
            <input
              type="text"
              value={formData.fromZip}
              onChange={(e) => handleInputChange('fromZip', e.target.value)}
              placeholder="60607"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              maxLength={5}
            />
          </div>

          {/* Destination ZIP */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="inline h-4 w-4 mr-1" />
              Destination ZIP
            </label>
            <input
              type="text"
              value={formData.toZip}
              onChange={(e) => handleInputChange('toZip', e.target.value)}
              placeholder="30033"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              maxLength={5}
            />
          </div>

          {/* Pickup Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Pickup Date
            </label>
            <input
              type="date"
              value={formData.fromDate}
              onChange={(e) => handleInputChange('fromDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Pallets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Package className="inline h-4 w-4 mr-1" />
              Pallets
            </label>
            <input
              type="number"
              value={formData.pallets}
              onChange={(e) => handleInputChange('pallets', parseInt(e.target.value) || 1)}
              min="1"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Weight */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Package className="inline h-4 w-4 mr-1" />
              Weight (lbs)
            </label>
            <input
              type="number"
              value={formData.grossWeight}
              onChange={(e) => handleInputChange('grossWeight', parseInt(e.target.value) || 1000)}
              min="1"
              max="100000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Freight Class */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Freight Class
            </label>
            <select
              value={formData.freightClass}
              onChange={(e) => handleInputChange('freightClass', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="50">50</option>
              <option value="55">55</option>
              <option value="60">60</option>
              <option value="65">65</option>
              <option value="70">70</option>
              <option value="77.5">77.5</option>
              <option value="85">85</option>
              <option value="92.5">92.5</option>
              <option value="100">100</option>
              <option value="110">110</option>
              <option value="125">125</option>
              <option value="150">150</option>
              <option value="175">175</option>
              <option value="200">200</option>
              <option value="250">250</option>
              <option value="300">300</option>
              <option value="400">400</option>
              <option value="500">500</option>
            </select>
          </div>
        </div>

        {/* Smart Routing Options */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-900 mb-3">Smart Routing</h4>
          
          <div className="space-y-3">
            {/* Reefer Toggle */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isReefer"
                checked={formData.isReefer}
                onChange={(e) => handleInputChange('isReefer', e.target.checked)}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <label htmlFor="isReefer" className="text-sm font-medium text-blue-900">
                Route to FreshX Reefer Network
              </label>
            </div>

            {/* Temperature (only if reefer) */}
            {formData.isReefer && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Temperature
                  </label>
                  <select
                    value={formData.temperature}
                    onChange={(e) => handleInputChange('temperature', e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="AMBIENT">Ambient</option>
                    <option value="CHILLED">Chilled</option>
                    <option value="FROZEN">Frozen</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Commodity
                  </label>
                  <select
                    value={formData.commodity}
                    onChange={(e) => handleInputChange('commodity', e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="FOODSTUFFS">Foodstuffs</option>
                    <option value="FRESH_SEAFOOD">Fresh Seafood</option>
                    <option value="FROZEN_SEAFOOD">Frozen Seafood</option>
                    <option value="ICE_CREAM">Ice Cream</option>
                    <option value="PRODUCE">Produce</option>
                    <option value="ALCOHOL">Alcohol</option>
                  </select>
                </div>
              </div>
            )}

            {/* Stackable */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isStackable"
                checked={formData.isStackable}
                onChange={(e) => handleInputChange('isStackable', e.target.checked)}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <label htmlFor="isStackable" className="text-sm font-medium text-blue-900">
                Stackable
              </label>
            </div>

            {/* Routing Info */}
            <div className="mt-3 p-3 bg-white border border-blue-200 rounded-md">
              <div className="text-sm text-blue-800">
                <strong>Routing Decision:</strong>
                {formData.isReefer ? (
                  <span className="ml-2 text-green-600">
                    FreshX Reefer Network ({formData.temperature})
                  </span>
                ) : (
                  <span className="ml-2 text-blue-600">
                    Project44 {formData.pallets >= 10 || formData.grossWeight >= 15000 ? 'Volume LTL' : 'Standard LTL'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Get Quote Button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleSpotQuote}
            disabled={isProcessing || !formData.fromZip || !formData.toZip}
            className={`flex items-center space-x-3 px-8 py-3 rounded-lg font-semibold transition-all duration-200 ${
              isProcessing || !formData.fromZip || !formData.toZip
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Getting Quote...</span>
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" />
                <span>Get Spot Quote</span>
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900">Spot Quote Results</h3>
            </div>
          </div>
          <div className="p-6">
            <ResultsTable
              results={results}
              onExport={exportResults}
              onPriceUpdate={handlePriceUpdate}
            />
          </div>
        </div>
      )}
    </div>
  );
};