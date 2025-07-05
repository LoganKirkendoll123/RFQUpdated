      // Update job with second phase results
      const { error: updateError2 } = await supabase
        .from('MarginAnalysisJobs')
        .update({
          status: 'completed',
          second_phase_completed_at: new Date().toISOString(),
          phase_two_api_calls: phase2ApiCalls,
          phase_two_api_responses: phase2ApiResponses,
          phase_two_rate_data: phase2RateData,
          second_phase_data: {
            customer_count: Object.keys(customerRateData).length,
            total_shipments: phase2ApiCalls.length,
            matched_shipments: phase2RateData.length,
            customer_results: customerResults,
            date_range: {
              start: job.date_range_start,
              end: job.date_range_end
            }
          },
          discount_analysis_data: {
            discount_count: discountAnalysis.length,
            discount_details: discountAnalysis
          }
        })
        .eq('id', jobId);

      if (updateError2) throw updateError2;

      console.log('✅ Second phase margin analysis completed successfully');
      console.log(`📊 Found ${discountAnalysis.length} customers with discount patterns`);
      
      // Reload data
      await Promise.all([loadJobs(), loadRecommendations()]);

    } catch (err) {
      console.error('❌ Second phase margin analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Second phase analysis failed');
      
      // Update job status to failed
      if (jobId) {
        await supabase
          .from('MarginAnalysisJobs')
          .update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Second phase analysis failed'
          })
          .eq('id', jobId);
      }
    } finally {
      setIsRunningAnalysis(false);
      setIsSecondPhase(false);
      setSelectedJobId(null);
    }
  };

  const runMarginAnalysis = async () => {
    const selectedCarrierIds = Object.keys(selectedCarriers).filter(id => selectedCarriers[id]);
    if (selectedCarrierIds.length !== 1) {
      setError('Please select exactly one carrier to analyze');
      return;
    }

    const selectedCarrierId = selectedCarrierIds[0];
    const selectedCarrier = carrierGroups
      .flatMap(group => group.carriers)
      .find(carrier => carrier.id === selectedCarrierId);

    if (!selectedCarrier) {
      setError('Selected carrier not found');
      return;
    }

    setIsRunningAnalysis(true);
    setError('');

    try {
      console.log(`🔄 Starting margin analysis for ALL customers with carrier: ${selectedCarrier.name}`);

      // Create analysis job
      const { data: job, error: jobError } = await supabase
        .from('MarginAnalysisJobs')
        .insert([{
          customer_name: 'ALL',
          carrier_name: selectedCarrier.name,
          analysis_type: analysisType,
          status: 'running',
          started_at: new Date().toISOString(),
          date_range_start: dateRange.start,
          date_range_end: dateRange.end,
          selected_carriers: [selectedCarrier.name]
        }])
        .select()
        .single();

      if (jobError) throw jobError;

      console.log('✅ Analysis job created:', job.id);

      // Query ALL shipments in the date range
      console.log(`🔍 Querying ALL shipments in date range: ${dateRange.start} to ${dateRange.end}`);
      
      let shipmentQuery = supabase
        .from('Shipments')
        .select('*')
        .gte('"Scheduled Pickup Date"', dateRange.start)
        .lte('"Scheduled Pickup Date"', dateRange.end);

      const { data: allShipments, error: shipmentError } = await shipmentQuery;

      if (shipmentError) throw shipmentError;

      console.log(`📦 Found ${allShipments?.length || 0} total shipments in date range`);

      if (!allShipments || allShipments.length === 0) {
        throw new Error(`No shipments found in the selected date range`);
      }

      // Initialize arrays to store API call data
      const apiCalls = [];
      const apiResponses = [];
      const rateData = [];
      const validShipments = [];
      
      // Process each shipment with P44 API
      console.log(`🔄 Making P44 API calls for ALL shipments...`);
      
      for (const shipment of allShipments) {
        try {
          console.log(`📦 Processing shipment: ${shipment["Invoice #"]}`);
          
          // Convert shipment to RFQ format
          const rfq = {
            fromDate: shipment["Scheduled Pickup Date"] || new Date().toISOString().split('T')[0],
            fromZip: shipment["Zip"] || '',
            toZip: shipment["Zip_1"] || '',
            pallets: parseInt(shipment["Tot Packages"]?.toString() || '1'),
            grossWeight: parseInt(shipment["Tot Weight"]?.toString().replace(/[^\d]/g, '') || '1000'),
            isStackable: false,
            accessorial: shipment["Accessorials"]?.split(';') || []
          };
          
          // Call P44 API to get current rates
          console.log(`🔍 Calling P44 API for current rates on shipment ${shipment["Invoice #"]}`);
          const quotes = await project44Client!.getQuotes(rfq, [selectedCarrierId], false, false, false);
          
          console.log(`✅ Received ${quotes.length} quotes from P44`);
          
          // Store API call details
          apiCalls.push({
            shipmentId: shipment["Invoice #"],
            timestamp: new Date().toISOString(),
            request: rfq,
            responseCount: quotes.length
          });
          
          // Store API response
          apiResponses.push({
            shipmentId: shipment["Invoice #"],
            quotes: quotes
          });
          
          // If we got valid quotes, store the shipment and rate data
          if (quotes.length > 0) {
            validShipments.push(shipment);
            
            const bestQuote = quotes.reduce((best, current) => {
              const bestTotal = best.rateQuoteDetail?.total || 
                (best.baseRate + best.fuelSurcharge + best.premiumsAndDiscounts);
              
              const currentTotal = current.rateQuoteDetail?.total || 
                (current.baseRate + current.fuelSurcharge + current.premiumsAndDiscounts);
              
              return currentTotal < bestTotal ? current : best;
            });
            
            const quoteTotal = bestQuote.rateQuoteDetail?.total || 
              (bestQuote.baseRate + bestQuote.fuelSurcharge + bestQuote.premiumsAndDiscounts);
            
            rateData.push({
              shipmentId: shipment["Invoice #"],
              customer: shipment["Customer"],
              carrier: selectedCarrier.name,
              originalRevenue: parseFloat(shipment["Revenue"] || '0'),
              originalExpense: parseFloat(shipment["Carrier Expense"] || '0'),
              originalProfit: parseFloat(shipment["Profit"] || '0'),
              currentRate: quoteTotal,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error(`❌ Error processing shipment ${shipment["Invoice #"]}:`, error);
          // Continue with next shipment
        }
      }
      
      console.log(`✅ Completed ${apiCalls.length} API calls, found ${validShipments.length} valid shipments`);
      
      // Group shipments by customer
      const customerRateData = rateData.reduce((groups, data) => {
        const customer = data.customer || 'Unknown';
        if (!groups[customer]) {
          groups[customer] = [];
        }
        groups[customer].push(data);
        return groups;
      }, {} as Record<string, any[]>);
      
      console.log(`👥 Found ${Object.keys(customerRateData).length} customers with rate data`);
      
      // Process each customer separately
      const customerResults = [];
      
      for (const [customer, customerRates] of Object.entries(customerRateData)) {
        console.log(`🔍 Analyzing customer: ${customer} with ${customerRates.length} shipments`);
        
        // Get customer-specific margin from CustomerCarriers table
        const { data: customerCarriers, error: ccError } = await supabase
          .from('CustomerCarriers')
          .select('Percentage, P44CarrierCode')
          .eq('InternalName', customer)
          .ilike('P44CarrierCode', `%${selectedCarrier.name}%`);
        
        if (ccError) {
          console.error(`Error fetching margin for ${customer}:`, ccError);
        }
        
        // Calculate current margin from rate data
        const totalRevenue = customerRates.reduce((sum, r) => sum + r.originalRevenue, 0);
        const totalExpense = customerRates.reduce((sum, r) => sum + r.originalExpense, 0);
        const totalProfit = customerRates.reduce((sum, r) => sum + r.originalProfit, 0);
        
        const avgRevenue = customerRates.length > 0 ? totalRevenue / customerRates.length : 0;
        const avgExpense = customerRates.length > 0 ? totalExpense / customerRates.length : 0;
        const avgProfit = customerRates.length > 0 ? totalProfit / customerRates.length : 0;
        
        // Calculate current P44 rates
        const totalCurrentRate = customerRates.reduce((sum, r) => sum + r.currentRate, 0);
        const avgCurrentRate = customerRates.length > 0 ? totalCurrentRate / customerRates.length : 0;
        
        // Calculate current margin as a percentage
        const currentMargin = avgRevenue > 0 ? (avgProfit / avgRevenue) * 100 : 0;
        
        // Get target margin from database or use default
        const targetMargin = customerCarriers && customerCarriers.length > 0 
          ? parseFloat(customerCarriers[0].Percentage || '15')
          : 15; // Default to 15% if no specific margin found
        
        // Calculate confidence score based on number of shipments
        const confidenceScore = Math.min(95, Math.max(60, 70 + (customerRates.length * 2)));
        
        // Calculate potential revenue impact
        const potentialImpact = ((targetMargin - currentMargin) / 100) * avgRevenue * customerRates.length;
        
        console.log(`📊 Analysis for ${customer}:`, {
          shipmentCount: customerRates.length,
          avgRevenue: avgRevenue.toFixed(2),
          avgExpense: avgExpense.toFixed(2),
          avgProfit: avgProfit.toFixed(2),
          avgCurrentRate: avgCurrentRate.toFixed(2),
          currentMargin: currentMargin.toFixed(2),
          targetMargin: targetMargin.toFixed(2),
          confidenceScore,
          potentialImpact: potentialImpact.toFixed(2)
        });
        
        // Store results for this customer
        customerResults.push({
          customer,
          shipmentCount: customerRates.length,
          avgRevenue,
          avgExpense,
          avgProfit,
          avgCurrentRate,
          currentMargin,
          targetMargin,
          confidenceScore,
          potentialImpact
        });
        
        // Create recommendation if margin improvement is possible
        if (Math.abs(targetMargin - currentMargin) > 1) {
          const { error: recError } = await supabase
            .from('MarginRecommendations')
            .insert([{
              customer_name: customer,
              carrier_name: selectedCarrier.name,
              current_margin: currentMargin,
              recommended_margin: targetMargin,
              confidence_score: confidenceScore,
              potential_revenue_impact: potentialImpact,
              shipment_count: customerRates.length,
              avg_shipment_value: avgRevenue,
              margin_variance: Math.abs(targetMargin - currentMargin)
            }]);

          if (recError) console.error(`Failed to create recommendation for ${customer}:`, recError);
        }
      }

      // Update job with results
      const { error: updateError } = await supabase
        .from('MarginAnalysisJobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          shipment_count: allShipments.length,
          first_phase_completed: true,
          phase_one_api_calls: apiCalls,
          phase_one_api_responses: apiResponses,
          phase_one_valid_shipments: validShipments,
          phase_one_rate_data: rateData,
          first_phase_data: {
            customer_count: Object.keys(customerRateData).length,
            total_shipments: allShipments.length,
            valid_shipments: validShipments.length,
            api_calls: apiCalls.length,
            customer_results: customerResults,
            date_range: dateRange
          }
        })
        .eq('id', job.id);

      if (updateError) throw updateError;

      console.log('✅ Margin analysis completed successfully');
      
      // Reload data
      await Promise.all([loadJobs(), loadRecommendations()]);

    } catch (err) {
      console.error('❌ Margin analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      
      // Update job status to failed if we have a job ID
      // TODO: Update job status to failed
    } finally {
      setIsRunningAnalysis(false);
    }
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
            <h1 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h1>
            <p className="text-sm text-gray-600">
              Analyze and optimize customer-carrier margin performance using AI-powered insights
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'analysis', label: 'Run Analysis', icon: Calculator },
            { id: 'recommendations', label: 'Recommendations', icon: Target },
            { id: 'history', label: 'History', icon: Clock }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
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

      {/* Tab Content */}
      {activeTab === 'analysis' && renderAnalysisTab()}
      {activeTab === 'recommendations' && renderRecommendationsTab()}
      {activeTab === 'history' && renderHistoryTab()}
    </div>
  );
};
```