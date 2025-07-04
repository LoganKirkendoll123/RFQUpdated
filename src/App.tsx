import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { FileUpload } from './components/FileUpload';
import { parseCSV, parseXLSX } from './utils/fileParser';
import { RFQRow, ProcessingResult, PricingSettings, Quote, QuoteWithPricing, Project44OAuthConfig } from './types';
import { Project44APIClient, FreshXAPIClient, CarrierGroup } from './utils/apiClient';
import { ResultsTable } from './components/ResultsTable';
import { ProcessingStatus } from './components/ProcessingStatus';
import { TemplateDownload } from './components/TemplateDownload';
import { ApiKeyInput } from './components/ApiKeyInput';
import { CarrierSelection } from './components/CarrierSelection';
import { PricingSettingsComponent } from './components/PricingSettings';
import { Analytics } from './components/Analytics';
import { CustomerSelection } from './components/CustomerSelection';
import { calculatePricingWithCustomerMargins, clearMarginCache } from './utils/pricingCalculator';
import { saveProject44Config, loadProject44Config, saveFreshXApiKey, loadFreshXApiKey, saveSelectedCarriers, loadSelectedCarriers, savePricingSettings, loadPricingSettings, saveSelectedModes, loadSelectedModes } from './utils/credentialStorage';
import { saveRFQResultsToDatabase } from './utils/database';
import { DatabaseToolbox } from './components/DatabaseToolbox';
import { SupabaseStatus } from './components/SupabaseStatus';
import { SupabaseSetup } from './components/SupabaseSetup';
import { CustomerManagement } from './components/CustomerManagement';
import { CarrierManagement } from './components/CarrierManagement';
import { CustomerCarrierManagement } from './components/CustomerCarrierManagement';

const App: React.FC = () => {
  // File and processing state
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>('');
  const [rfqData, setRfqData] = useState<RFQRow[]>([]);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [processingProgress, setProcessingProgress] = useState({
    total: 0,
    completed: 0,
    success: 0,
    errors: 0
  });
  const [currentCarrier, setCurrentCarrier] = useState<string>('');
  const [carrierProgress, setCarrierProgress] = useState<{
    current: number;
    total: number;
  }>({ current: 0, total: 0 });

  // API credentials state
  const [project44Config, setProject44Config] = useState<Project44OAuthConfig>({
    oauthUrl: '/api/v4/oauth2/token',
    basicUser: '',
    basicPassword: '',
    clientId: '',
    clientSecret: '',
    ratingApiUrl: '/api/v4/ltl/quotes/rates/query'
  });
  const [freshxApiKey, setFreshxApiKey] = useState('');
  const [isProject44Valid, setIsProject44Valid] = useState(false);
  const [isFreshXValid, setIsFreshXValid] = useState(false);

  // Carrier selection state
  const [carrierGroups, setCarrierGroups] = useState<CarrierGroup[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<{ [carrierId: string]: boolean }>({});
  const [loadingCarriers, setLoadingCarriers] = useState(false);

  // Pricing settings state
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>({
    markupPercentage: 15,
    minimumProfit: 100,
    markupType: 'percentage',
    usesCustomerMargins: true,
    fallbackMarkupPercentage: 23
  });
  
  // Customer selection state
  const [selectedCustomer, setSelectedCustomer] = useState('');

  // Mode selection state
  const [selectedModes, setSelectedModes] = useState({
    standard: true,
    volume: true,
    freshx: true
  });

  // Load saved settings on mount
  useEffect(() => {
    const loadSavedSettings = () => {
      // Load Project44 config
      const savedProject44Config = loadProject44Config();
      if (savedProject44Config) {
        setProject44Config(savedProject44Config);
        setIsProject44Valid(!!savedProject44Config.clientId && !!savedProject44Config.clientSecret);
      }

      // Load FreshX API key
      const savedFreshXApiKey = loadFreshXApiKey();
      if (savedFreshXApiKey) {
        setFreshxApiKey(savedFreshXApiKey);
        setIsFreshXValid(true);
      }

      // Load selected carriers
      const savedCarriers = loadSelectedCarriers();
      if (savedCarriers) {
        setSelectedCarriers(savedCarriers);
      }

      // Load pricing settings
      const savedPricingSettings = loadPricingSettings();
      if (savedPricingSettings) {
        setPricingSettings(savedPricingSettings);
      }

      // Load selected modes
      const savedModes = loadSelectedModes();
      if (savedModes) {
        setSelectedModes(savedModes);
      }
    };

    loadSavedSettings();
  }, []);

  // Load carriers when Project44 config is valid
  useEffect(() => {
    if (isProject44Valid) {
      loadCarriers();
    }
  }, [isProject44Valid]);

  const loadCarriers = async () => {
    if (!isProject44Valid) return;

    setLoadingCarriers(true);
    try {
      const apiClient = new Project44APIClient(project44Config);
      const groups = await apiClient.loadCarriersFromDatabase();
      setCarrierGroups(groups);

      // If no carriers are selected yet, select all by default
      if (Object.keys(selectedCarriers).length === 0) {
        const allCarriers: { [carrierId: string]: boolean } = {};
        groups.forEach(group => {
          group.carriers.forEach(carrier => {
            allCarriers[carrier.id] = true;
          });
        });
        setSelectedCarriers(allCarriers);
        saveSelectedCarriers(allCarriers);
      }
    } catch (error) {
      console.error('Failed to load carriers:', error);
      setFileError('Failed to load carriers. Please check your Project44 credentials.');
    } finally {
      setLoadingCarriers(false);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setFileError('');
    setRfqData([]);
    setResults([]);
  };

  const handleProcessFile = async () => {
    if (!file) {
      setFileError('Please select a file first');
      return;
    }

    setFileError('');
    setIsProcessing(true);
    setRfqData([]);
    setResults([]);

    try {
      let parsedData: RFQRow[];
      
      if (file.name.endsWith('.csv')) {
        parsedData = await parseCSV(file, true);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        parsedData = await parseXLSX(file, true);
      } else {
        throw new Error('Unsupported file format. Please upload a CSV or Excel file.');
      }

      if (parsedData.length === 0) {
        throw new Error('No valid data found in the file. Please check the file format.');
      }

      console.log(`📋 Parsed ${parsedData.length} RFQ rows from file`);
      setRfqData(parsedData);
      
      // Initialize results array with pending status
      const initialResults: ProcessingResult[] = parsedData.map((row, index) => ({
        rowIndex: index,
        originalData: row,
        quotes: [],
        status: 'pending'
      }));
      
      setResults(initialResults);
      setProcessingProgress({
        total: parsedData.length,
        completed: 0,
        success: 0,
        errors: 0
      });

      // Process each RFQ row
      await processRFQs(initialResults);
      
      // Switch to results tab when done
      setActiveTab('results');
    } catch (error) {
      console.error('Error processing file:', error);
      setFileError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const processRFQs = async (initialResults: ProcessingResult[]) => {
    const project44Client = isProject44Valid ? new Project44APIClient(project44Config) : null;
    const freshxClient = isFreshXValid ? new FreshXAPIClient(freshxApiKey) : null;
    
    // Get selected carrier IDs
    const selectedCarrierIds = Object.entries(selectedCarriers)
      .filter(([, isSelected]) => isSelected)
      .map(([carrierId]) => carrierId);
    
    console.log(`🚚 Processing ${initialResults.length} RFQs with ${selectedCarrierIds.length} selected carriers`);
    
    // Process each RFQ row sequentially
    for (let i = 0; i < initialResults.length; i++) {
      const result = { ...initialResults[i], status: 'processing' as const };
      
      // Update results array with processing status
      setResults(prevResults => {
        const newResults = [...prevResults];
        newResults[i] = result;
        return newResults;
      });
      
      try {
        // Determine which mode(s) to use based on RFQ data and selected modes
        const rfq = result.originalData;
        
        // Smart routing logic:
        // 1. If isReefer is TRUE, route to FreshX
        // 2. If isReefer is FALSE, route to Project44
        //    a. If pallets >= 10 or weight >= 15000, use Volume LTL (and standard for comparison)
        //    b. Otherwise, use Standard LTL only
        
        const isReefer = rfq.isReefer === true;
        const isVolumeCandidate = rfq.pallets >= 10 || rfq.grossWeight >= 15000;
        
        console.log(`🧠 Smart routing for RFQ #${i+1}:`, {
          isReefer,
          pallets: rfq.pallets,
          weight: rfq.grossWeight,
          isVolumeCandidate,
          temperature: rfq.temperature
        });
        
        let quotes: Quote[] = [];
        
        // Route to FreshX if isReefer is true and FreshX is enabled
        if (isReefer && selectedModes.freshx && freshxClient) {
          console.log(`🌡️ Routing RFQ #${i+1} to FreshX (isReefer=true)`);
          
          try {
            setCurrentCarrier('FreshX Reefer Network');
            setCarrierProgress({ current: 0, total: 1 });
            
            const freshxQuotes = await freshxClient.getQuotes(rfq);
            quotes = freshxQuotes;
            
            setCarrierProgress({ current: 1, total: 1 });
          } catch (error) {
            console.error(`❌ FreshX API error for RFQ #${i+1}:`, error);
            result.error = error instanceof Error ? error.message : 'FreshX API error';
          }
        } 
        // Route to Project44 if isReefer is false and Project44 is enabled
        else if (!isReefer && project44Client) {
          console.log(`🚚 Routing RFQ #${i+1} to Project44 (isReefer=false)`);
          
          // For volume candidates, get both volume and standard quotes if both modes are enabled
          if (isVolumeCandidate && selectedModes.volume && selectedModes.standard) {
            console.log(`📦 RFQ #${i+1} is a volume candidate - getting both Volume LTL and Standard LTL quotes`);
            
            try {
              // Process volume quotes
              setCurrentCarrier('Volume LTL Carriers');
              setCarrierProgress({ current: 0, total: selectedCarrierIds.length });
              
              const volumeQuotes = await project44Client.getQuotes(rfq, selectedCarrierIds, true, false, false);
              
              // Process standard quotes
              setCurrentCarrier('Standard LTL Carriers');
              setCarrierProgress({ current: 0, total: selectedCarrierIds.length });
              
              const standardQuotes = await project44Client.getQuotes(rfq, selectedCarrierIds, false, false, false);
              
              // Combine quotes
              quotes = [...volumeQuotes, ...standardQuotes];
              
              // Add mode information to quotes for UI display
              quotes = quotes.map(quote => ({
                ...quote,
                quoteMode: quote.submittedBy.includes('Volume') ? 'volume' : 'standard'
              }));
              
              // Add dual-mode decision metadata
              result.quotingDecision = 'project44-dual';
              result.quotingReason = 'Shipment qualifies for Volume LTL (dual-mode comparison)';
              
              setCarrierProgress({ current: selectedCarrierIds.length, total: selectedCarrierIds.length });
            } catch (error) {
              console.error(`❌ Project44 API error for RFQ #${i+1}:`, error);
              result.error = error instanceof Error ? error.message : 'Project44 API error';
            }
          }
          // For volume candidates with only volume mode enabled
          else if (isVolumeCandidate && selectedModes.volume) {
            console.log(`📦 RFQ #${i+1} is a volume candidate - getting Volume LTL quotes only`);
            
            try {
              setCurrentCarrier('Volume LTL Carriers');
              setCarrierProgress({ current: 0, total: selectedCarrierIds.length });
              
              const volumeQuotes = await project44Client.getQuotes(rfq, selectedCarrierIds, true, false, false);
              quotes = volumeQuotes;
              
              // Add mode information to quotes for UI display
              quotes = quotes.map(quote => ({
                ...quote,
                quoteMode: 'volume'
              }));
              
              // Add volume-only decision metadata
              result.quotingDecision = 'project44-volume';
              result.quotingReason = 'Shipment qualifies for Volume LTL (volume-only mode)';
              
              setCarrierProgress({ current: selectedCarrierIds.length, total: selectedCarrierIds.length });
            } catch (error) {
              console.error(`❌ Project44 API error for RFQ #${i+1}:`, error);
              result.error = error instanceof Error ? error.message : 'Project44 API error';
            }
          }
          // For all other cases, use standard LTL
          else if (selectedModes.standard) {
            console.log(`📦 RFQ #${i+1} using Standard LTL quotes`);
            
            try {
              setCurrentCarrier('Standard LTL Carriers');
              setCarrierProgress({ current: 0, total: selectedCarrierIds.length });
              
              const standardQuotes = await project44Client.getQuotes(rfq, selectedCarrierIds, false, false, false);
              quotes = standardQuotes;
              
              // Add mode information to quotes for UI display
              quotes = quotes.map(quote => ({
                ...quote,
                quoteMode: 'standard'
              }));
              
              // Add standard-only decision metadata
              result.quotingDecision = 'project44-standard';
              result.quotingReason = isVolumeCandidate 
                ? 'Shipment qualifies for Volume LTL but standard mode selected' 
                : 'Standard LTL shipment';
              
              setCarrierProgress({ current: selectedCarrierIds.length, total: selectedCarrierIds.length });
            } catch (error) {
              console.error(`❌ Project44 API error for RFQ #${i+1}:`, error);
              result.error = error instanceof Error ? error.message : 'Project44 API error';
            }
          } else {
            result.error = 'No compatible quoting modes enabled for this shipment';
          }
        } else {
          result.error = isReefer 
            ? 'FreshX API key not configured or FreshX mode disabled' 
            : 'Project44 credentials not configured or all Project44 modes disabled';
        }
        
        // Apply pricing to quotes
        const quotesWithPricing: QuoteWithPricing[] = [];
        
        for (const quote of quotes) {
          try {
            // Calculate carrier total rate
            const carrierTotalRate = quote.rateQuoteDetail?.total || 
              (quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts);
            
            // Apply customer-specific pricing if available
            const pricedQuote = await calculatePricingWithCustomerMargins(
              { ...quote, totalRate: carrierTotalRate },
              pricingSettings,
              selectedCustomer
            );
            
            // Add charge breakdown
            const chargeBreakdown = {
              baseCharges: quote.rateQuoteDetail?.charges.filter(c => !c.code.includes('FUEL')) || [],
              fuelCharges: quote.rateQuoteDetail?.charges.filter(c => c.code.includes('FUEL')) || [],
              accessorialCharges: quote.accessorial || [],
              discountCharges: [],
              premiumCharges: [],
              otherCharges: []
            };
            
            quotesWithPricing.push({
              ...pricedQuote,
              chargeBreakdown
            });
          } catch (error) {
            console.error(`❌ Error applying pricing to quote:`, error);
          }
        }
        
        // Sort quotes by customer price
        quotesWithPricing.sort((a, b) => a.customerPrice - b.customerPrice);
        
        // Update result with quotes and status
        result.quotes = quotesWithPricing;
        result.status = quotesWithPricing.length > 0 ? 'success' : 'error';
        
        if (quotesWithPricing.length === 0 && !result.error) {
          result.error = 'No quotes returned from carriers';
        }
        
        // Update results array
        setResults(prevResults => {
          const newResults = [...prevResults];
          newResults[i] = result;
          return newResults;
        });
        
        // Update progress
        setProcessingProgress(prev => ({
          ...prev,
          completed: prev.completed + 1,
          success: result.status === 'success' ? prev.success + 1 : prev.success,
          errors: result.status === 'error' ? prev.errors + 1 : prev.errors
        }));
      } catch (error) {
        console.error(`❌ Error processing RFQ #${i+1}:`, error);
        
        // Update result with error
        result.status = 'error';
        result.error = error instanceof Error ? error.message : 'An unknown error occurred';
        
        // Update results array
        setResults(prevResults => {
          const newResults = [...prevResults];
          newResults[i] = result;
          return newResults;
        });
        
        // Update progress
        setProcessingProgress(prev => ({
          ...prev,
          completed: prev.completed + 1,
          errors: prev.errors + 1
        }));
      }
    }
    
    console.log('✅ Finished processing all RFQs');
  };

  const handleExportResults = () => {
    // Create CSV content
    const csvRows = [];
    
    // Add header row
    csvRows.push([
      'RFQ #',
      'Origin',
      'Destination',
      'Pallets',
      'Weight',
      'Pickup Date',
      'Carrier',
      'Service Level',
      'Transit Days',
      'Carrier Rate',
      'Customer Price',
      'Profit',
      'Margin %',
      'Status',
      'Error'
    ].join(','));
    
    // Add data rows
    results.forEach(result => {
      const bestQuote = result.quotes.length > 0 ? result.quotes[0] : null;
      
      csvRows.push([
        result.rowIndex + 1,
        result.originalData.fromZip,
        result.originalData.toZip,
        result.originalData.pallets,
        result.originalData.grossWeight,
        result.originalData.fromDate,
        bestQuote ? bestQuote.carrier.name : '',
        bestQuote ? (bestQuote.serviceLevel?.description || '') : '',
        bestQuote ? (bestQuote.transitDays || '') : '',
        bestQuote ? bestQuote.carrierTotalRate.toFixed(2) : '',
        bestQuote ? bestQuote.customerPrice.toFixed(2) : '',
        bestQuote ? bestQuote.profit.toFixed(2) : '',
        bestQuote ? ((bestQuote.profit / bestQuote.carrierTotalRate) * 100).toFixed(1) + '%' : '',
        result.status,
        result.error || ''
      ].join(','));
    });
    
    // Create and download CSV file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rfq-results-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAnalytics = () => {
    // Create CSV content for analytics
    const csvRows = [];
    
    // Add header row
    csvRows.push([
      'Metric',
      'Value'
    ].join(','));
    
    // Add summary metrics
    const successfulResults = results.filter(r => r.status === 'success');
    const totalQuotes = successfulResults.reduce((sum, r) => sum + r.quotes.length, 0);
    const avgQuotesPerRFQ = successfulResults.length > 0 ? totalQuotes / successfulResults.length : 0;
    
    const allQuotes = successfulResults.flatMap(r => r.quotes);
    const avgPrice = allQuotes.length > 0 ? allQuotes.reduce((sum, q) => sum + q.customerPrice, 0) / allQuotes.length : 0;
    const avgProfit = allQuotes.length > 0 ? allQuotes.reduce((sum, q) => sum + q.profit, 0) / allQuotes.length : 0;
    const avgMargin = avgPrice > 0 ? (avgProfit / avgPrice) * 100 : 0;
    
    csvRows.push(['Total RFQs', results.length].join(','));
    csvRows.push(['Successful RFQs', successfulResults.length].join(','));
    csvRows.push(['Success Rate', `${((successfulResults.length / results.length) * 100).toFixed(1)}%`].join(','));
    csvRows.push(['Total Quotes', totalQuotes].join(','));
    csvRows.push(['Avg Quotes per RFQ', avgQuotesPerRFQ.toFixed(1)].join(','));
    csvRows.push(['Avg Price', `$${avgPrice.toFixed(2)}`].join(','));
    csvRows.push(['Avg Profit', `$${avgProfit.toFixed(2)}`].join(','));
    csvRows.push(['Avg Margin', `${avgMargin.toFixed(1)}%`].join(','));
    
    // Add carrier statistics
    csvRows.push(['', ''].join(','));
    csvRows.push(['Carrier Statistics', ''].join(','));
    
    const carrierStats = new Map<string, { quotes: number, totalPrice: number, totalProfit: number }>();
    
    allQuotes.forEach(quote => {
      const carrierName = quote.carrier.name;
      if (!carrierStats.has(carrierName)) {
        carrierStats.set(carrierName, { quotes: 0, totalPrice: 0, totalProfit: 0 });
      }
      
      const stats = carrierStats.get(carrierName)!;
      stats.quotes++;
      stats.totalPrice += quote.customerPrice;
      stats.totalProfit += quote.profit;
    });
    
    csvRows.push(['Carrier', 'Quotes', 'Avg Price', 'Avg Profit', 'Avg Margin'].join(','));
    
    Array.from(carrierStats.entries())
      .sort((a, b) => b[1].quotes - a[1].quotes)
      .forEach(([carrier, stats]) => {
        const avgPrice = stats.totalPrice / stats.quotes;
        const avgProfit = stats.totalProfit / stats.quotes;
        const avgMargin = avgPrice > 0 ? (avgProfit / avgPrice) * 100 : 0;
        
        csvRows.push([
          carrier,
          stats.quotes,
          `$${avgPrice.toFixed(2)}`,
          `$${avgProfit.toFixed(2)}`,
          `${avgMargin.toFixed(1)}%`
        ].join(','));
      });
    
    // Create and download CSV file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rfq-analytics-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePriceUpdate = (resultIndex: number, quoteId: number, newPrice: number) => {
    setResults(prevResults => {
      const newResults = [...prevResults];
      const result = { ...newResults[resultIndex] };
      
      // Find the quote to update
      const quoteIndex = result.quotes.findIndex(q => q.quoteId === quoteId);
      if (quoteIndex === -1) return prevResults;
      
      // Update the quote with the new price
      const quote = { ...result.quotes[quoteIndex] };
      quote.customerPrice = newPrice;
      quote.profit = newPrice - quote.carrierTotalRate;
      quote.isCustomPrice = true;
      
      // Update the quotes array
      const newQuotes = [...result.quotes];
      newQuotes[quoteIndex] = quote;
      
      // Sort quotes by price
      newQuotes.sort((a, b) => a.customerPrice - b.customerPrice);
      
      // Update the result
      result.quotes = newQuotes;
      newResults[resultIndex] = result;
      
      return newResults;
    });
  };

  const handleProject44ConfigChange = (config: Project44OAuthConfig) => {
    setProject44Config(config);
    saveProject44Config(config);
  };

  const handleFreshXApiKeyChange = (apiKey: string) => {
    setFreshxApiKey(apiKey);
    saveFreshXApiKey(apiKey);
  };

  const handleToggleCarrier = (carrierId: string, selected: boolean) => {
    setSelectedCarriers(prev => {
      const updated = { ...prev, [carrierId]: selected };
      saveSelectedCarriers(updated);
      return updated;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    const allCarriers: { [carrierId: string]: boolean } = {};
    carrierGroups.forEach(group => {
      group.carriers.forEach(carrier => {
        allCarriers[carrier.id] = selected;
      });
    });
    setSelectedCarriers(allCarriers);
    saveSelectedCarriers(allCarriers);
  };

  const handleSelectAllInGroup = (groupCode: string, selected: boolean) => {
    const group = carrierGroups.find(g => g.groupCode === groupCode);
    if (!group) return;
    
    setSelectedCarriers(prev => {
      const updated = { ...prev };
      group.carriers.forEach(carrier => {
        updated[carrier.id] = selected;
      });
      saveSelectedCarriers(updated);
      return updated;
    });
  };

  const handlePricingSettingsChange = (settings: PricingSettings) => {
    setPricingSettings(settings);
    savePricingSettings(settings);
    
    // Clear margin cache when settings change
    clearMarginCache();
    
    // Recalculate pricing for all quotes
    if (results.length > 0) {
      setIsProcessing(true);
      
      // Create a copy of results to update
      const updatedResults = [...results];
      
      // Process each result
      const processResults = async () => {
        for (let i = 0; i < updatedResults.length; i++) {
          const result = updatedResults[i];
          
          // Skip results without quotes
          if (result.quotes.length === 0) continue;
          
          // Recalculate pricing for each quote
          const updatedQuotes: QuoteWithPricing[] = [];
          
          for (const quote of result.quotes) {
            try {
              // Preserve custom prices
              const customPrice = quote.isCustomPrice ? quote.customerPrice : undefined;
              
              // Calculate carrier total rate
              const carrierTotalRate = quote.carrierTotalRate;
              
              // Apply customer-specific pricing if available
              const pricedQuote = await calculatePricingWithCustomerMargins(
                { ...quote, totalRate: carrierTotalRate },
                settings,
                selectedCustomer,
                customPrice
              );
              
              updatedQuotes.push({
                ...pricedQuote,
                chargeBreakdown: quote.chargeBreakdown
              });
            } catch (error) {
              console.error(`❌ Error recalculating pricing for quote:`, error);
            }
          }
          
          // Sort quotes by customer price
          updatedQuotes.sort((a, b) => a.customerPrice - b.customerPrice);
          
          // Update result with recalculated quotes
          updatedResults[i] = {
            ...result,
            quotes: updatedQuotes
          };
        }
        
        // Update results state
        setResults(updatedResults);
        setIsProcessing(false);
      };
      
      processResults();
    }
  };

  const handleCustomerChange = (customer: string) => {
    setSelectedCustomer(customer);
    
    // Clear margin cache when customer changes
    clearMarginCache();
    
    // Recalculate pricing for all quotes with the new customer
    if (results.length > 0) {
      setIsProcessing(true);
      
      // Create a copy of results to update
      const updatedResults = [...results];
      
      // Process each result
      const processResults = async () => {
        for (let i = 0; i < updatedResults.length; i++) {
          const result = updatedResults[i];
          
          // Skip results without quotes
          if (result.quotes.length === 0) continue;
          
          // Recalculate pricing for each quote
          const updatedQuotes: QuoteWithPricing[] = [];
          
          for (const quote of result.quotes) {
            try {
              // Preserve custom prices
              const customPrice = quote.isCustomPrice ? quote.customerPrice : undefined;
              
              // Calculate carrier total rate
              const carrierTotalRate = quote.carrierTotalRate;
              
              // Apply customer-specific pricing if available
              const pricedQuote = await calculatePricingWithCustomerMargins(
                { ...quote, totalRate: carrierTotalRate },
                pricingSettings,
                customer,
                customPrice
              );
              
              updatedQuotes.push({
                ...pricedQuote,
                chargeBreakdown: quote.chargeBreakdown
              });
            } catch (error) {
              console.error(`❌ Error recalculating pricing for quote:`, error);
            }
          }
          
          // Sort quotes by customer price
          updatedQuotes.sort((a, b) => a.customerPrice - b.customerPrice);
          
          // Update result with recalculated quotes
          updatedResults[i] = {
            ...result,
            quotes: updatedQuotes
          };
        }
        
        // Update results state
        setResults(updatedResults);
        setIsProcessing(false);
      };
      
      processResults();
    }
  };

  const handleToggleMode = (mode: 'standard' | 'volume' | 'freshx', enabled: boolean) => {
    setSelectedModes(prev => {
      const updated = { ...prev, [mode]: enabled };
      saveSelectedModes(updated);
      return updated;
    });
  };

  const handleSaveResultsToDatabase = async () => {
    if (results.length === 0 || !selectedCustomer) {
      alert('Please process some RFQs and select a customer before saving to database');
      return;
    }
    
    try {
      await saveRFQResultsToDatabase(results, selectedCustomer);
      alert(`Successfully saved ${results.filter(r => r.status === 'success').length} shipments to database for customer: ${selectedCustomer}`);
    } catch (error) {
      console.error('Failed to save results to database:', error);
      alert(`Failed to save results to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Project44 RFQ Bulk Processor</h1>
              <p className="text-gray-600 mt-1">Process multiple RFQs at once with smart routing and competitive analysis</p>
            </div>
            <div className="mt-4 md:mt-0">
              <SupabaseStatus />
            </div>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white rounded-lg shadow-md p-1">
            <TabsTrigger value="upload" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Upload RFQs
            </TabsTrigger>
            <TabsTrigger value="results" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Results
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Settings
            </TabsTrigger>
            <TabsTrigger value="database" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Database
            </TabsTrigger>
            <TabsTrigger value="customers" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Customers
            </TabsTrigger>
            <TabsTrigger value="carriers" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Carriers
            </TabsTrigger>
            <TabsTrigger value="margins" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Margins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload RFQ Data</h2>
                  <FileUpload 
                    onFileSelect={handleFileSelect} 
                    error={fileError}
                    isProcessing={isProcessing}
                  />
                  
                  {file && !fileError && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-600">
                        Selected file: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
                      </p>
                      <button
                        onClick={handleProcessFile}
                        disabled={isProcessing}
                        className="mt-4 w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {isProcessing ? 'Processing...' : 'Process RFQs'}
                      </button>
                    </div>
                  )}
                </div>
                
                <TemplateDownload isProject44={true} />
                
                <ProcessingStatus
                  total={processingProgress.total}
                  completed={processingProgress.completed}
                  success={processingProgress.success}
                  errors={processingProgress.errors}
                  isProcessing={isProcessing}
                  currentCarrier={currentCarrier}
                  carrierProgress={carrierProgress}
                />
              </div>
              
              <div className="space-y-6">
                <PricingSettingsComponent
                  settings={pricingSettings}
                  onSettingsChange={handlePricingSettingsChange}
                  selectedCustomer={selectedCustomer}
                  onCustomerChange={handleCustomerChange}
                />
                
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Mode Selection</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="standard-mode"
                          checked={selectedModes.standard}
                          onChange={(e) => handleToggleMode('standard', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="standard-mode" className="text-sm font-medium text-gray-700">
                          Standard LTL (Project44)
                        </label>
                      </div>
                      <span className="text-xs text-gray-500">1-9 pallets, under 15,000 lbs</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="volume-mode"
                          checked={selectedModes.volume}
                          onChange={(e) => handleToggleMode('volume', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="volume-mode" className="text-sm font-medium text-gray-700">
                          Volume LTL (Project44)
                        </label>
                      </div>
                      <span className="text-xs text-gray-500">10+ pallets or 15,000+ lbs</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="freshx-mode"
                          checked={selectedModes.freshx}
                          onChange={(e) => handleToggleMode('freshx', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="freshx-mode" className="text-sm font-medium text-gray-700">
                          Refrigerated LTL (FreshX)
                        </label>
                      </div>
                      <span className="text-xs text-gray-500">Temperature-controlled shipments</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Smart Routing:</strong> The system will automatically route shipments based on the <code>isReefer</code> field and size/weight thresholds.
                    </p>
                  </div>
                </div>
                
                <CarrierSelection
                  carrierGroups={carrierGroups}
                  selectedCarriers={selectedCarriers}
                  onToggleCarrier={handleToggleCarrier}
                  onSelectAll={handleSelectAll}
                  onSelectAllInGroup={handleSelectAllInGroup}
                  onRefreshCarriers={loadCarriers}
                  isLoading={loadingCarriers}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <ResultsTable 
              results={results} 
              onExport={handleExportResults}
              onPriceUpdate={handlePriceUpdate}
            />
            
            {results.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleSaveResultsToDatabase}
                  disabled={!selectedCustomer}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Save Results to Database
                </button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Analytics 
              results={results}
              onExport={handleExportAnalytics}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Project44 API Configuration</h2>
                  <ApiKeyInput
                    value={project44Config.clientId}
                    onChange={(value) => handleProject44ConfigChange({ ...project44Config, clientId: value })}
                    placeholder="Enter your Project44 Client ID"
                    onValidation={setIsProject44Valid}
                    isProject44={true}
                    onOAuthConfigChange={handleProject44ConfigChange}
                  />
                </div>
                
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">FreshX API Configuration</h2>
                  <ApiKeyInput
                    value={freshxApiKey}
                    onChange={handleFreshXApiKeyChange}
                    placeholder="Enter your FreshX API key"
                    onValidation={setIsFreshXValid}
                  />
                </div>
              </div>
              
              <div className="space-y-6">
                <PricingSettingsComponent
                  settings={pricingSettings}
                  onSettingsChange={handlePricingSettingsChange}
                  selectedCustomer={selectedCustomer}
                  onCustomerChange={handleCustomerChange}
                  showAsCard={false}
                />
                
                <SupabaseSetup />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="database" className="space-y-6">
            <DatabaseToolbox onSaveResults={handleSaveResultsToDatabase} />
          </TabsContent>

          <TabsContent value="customers" className="space-y-6">
            <CustomerManagement />
          </TabsContent>

          <TabsContent value="carriers" className="space-y-6">
            <CarrierManagement />
          </TabsContent>

          <TabsContent value="margins" className="space-y-6">
            <CustomerCarrierManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default App;