import { 
  RFQRow, 
  Quote, 
  Project44OAuthConfig, 
  OAuthTokenResponse,
  Project44RateQuoteRequest,
  Project44RateQuoteResponse,
  CapacityProvider,
  ServiceLevelInfo,
  ServiceLevelsCollection,
  CapacityProviderIdentifier,
  LineItem,
  AccessorialService,
  TimeWindow,
  Address,
  CapacityProviderAccountInfosCollection,
  CapacityProviderAccountInfos,
  CapacityProviderAccountGroupInfo,
  RateCharge,
  Contact,
  HazmatDetail
} from '../types';
import { memoize, batchRequests } from './performance';

// Carrier group interface for organizing carriers
export interface CarrierGroup {
  groupCode: string;
  groupName: string;
  carriers: Array<{
    id: string;
    name: string;
    scac?: string;
    mcNumber?: string;
    dotNumber?: string;
    accountCode?: string;
  }>;
}

export class Project44APIClient {
  private config: Project44OAuthConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private carrierGroups: CarrierGroup[] = []; // Store carrier groups for lookup
  private requestCache = new Map<string, any>();

  constructor(config: Project44OAuthConfig) {
    this.config = config;
  }

  // Clear the request cache
  public clearCache(): void {
    this.requestCache.clear();
    console.log('🧹 Cleared API request cache');
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    console.log('🔑 Obtaining new Project44 access token...');

    const isDev = import.meta.env.DEV;
    const oauthUrl = isDev 
      ? '/api/project44-oauth/api/v4/oauth2/token'
      : '/.netlify/functions/project44-oauth-proxy/api/v4/oauth2/token';

    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', this.config.clientId);
    formData.append('client_secret', this.config.clientSecret);

    try {
      const response = await fetch(oauthUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OAuth failed:', response.status, errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error_description: errorText };
        }

        // Provide specific error messages based on the response
        if (response.status === 401 && errorData.error === 'invalid_client') {
          throw new Error(`Invalid OAuth credentials: ${errorData.error_description || 'The client secret supplied for a confidential client is invalid'}. Please verify your Client ID and Client Secret are correct.`);
        } else if (response.status === 520) {
          throw new Error(`Network error (520): This may be a temporary issue with Project44's API gateway. Please wait a few minutes and try again.`);
        } else {
          throw new Error(`OAuth authentication failed: ${response.status} - ${errorData.error_description || errorText}`);
        }
      }

      const tokenData: OAuthTokenResponse = await response.json();
      
      this.accessToken = tokenData.access_token;
      // Set expiry to 90% of the actual expiry time for safety
      this.tokenExpiry = Date.now() + (tokenData.expires_in * 900);
      
      console.log('✅ Project44 access token obtained successfully');
      return this.accessToken;
    } catch (error) {
      // Re-throw with more context if it's a network error
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Network connection failed. Please check your internet connection and try again.');
      }
      throw error;
    }
  }

  async getAvailableCarriersByGroup(isVolumeMode: boolean = false, isFTLMode: boolean = false): Promise<CarrierGroup[]> {
    const token = await this.getAccessToken();
    
    const modeDescription = isVolumeMode ? 'Volume LTL (VLTL)' : isFTLMode ? 'Full Truckload' : 'Standard LTL';
    console.log(`🚛 Loading carriers for ${modeDescription}...`);

    const isDev = import.meta.env.DEV;
    const baseUrl = isDev ? '/api/project44' : '/.netlify/functions/project44-proxy';
    
    try {
      // Step 1: Get all account groups
      console.log('📋 Fetching capacity provider account groups...');
      const groupsResponse = await fetch(`${baseUrl}/api/v4/capacityprovideraccountgroups`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!groupsResponse.ok) {
        const errorText = await groupsResponse.text();
        console.error('❌ Failed to fetch account groups:', groupsResponse.status, errorText);
        throw new Error(`Failed to fetch account groups: ${groupsResponse.status} - ${errorText}`);
      }

      const groupsData = await groupsResponse.json();
      console.log('📦 Account groups response:', groupsData);

      // Extract groups from response
      const accountGroups: CapacityProviderAccountGroupInfo[] = Array.isArray(groupsData) 
        ? groupsData 
        : (groupsData.groups || []);

      if (accountGroups.length === 0) {
        console.log('⚠️ No account groups found, falling back to default group');
        // Fallback to getting accounts without group filter
        return await this.getCarriersWithoutGroups(token, baseUrl, isVolumeMode, isFTLMode);
      }

      console.log(`📋 Found ${accountGroups.length} account groups`);

      // Step 2: Get accounts for each group
      const carrierGroups: CarrierGroup[] = [];

      for (const group of accountGroups) {
        console.log(`🔍 Loading carriers for group: ${group.name} (${group.code})`);
        
        try {
          const accountsResponse = await fetch(`${baseUrl}/api/v4/capacityprovideraccounts?accountGroupCode=${encodeURIComponent(group.code)}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });

          if (!accountsResponse.ok) {
            console.warn(`⚠️ Failed to fetch accounts for group ${group.code}:`, accountsResponse.status);
            continue;
          }

          const accountsData: CapacityProviderAccountInfosCollection = await accountsResponse.json();
          console.log(`📦 Accounts for group ${group.code}:`, accountsData);

          if (!accountsData.accounts || accountsData.accounts.length === 0) {
            console.log(`ℹ️ No accounts found for group ${group.code}`);
            continue;
          }

          // Transform accounts to carriers
          const carriers = accountsData.accounts.map((accountInfo: CapacityProviderAccountInfos) => {
            const scacId = accountInfo.capacityProviderIdentifier?.type === 'SCAC' 
              ? accountInfo.capacityProviderIdentifier.value 
              : undefined;

            // Extract carrier name from the account info
            const carrierName = this.getCarrierNameFromAccountInfo(accountInfo, scacId);

            return {
              id: accountInfo.code || scacId || carrierName.replace(/\s+/g, '_').toUpperCase(),
              name: carrierName,
              scac: scacId,
              mcNumber: accountInfo.capacityProviderIdentifier?.type === 'MC_NUMBER' 
                ? accountInfo.capacityProviderIdentifier.value 
                : undefined,
              dotNumber: accountInfo.capacityProviderIdentifier?.type === 'DOT_NUMBER' 
                ? accountInfo.capacityProviderIdentifier.value 
                : undefined,
              accountCode: accountInfo.code
            };
          });

          if (carriers.length > 0) {
            carrierGroups.push({
              groupCode: group.code,
              groupName: `${group.name} (${modeDescription})`,
              carriers: carriers.sort((a, b) => a.name.localeCompare(b.name))
            });
          }

        } catch (error) {
          console.warn(`⚠️ Error loading accounts for group ${group.code}:`, error);
          continue;
        }
      }

      // Sort groups alphabetically
      carrierGroups.sort((a, b) => a.groupName.localeCompare(b.groupName));

      const totalCarriers = carrierGroups.reduce((sum, group) => sum + group.carriers.length, 0);
      console.log(`✅ Loaded ${carrierGroups.length} carrier groups with ${totalCarriers} total carriers for ${modeDescription}`);
      
      // Store carrier groups for lookup
      this.carrierGroups = carrierGroups;
      
      return carrierGroups;

    } catch (error) {
      console.error('❌ Error in getAvailableCarriersByGroup:', error);
      // Fallback to the old method if the new API fails
      console.log('🔄 Falling back to capacity providers endpoint...');
      return await this.getCarriersWithoutGroups(token, baseUrl, isVolumeMode, isFTLMode);
    }
  }

  private async getCarriersWithoutGroups(token: string, baseUrl: string, isVolumeMode: boolean, isFTLMode: boolean): Promise<CarrierGroup[]> {
    const modeDescription = isVolumeMode ? 'Volume LTL (VLTL)' : isFTLMode ? 'Full Truckload' : 'Standard LTL';
    console.log(`📋 Using fallback method to load carriers for ${modeDescription}...`);
    
    const endpoint = '/api/v4/capacity-providers';

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to fetch carriers:', response.status, errorText);
      throw new Error(`Failed to fetch carriers: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const allCarriers = Array.isArray(data) ? data : (data.capacityProviders || []);
    
    // Apply filtering logic for different modes
    let displayCarriers = allCarriers;
    
    if (isVolumeMode) {
      // Filter for Volume LTL - show carriers that support VOLUME_LTL
      displayCarriers = allCarriers.filter((provider: CapacityProvider) => {
        return provider.supportedServices?.some(service => 
          service.mode === 'VOLUME_LTL' || service.mode === 'LTL'
        ) ?? true;
      });
      console.log(`🔍 Filtered ${allCarriers.length} carriers down to ${displayCarriers.length} VLTL-capable carriers`);
    } else if (!isFTLMode) {
      // Only filter for standard LTL - show carriers that support LTL
      displayCarriers = allCarriers.filter((provider: CapacityProvider) => {
        return provider.supportedServices?.some(service => 
          service.mode === 'LTL'
        ) ?? true;
      });
      console.log(`🔍 Filtered ${allCarriers.length} carriers down to ${displayCarriers.length} LTL-capable carriers`);
    }
    
    const carrierGroup: CarrierGroup = {
      groupCode: 'Default',
      groupName: modeDescription + ' Carriers',
      carriers: displayCarriers.map((provider: CapacityProvider) => {
        const scacId = provider.capacityProviderIdentifiers?.find(id => id.type === 'SCAC');
        const mcId = provider.capacityProviderIdentifiers?.find(id => id.type === 'MC_NUMBER');
        const dotId = provider.capacityProviderIdentifiers?.find(id => id.type === 'DOT_NUMBER');

        return {
          id: scacId?.value || provider.name.replace(/\s+/g, '_').toUpperCase(),
          name: this.getImprovedCarrierName(provider.name, scacId?.value),
          scac: scacId?.value,
          mcNumber: mcId?.value,
          dotNumber: dotId?.value
        };
      }).sort((a, b) => a.name.localeCompare(b.name))
    };

    // Store carrier groups for lookup
    this.carrierGroups = [carrierGroup];

    return [carrierGroup];
  }

  // Helper method to find the group code for a given carrier ID
  private findGroupCodeForCarrier(carrierId: string): string {
    for (const group of this.carrierGroups) {
      const carrier = group.carriers.find(c => c.id === carrierId);
      if (carrier) {
        console.log(`🔍 Found carrier ${carrierId} in group ${group.groupCode}`);
        return group.groupCode;
      }
    }
    console.log(`⚠️ Carrier ${carrierId} not found in any group, using Default`);
    return 'Default';
  }

  private getCarrierNameFromAccountInfo(accountInfo: CapacityProviderAccountInfos, scac?: string): string {
    // Map common SCAC codes to proper carrier names
    const scacToName: { [key: string]: string } = {
      'FXFE': 'FedEx Freight',
      'ODFL': 'Old Dominion Freight Line',
      'SAIA': 'Saia LTL Freight',
      'RLCA': 'R+L Carriers',
      'ABFS': 'ABF Freight',
      'CTII': 'Central Transport',
      'DHRN': 'Dayton Freight Lines',
      'EXLA': 'Estes Express Lines',
      'FWDA': 'Forward Air',
      'LAKL': 'Lakeville Motor Express',
      'NEMF': 'New England Motor Freight',
      'PITT': 'Pitt Ohio',
      'SEFL': 'Southeastern Freight Lines',
      'UPGF': 'UPS Freight',
      'WARD': 'Ward Transport',
      'YELL': 'YRC Freight'
    };

    // If we have a SCAC and it's in our mapping, use the proper name
    if (scac && scacToName[scac]) {
      return scacToName[scac];
    }

    // Try to extract a meaningful name from the account code or use SCAC
    if (accountInfo.code) {
      // If the code looks like a company name, use it
      if (accountInfo.code.length > 4 && !accountInfo.code.match(/^[A-Z]{4}$/)) {
        return this.cleanCarrierName(accountInfo.code);
      }
    }

    // Fallback to SCAC or account code
    return scac || accountInfo.code || 'Unknown Carrier';
  }

  private getImprovedCarrierName(originalName: string, scac?: string): string {
    // Map common SCAC codes to proper carrier names
    const scacToName: { [key: string]: string } = {
      'FXFE': 'FedEx Freight',
      'ODFL': 'Old Dominion Freight Line',
      'SAIA': 'Saia LTL Freight',
      'RLCA': 'R+L Carriers',
      'ABFS': 'ABF Freight',
      'CTII': 'Central Transport',
      'DHRN': 'Dayton Freight Lines',
      'EXLA': 'Estes Express Lines',
      'FWDA': 'Forward Air',
      'LAKL': 'Lakeville Motor Express',
      'NEMF': 'New England Motor Freight',
      'PITT': 'Pitt Ohio',
      'SEFL': 'Southeastern Freight Lines',
      'UPGF': 'UPS Freight',
      'WARD': 'Ward Transport',
      'YELL': 'YRC Freight'
    };

    // If we have a SCAC and it's in our mapping, use the proper name
    if (scac && scacToName[scac]) {
      return scacToName[scac];
    }

    return this.cleanCarrierName(originalName);
  }

  private cleanCarrierName(name: string): string {
    return name
      .replace(/\b(inc|llc|ltd|corp|corporation)\b/gi, '') // Remove common suffixes
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  async getServiceLevelsByCarriers(carrierIds: string[], isVolumeMode: boolean = false, isFTLMode: boolean = false): Promise<ServiceLevelInfo[]> {
    const token = await this.getAccessToken();
    
    const modeDescription = isVolumeMode ? 'Volume LTL (VLTL)' : isFTLMode ? 'Full Truckload' : 'Standard LTL';
    console.log(`🎯 Fetching service levels for ${modeDescription} carriers:`, carrierIds);

    const isDev = import.meta.env.DEV;
    const baseUrl = isDev ? '/api/project44' : '/.netlify/functions/project44-proxy';
    
    // Use the appropriate endpoint based on mode
    let endpoint = '/api/v4/ltl/service-levels';
    if (isVolumeMode) {
      endpoint = '/api/v4/vltl/service-levels';
    } else if (isFTLMode) {
      endpoint = '/api/v4/truckload/service-levels';
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to fetch service levels:', response.status, errorText);
      throw new Error(`Failed to fetch service levels: ${response.status} - ${errorText}`);
    }

    const data: ServiceLevelsCollection = await response.json();
    console.log('🎯 Raw service levels response:', data);

    // Extract service levels from the response
    const serviceLevels: ServiceLevelInfo[] = [];
    
    if (data.serviceLevels) {
      data.serviceLevels.forEach(response => {
        if (response.serviceLevels) {
          serviceLevels.push(...response.serviceLevels);
        }
      });
    }

    console.log(`✅ Loaded ${serviceLevels.length} service levels for ${modeDescription}`);
    return serviceLevels;
  }

  async getQuotes(
    rfq: RFQRow, 
    selectedCarrierIds: string[] = [], 
    isVolumeMode: boolean = false,
    isFTLMode: boolean = false,
    isReeferMode: boolean = false
  ): Promise<Quote[]> {
    const token = await this.getAccessToken();
    
    const modeDescription = isReeferMode ? 'Refrigerated LTL' : 
                           isVolumeMode ? 'Volume LTL (VLTL)' : 
                           isFTLMode ? 'Full Truckload' : 'Standard LTL';
    
    // Find the group code from the first selected carrier
    const accountGroupCode = selectedCarrierIds.length > 0 
      ? this.findGroupCodeForCarrier(selectedCarrierIds[0])
      : 'Default';
    
    console.log(`💰 Getting ${modeDescription} quotes for:`, {
      route: `${rfq.fromZip} → ${rfq.toZip}`,
      pallets: rfq.pallets,
      weight: rfq.grossWeight,
      temperature: rfq.temperature,
      isReeferMode,
      isVolumeMode,
      totalLinearFeet: rfq.totalLinearFeet,
      selectedCarriers: selectedCarrierIds.length,
      accountGroupCode
    });

    const isDev = import.meta.env.DEV;
    const baseUrl = isDev ? '/api/project44' : '/.netlify/functions/project44-proxy';
    
    // Use the appropriate endpoint based on mode
    let endpoint = '/api/v4/ltl/quotes/rates/query';
    if (isVolumeMode) {
      endpoint = '/api/v4/vltl/quotes/rates/query';
    } else if (isFTLMode) {
      endpoint = '/api/v4/truckload/quotes/rates/query';
    }

    // Build the request payload with comprehensive data
    const requestPayload: Project44RateQuoteRequest = {
      originAddress: this.buildAddress(rfq),
      destinationAddress: this.buildDestinationAddress(rfq),
      lineItems: this.buildLineItems(rfq),
      accessorialServices: this.buildAccessorialServices(rfq, isReeferMode),
      pickupWindow: this.buildPickupWindow(rfq),
      deliveryWindow: this.buildDeliveryWindow(rfq),
      apiConfiguration: {
        accessorialServiceConfiguration: {
          allowUnacceptedAccessorials: true,
          fetchAllGuaranteed: true,
          fetchAllInsideDelivery: false,
          fetchAllServiceLevels: true
        },
        enableUnitConversion: rfq.enableUnitConversion ?? true,
        fallBackToDefaultAccountGroup: rfq.fallBackToDefaultAccountGroup ?? true,
        timeout: rfq.apiTimeout ?? 30000
      },
      directionOverride: rfq.direction,
      lengthUnit: rfq.lengthUnit || 'IN',
      paymentTermsOverride: rfq.paymentTerms,
      preferredCurrency: rfq.preferredCurrency || 'USD',
      preferredSystemOfMeasurement: rfq.preferredSystemOfMeasurement || 'IMPERIAL',
      weightUnit: rfq.weightUnit || 'LB'
    };

    // Add totalLinearFeet for VLTL requests (required field)
    if (isVolumeMode) {
      requestPayload.totalLinearFeet = rfq.totalLinearFeet || this.calculateLinearFeet(rfq);
      console.log(`📏 Using totalLinearFeet: ${requestPayload.totalLinearFeet} for VLTL request`);
      
      // DO NOT add enhanced handling units for VLTL - just use lineItems
      console.log('📦 Using standard lineItems for VLTL (no enhanced handling units)');
    }

    // Add capacity provider account group to filter by selected carriers
    if (selectedCarrierIds.length > 0) {
      requestPayload.capacityProviderAccountGroup = {
        accounts: selectedCarrierIds.map(carrierId => ({ code: carrierId })),
        code: accountGroupCode
      };
      console.log(`🎯 Filtering quotes to ${selectedCarrierIds.length} selected carriers in group ${accountGroupCode}:`, selectedCarrierIds);
    } else {
      console.log('⚠️ No carriers selected - will get quotes from all available carriers');
    }

    console.log('📤 Sending comprehensive request payload:', JSON.stringify(requestPayload, null, 2));

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to get ${modeDescription} quotes:`, response.status, errorText);
      throw new Error(`Failed to get ${modeDescription} quotes: ${response.status} - ${errorText}`);
    }

    const data: Project44RateQuoteResponse = await response.json();
    console.log(`📥 Received ${modeDescription} response:`, data);

    if (!data.rateQuotes || data.rateQuotes.length === 0) {
      console.log(`ℹ️ No ${modeDescription} quotes returned`);
      return [];
    }

    // Group quotes by carrierCode and serviceLevel, keeping only the cheapest for each combination
    const groupedQuotes = new Map<string, any>();
    
    data.rateQuotes.forEach(rateQuote => {
      const carrierCode = rateQuote.carrierCode || 'UNKNOWN';
      const serviceCode = rateQuote.serviceLevel?.code || 'STD';
      const groupKey = `${carrierCode}-${serviceCode}`;
      
      // Only keep quotes with valid pricing
      const hasValidTotal = rateQuote.rateQuoteDetail?.total !== undefined && rateQuote.rateQuoteDetail.total > 0;
      if (!hasValidTotal) {
        console.log('⚠️ Skipping quote with invalid total:', rateQuote.id);
        return;
      }
      
      // If we don't have this combination yet, or this quote is cheaper, keep it
      if (!groupedQuotes.has(groupKey) || 
          rateQuote.rateQuoteDetail.total < groupedQuotes.get(groupKey).rateQuoteDetail.total) {
        groupedQuotes.set(groupKey, rateQuote);
      }
    });

    console.log(`🔍 Filtered ${data.rateQuotes.length} quotes down to ${groupedQuotes.size} unique carrier/service combinations for ${modeDescription}`);

    // Transform the filtered quotes to our Quote interface
    const quotes: Quote[] = Array.from(groupedQuotes.values()).map((rateQuote, index) => {
      // Get carrier name from carrierCode mapping or use the code itself
      const carrierName = this.getCarrierNameFromCode(rateQuote.carrierCode);
      const carrierCode = rateQuote.carrierCode || '';

      const quote: Quote = {
        quoteId: index + 1,
        baseRate: 0, // Will be set by pricing calculator
        fuelSurcharge: 0, // Will be set by pricing calculator
        accessorial: [], // Will be populated from charges
        premiumsAndDiscounts: rateQuote.rateQuoteDetail?.total || 0, // Use total for now
        readyByDate: rfq.fromDate,
        estimatedDeliveryDate: rateQuote.deliveryDateTime || '',
        weight: rfq.grossWeight,
        pallets: rfq.pallets,
        stackable: rfq.isStackable,
        pickup: {
          city: rfq.originCity || '',
          state: rfq.originState || '',
          zip: rfq.fromZip
        },
        dropoff: {
          city: rfq.destinationCity || '',
          state: rfq.destinationState || '',
          zip: rfq.toZip
        },
        submittedBy: `Project44 ${modeDescription}`,
        submissionDatetime: new Date().toISOString(),
        carrier: {
          name: carrierName,
          mcNumber: '',
          logo: '',
          scac: carrierCode,
          dotNumber: ''
        },
        // Project44 specific fields
        rateQuoteDetail: rateQuote.rateQuoteDetail,
        serviceLevel: rateQuote.serviceLevel,
        transitDays: rateQuote.transitDays,
        transitDaysRange: rateQuote.transitDaysRange,
        carrierCode: rateQuote.carrierCode,
        contractId: rateQuote.contractId,
        currencyCode: rateQuote.currencyCode,
        laneType: rateQuote.laneType,
        quoteEffectiveDateTime: rateQuote.quoteEffectiveDateTime,
        quoteExpirationDateTime: rateQuote.quoteExpirationDateTime,
        deliveryDateTime: rateQuote.deliveryDateTime,
        id: rateQuote.id
      };

      // Add temperature for reefer quotes
      if (isReeferMode && rfq.temperature) {
        quote.temperature = rfq.temperature;
      }

      return quote;
    });

    console.log(`✅ Transformed ${quotes.length} filtered ${modeDescription} quotes from selected carriers`);
    return quotes;
  }

  // Optimized batch quoting for multiple RFQs
  async batchGetQuotes(
    rfqs: RFQRow[],
    selectedCarrierIds: string[] = [],
    isVolumeMode: boolean = false,
    isFTLMode: boolean = false,
    isReeferMode: boolean = false,
    batchSize: number = 5
  ): Promise<{ [index: number]: Quote[] }> {
    const results: { [index: number]: Quote[] } = {};
    
    // Process in batches to avoid overwhelming the API
    const processBatch = async (batch: RFQRow[]) => {
      const batchResults = await Promise.allSettled(
        batch.map(rfq => this.getQuotes(
          rfq,
          selectedCarrierIds,
          isVolumeMode,
          isFTLMode,
          isReeferMode
        ))
      );
      
      // Process results
      batchResults.forEach((result, index) => {
        const batchIndex = batch[index].rowIndex;
        if (result.status === 'fulfilled') {
          results[batchIndex] = result.value;
        } else {
          console.error(`❌ Failed to get quotes for RFQ ${batchIndex}:`, result.reason);
          results[batchIndex] = [];
        }
      });
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    };
    
    // Process RFQs in batches
    for (let i = 0; i < rfqs.length; i += batchSize) {
      const batch = rfqs.slice(i, i + batchSize);
      await processBatch(batch);
    }
    
    return results;
  }

  // Method to get quotes for an entire account group
  async getQuotesForAccountGroup(
    rfq: RFQRow,
    accountGroupCode: string,
    isVolumeMode: boolean = false,
    isFTLMode: boolean = false,
    isReeferMode: boolean = false
  ): Promise<Quote[]> {
    const token = await this.getAccessToken();
    
    const modeDescription = isReeferMode ? 'Refrigerated LTL' : 
                           isVolumeMode ? 'Volume LTL (VLTL)' : 
                           isFTLMode ? 'Full Truckload' : 'Standard LTL';
    
    console.log(`💰 Getting ${modeDescription} quotes for entire account group:`, {
      accountGroup: accountGroupCode,
      route: `${rfq.fromZip} → ${rfq.toZip}`,
      pallets: rfq.pallets,
      weight: rfq.grossWeight
    });

    const isDev = import.meta.env.DEV;
    const baseUrl = isDev ? '/api/project44' : '/.netlify/functions/project44-proxy';
    
    // Use the appropriate endpoint based on mode
    let endpoint = '/api/v4/ltl/quotes/rates/query';
    if (isVolumeMode) {
      endpoint = '/api/v4/vltl/quotes/rates/query';
    } else if (isFTLMode) {
      endpoint = '/api/v4/truckload/quotes/rates/query';
    }

    // Build the request payload with comprehensive data
    const requestPayload: Project44RateQuoteRequest = {
      originAddress: this.buildAddress(rfq),
      destinationAddress: this.buildDestinationAddress(rfq),
      lineItems: this.buildLineItems(rfq),
      accessorialServices: this.buildAccessorialServices(rfq, isReeferMode),
      pickupWindow: this.buildPickupWindow(rfq),
      deliveryWindow: this.buildDeliveryWindow(rfq),
      apiConfiguration: {
        accessorialServiceConfiguration: {
          allowUnacceptedAccessorials: true,
          fetchAllGuaranteed: true,
          fetchAllInsideDelivery: false,
          fetchAllServiceLevels: true
        },
        enableUnitConversion: rfq.enableUnitConversion ?? true,
        fallBackToDefaultAccountGroup: rfq.fallBackToDefaultAccountGroup ?? true,
        timeout: rfq.apiTimeout ?? 30000
      },
      directionOverride: rfq.direction,
      lengthUnit: rfq.lengthUnit || 'IN',
      paymentTermsOverride: rfq.paymentTerms,
      preferredCurrency: rfq.preferredCurrency || 'USD',
      preferredSystemOfMeasurement: rfq.preferredSystemOfMeasurement || 'IMPERIAL',
      weightUnit: rfq.weightUnit || 'LB',
      // For entire group, just specify the group code without accounts array
      capacityProviderAccountGroup: {
        code: accountGroupCode
      }
    };

    // Add totalLinearFeet for VLTL requests (required field)
    if (isVolumeMode) {
      requestPayload.totalLinearFeet = rfq.totalLinearFeet || this.calculateLinearFeet(rfq);
      console.log(`📏 Using totalLinearFeet: ${requestPayload.totalLinearFeet} for VLTL request`);
      
      // DO NOT add enhanced handling units for VLTL - just use lineItems
      console.log('📦 Using standard lineItems for VLTL (no enhanced handling units)');
    }

    console.log('📤 Sending group request payload:', JSON.stringify(requestPayload, null, 2));

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to get ${modeDescription} quotes for group:`, response.status, errorText);
      throw new Error(`Failed to get ${modeDescription} quotes for group: ${response.status} - ${errorText}`);
    }

    const data: Project44RateQuoteResponse = await response.json();
    console.log(`📥 Received ${modeDescription} group response with ${data.rateQuotes?.length || 0} quotes`);

    if (!data.rateQuotes || data.rateQuotes.length === 0) {
      console.log(`ℹ️ No ${modeDescription} quotes returned for group ${accountGroupCode}`);
      return [];
    }

    // Filter out quotes with invalid pricing
    const validQuotes = data.rateQuotes.filter(quote => 
      quote.rateQuoteDetail?.total !== undefined && 
      quote.rateQuoteDetail.total > 0
    );

    console.log(`🔍 Filtered ${data.rateQuotes.length} quotes down to ${validQuotes.length} valid quotes for group ${accountGroupCode}`);

    // Transform the filtered quotes to our Quote interface
    const quotes: Quote[] = validQuotes.map((rateQuote, index) => {
      // Get carrier name from carrierCode mapping or use the code itself
      const carrierName = this.getCarrierNameFromCode(rateQuote.carrierCode);
      const carrierCode = rateQuote.carrierCode || '';

      const quote: Quote = {
        quoteId: index + 1,
        baseRate: 0, // Will be set by pricing calculator
        fuelSurcharge: 0, // Will be set by pricing calculator
        accessorial: [], // Will be populated from charges
        premiumsAndDiscounts: rateQuote.rateQuoteDetail?.total || 0, // Use total for now
        readyByDate: rfq.fromDate,
        estimatedDeliveryDate: rateQuote.deliveryDateTime || '',
        weight: rfq.grossWeight,
        pallets: rfq.pallets,
        stackable: rfq.isStackable,
        pickup: {
          city: rfq.originCity || '',
          state: rfq.originState || '',
          zip: rfq.fromZip
        },
        dropoff: {
          city: rfq.destinationCity || '',
          state: rfq.destinationState || '',
          zip: rfq.toZip
        },
        submittedBy: `Project44 ${modeDescription}`,
        submissionDatetime: new Date().toISOString(),
        carrier: {
          name: carrierName,
          mcNumber: '',
          logo: '',
          scac: carrierCode,
          dotNumber: ''
        },
        // Project44 specific fields
        rateQuoteDetail: rateQuote.rateQuoteDetail,
        serviceLevel: rateQuote.serviceLevel,
        transitDays: rateQuote.transitDays,
        transitDaysRange: rateQuote.transitDaysRange,
        carrierCode: rateQuote.carrierCode,
        contractId: rateQuote.contractId,
        currencyCode: rateQuote.currencyCode,
        laneType: rateQuote.laneType,
        quoteEffectiveDateTime: rateQuote.quoteEffectiveDateTime,
        quoteExpirationDateTime: rateQuote.quoteExpirationDateTime,
        deliveryDateTime: rateQuote.deliveryDateTime,
        id: rateQuote.id
      };

      // Add temperature for reefer quotes
      if (isReeferMode && rfq.temperature) {
        quote.temperature = rfq.temperature;
      }

      return quote;
    });

    console.log(`✅ Transformed ${quotes.length} quotes from account group ${accountGroupCode}`);
    return quotes;
  }

  // Memoized linear feet calculation for better performance
  private calculateLinearFeet = memoize((rfq: RFQRow): number => {
    // Calculate linear feet based on pallets and dimensions
    // Standard pallet is 48" x 40", so length is typically 48"
    const palletLength = 48; // inches - use standard pallet length
    const totalLinearInches = rfq.pallets * palletLength;
    const totalLinearFeet = Math.ceil(totalLinearInches / 12);
    
    console.log(`📏 Calculated linear feet: ${rfq.pallets} pallets × ${palletLength}" = ${totalLinearInches}" = ${totalLinearFeet} linear feet`);
    return totalLinearFeet;
  });

  // Memoized carrier name lookup for better performance
  private getCarrierNameFromCode = memoize((carrierCode?: string): string => {
    if (!carrierCode) return 'Unknown Carrier';
    
    // Map common carrier codes to proper names
    const codeToName: { [key: string]: string } = {
      'FXFE': 'FedEx Freight',
      'ODFL': 'Old Dominion Freight Line',
      'SAIA': 'Saia LTL Freight',
      'RLCA': 'R+L Carriers',
      'ABFS': 'ABF Freight',
      'CTII': 'Central Transport',
      'DHRN': 'Dayton Freight Lines',
      'EXLA': 'Estes Express Lines',
      'FWDA': 'Forward Air',
      'LAKL': 'Lakeville Motor Express',
      'NEMF': 'New England Motor Freight',
      'PITT': 'Pitt Ohio',
      'SEFL': 'Southeastern Freight Lines',
      'UPGF': 'UPS Freight',
      'WARD': 'Ward Transport',
      'YELL': 'YRC Freight',
      'UPSN': 'UPS Freight',
      'CNWY': 'Conway Freight',
      'RDWY': 'Roadway Express',
      'YRCW': 'YRC Worldwide'
    };

    return codeToName[carrierCode] || carrierCode;
  });

  private buildAddress(rfq: RFQRow): Address {
    return {
      addressLines: rfq.originAddressLines || [],
      city: rfq.originCity || '',
      country: rfq.originCountry || 'US',
      postalCode: rfq.fromZip,
      state: rfq.originState || ''
    };
  }

  private buildDestinationAddress(rfq: RFQRow): Address {
    return {
      addressLines: rfq.destinationAddressLines || [],
      city: rfq.destinationCity || '',
      country: rfq.destinationCountry || 'US',
      postalCode: rfq.toZip,
      state: rfq.destinationState || ''
    };
  }

  private buildLineItems(rfq: RFQRow): LineItem[] {
    // If line items are provided, use them
    if (rfq.lineItems && rfq.lineItems.length > 0) {
      return rfq.lineItems.map(item => ({
        totalWeight: item.totalWeight,
        packageDimensions: {
          length: item.packageLength,
          width: item.packageWidth,
          height: item.packageHeight
        },
        freightClass: item.freightClass,
        description: item.description,
        nmfcItemCode: item.nmfcItemCode,
        nmfcSubCode: item.nmfcSubCode,
        commodityType: item.commodityType,
        countryOfManufacture: item.countryOfManufacture,
        hazmatDetail: item.hazmat ? {
          hazardClass: item.hazmatClass || '',
          identificationNumber: item.hazmatIdNumber || '',
          packingGroup: item.hazmatPackingGroup || 'III',
          properShippingName: item.hazmatProperShippingName || ''
        } : undefined,
        id: item.id,
        insuranceAmount: item.insuranceAmount,
        packageType: item.packageType,
        stackable: item.stackable,
        totalPackages: item.totalPackages,
        totalPieces: item.totalPieces,
        totalValue: item.totalValue,
        harmonizedCode: item.harmonizedCode
      }));
    }

    // Fallback to single line item from RFQ data
    const lineItem: LineItem = {
      totalWeight: rfq.grossWeight,
      packageDimensions: {
        length: 48, // Standard pallet length
        width: 40,  // Standard pallet width
        height: 48  // Standard pallet height
      },
      freightClass: rfq.freightClass || '70',
      description: rfq.commodityDescription,
      nmfcItemCode: rfq.nmfcCode,
      nmfcSubCode: rfq.nmfcSubCode,
      commodityType: rfq.commodityType,
      countryOfManufacture: rfq.countryOfManufacture,
      packageType: rfq.packageType,
      stackable: rfq.isStackable,
      totalPackages: rfq.totalPackages || rfq.pallets,
      totalPieces: rfq.totalPieces || rfq.pallets,
      totalValue: rfq.totalValue,
      harmonizedCode: rfq.harmonizedCode
    };

    // Add hazmat details if present
    if (rfq.hazmat) {
      const hazmatDetail: HazmatDetail = {
        hazardClass: rfq.hazmatClass || '',
        identificationNumber: rfq.hazmatIdNumber || '',
        packingGroup: rfq.hazmatPackingGroup || 'III',
        properShippingName: rfq.hazmatProperShippingName || ''
      };

      // Add emergency contact if provided
      if (rfq.emergencyContactName || rfq.emergencyContactPhone) {
        hazmatDetail.emergencyContact = {
          contactName: rfq.emergencyContactName,
          phoneNumber: rfq.emergencyContactPhone,
          companyName: rfq.emergencyContactCompany
        };
      }

      lineItem.hazmatDetail = hazmatDetail;
    }

    // Add insurance amount if provided
    if (rfq.insuranceAmount) {
      lineItem.insuranceAmount = rfq.insuranceAmount;
    }

    return [lineItem];
  }

  private buildAccessorialServices(rfq: RFQRow, isReeferMode: boolean = false): AccessorialService[] {
    const services: AccessorialService[] = [];
    
    // Add user-specified accessorials, filtering out any reefer-specific ones for Project44
    if (rfq.accessorial && rfq.accessorial.length > 0) {
      const reeferAccessorials = ['REEFER', 'TEMP_CONTROLLED', 'FROZEN_PROTECT', 'TEMP_PROTECT'];
      
      // Filter out reefer-specific accessorials when not using FreshX
      const filteredAccessorials = isReeferMode 
        ? rfq.accessorial 
        : rfq.accessorial.filter(code => !reeferAccessorials.includes(code));
      
      filteredAccessorials.forEach(code => {
        services.push({ code });
      });
    }

    // Add temperature-controlled accessorials for reefer mode
    // NOTE: We're not adding any reefer-specific accessorials for Project44
    // as they're not supported. These should only be used with FreshX.
    if (isReeferMode && rfq.temperature && ['CHILLED', 'FROZEN'].includes(rfq.temperature) && false) {
      // This code is intentionally disabled with the "false" condition
      // We're keeping it for reference but ensuring it never executes
      console.log('Reefer accessorials are only supported by FreshX, not Project44');
    }

    return services;
  }

  private buildPickupWindow(rfq: RFQRow): TimeWindow | undefined {
    if (!rfq.pickupStartTime && !rfq.pickupEndTime) {
      return undefined;
    }

    return {
      date: rfq.fromDate,
      startTime: rfq.pickupStartTime || '08:00',
      endTime: rfq.pickupEndTime || '17:00'
    };
  }

  private buildDeliveryWindow(rfq: RFQRow): TimeWindow | undefined {
    if (!rfq.deliveryDate && !rfq.deliveryStartTime && !rfq.deliveryEndTime) {
      return undefined;
    }

    return {
      date: rfq.deliveryDate || rfq.fromDate,
      startTime: rfq.deliveryStartTime || '08:00',
      endTime: rfq.deliveryEndTime || '17:00'
    };
  }
}

export class FreshXAPIClient {
  private apiKey: string;
  private requestCache = new Map<string, any>();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Clear the request cache
  public clearCache(): void {
    this.requestCache.clear();
    console.log('🧹 Cleared FreshX API request cache');
  }

  async getQuotes(rfq: RFQRow): Promise<Quote[]> {
    // Generate cache key based on request parameters
    const cacheKey = `${rfq.fromZip}-${rfq.toZip}-${rfq.pallets}-${rfq.grossWeight}-${rfq.temperature || 'AMBIENT'}`;
    
    // Check cache first
    if (this.requestCache.has(cacheKey)) {
      console.log(`🔍 Using cached FreshX quotes for ${cacheKey}`);
      return this.requestCache.get(cacheKey);
    }
    
    console.log('🌡️ Getting FreshX reefer quotes for:', {
      route: `${rfq.fromZip} → ${rfq.toZip}`,
      pallets: rfq.pallets,
      weight: rfq.grossWeight,
      temperature: rfq.temperature,
      commodity: rfq.commodity
    });

    // Direct call to FreshX API - no proxy needed
    const apiUrl = 'https://api.getfreshx.com/v1/quotes';

    // Build the FreshX request payload
    const requestPayload = {
      fromDate: rfq.fromDate,
      fromZip: rfq.fromZip,
      toZip: rfq.toZip,
      pallets: rfq.pallets,
      grossWeight: rfq.grossWeight.toString(),
      temperature: rfq.temperature || 'AMBIENT',
      commodity: rfq.commodity || 'FOODSTUFFS',
      isFoodGrade: rfq.isFoodGrade || false,
      isStackable: rfq.isStackable,
      accessorial: rfq.accessorial || []
    };

    console.log('📤 Sending FreshX request:', requestPayload);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      console.log('📥 FreshX response status:', response.status);

      if (response.status === 204) {
        console.log('ℹ️ No FreshX quotes available (204 No Content)');
        return [];
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ FreshX API error:', response.status, errorText);
        throw new Error(`FreshX API error: ${response.status} - ${errorText}`);
      }

      const quotes = await response.json();
      console.log('📥 Received FreshX quotes:', quotes);

      if (!Array.isArray(quotes)) {
        console.warn('⚠️ FreshX response is not an array:', quotes);
        return [];
      }

      // Transform FreshX quotes to our Quote interface
      const transformedQuotes: Quote[] = quotes.map((freshxQuote: any) => ({
        quoteId: freshxQuote.quoteId,
        baseRate: freshxQuote.baseRate || 0,
        fuelSurcharge: freshxQuote.fuelSurcharge || 0,
        accessorial: freshxQuote.accessorial || [],
        premiumsAndDiscounts: freshxQuote.premiumsAndDiscounts || 0,
        readyByDate: freshxQuote.readyByDate || rfq.fromDate,
        estimatedDeliveryDate: freshxQuote.estimatedDeliveryDate || '',
        temperature: freshxQuote.temperature,
        weight: freshxQuote.weight || rfq.grossWeight,
        pallets: freshxQuote.pallets || rfq.pallets,
        commodity: freshxQuote.commodity,
        stackable: freshxQuote.stackable,
        foodGrade: freshxQuote.foodGrade,
        pickup: freshxQuote.pickup || {
          city: rfq.originCity || '',
          state: rfq.originState || '',
          zip: rfq.fromZip
        },
        dropoff: freshxQuote.dropoff || {
          city: rfq.destinationCity || '',
          state: rfq.destinationState || '',
          zip: rfq.toZip
        },
        submittedBy: freshxQuote.submittedBy || 'FreshX',
        submissionDatetime: freshxQuote.submissionDatetime || new Date().toISOString(),
        carrier: freshxQuote.carrier || {
          name: 'FreshX Carrier',
          mcNumber: '',
          logo: ''
        }
      }));

      console.log(`✅ Transformed ${transformedQuotes.length} FreshX quotes`);
      
      // Cache the results
      this.requestCache.set(cacheKey, transformedQuotes);
      
      return transformedQuotes;

    } catch (error) {
      console.error('❌ FreshX API call failed:', error);
      throw error;
    }
  }
  
  // Batch quoting for multiple RFQs
  async batchGetQuotes(rfqs: RFQRow[]): Promise<{ [index: number]: Quote[] }> {
    const results: { [index: number]: Quote[] } = {};
    
    // Process in smaller batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < rfqs.length; i += batchSize) {
      const batch = rfqs.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(rfq => this.getQuotes(rfq))
      );
      
      // Store results
      batchResults.forEach((result, index) => {
        const rfqIndex = batch[index].rowIndex;
        if (result.status === 'fulfilled') {
          results[rfqIndex] = result.value;
        } else {
          console.error(`❌ Failed to get FreshX quotes for RFQ ${rfqIndex}:`, result.reason);
          results[rfqIndex] = [];
        }
      });
      
      // Add delay between batches
      if (i + batchSize < rfqs.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return results;
  }
}

// Main function to process RFQ batches with smart routing and pricing
export async function processRFQBatch(
  rfqs: RFQRow[],
  onProgress?: (progress: number, status: string) => void,
  onQuoteReceived?: (rfqIndex: number, quotes: Quote[]) => void
): Promise<{ [index: number]: Quote[] }> {
  console.log(`🚀 Starting batch processing for ${rfqs.length} RFQs`);
  
  // Load configuration from local storage
  const { 
    loadProject44Config, 
    loadFreshXApiKey, 
    loadSelectedCarriers, 
    loadPricingSettings, 
    loadSelectedModes,
    loadSelectedCustomer 
  } = await import('./credentialStorage');
  
  const project44Config = loadProject44Config();
  const freshxApiKey = loadFreshXApiKey();
  const selectedCarriers = loadSelectedCarriers() || {};
  const pricingSettings = loadPricingSettings() || {};
  const selectedModes = loadSelectedModes() || {};
  const selectedCustomer = loadSelectedCustomer();
  
  // Initialize API clients
  let project44Client: Project44APIClient | null = null;
  let freshxClient: FreshXAPIClient | null = null;
  
  if (project44Config) {
    project44Client = new Project44APIClient(project44Config);
  }
  
  if (freshxApiKey) {
    freshxClient = new FreshXAPIClient(freshxApiKey);
  }
  
  if (!project44Client && !freshxClient) {
    throw new Error('No API credentials configured. Please set up Project44 or FreshX credentials.');
  }
  
  // Get selected carrier IDs
  const selectedCarrierIds = Object.keys(selectedCarriers).filter(id => selectedCarriers[id]);
  
  const allResults: { [index: number]: Quote[] } = {};
  let processedCount = 0;
  
  // Process each RFQ
  for (let i = 0; i < rfqs.length; i++) {
    const rfq = rfqs[i];
    // Ensure rowIndex is set for proper tracking
    if (rfq.rowIndex === undefined) {
      rfq.rowIndex = i;
    }
    try {
      onProgress?.(
        Math.floor((i / rfqs.length) * 100),
        `Processing RFQ ${processedCount + 1} of ${rfqs.length}: ${rfq.fromZip} → ${rfq.toZip}`
      );
      
      const quotes: Quote[] = [];
      
      // Determine if this is a reefer shipment - check both isReefer flag and temperature
      const isReeferShipment = rfq.isReefer === true || 
                              (rfq.temperature && ['CHILLED', 'FROZEN'].includes(rfq.temperature));
      
      // Smart routing: Use FreshX for reefer shipments
      if (isReeferShipment && freshxClient) {
        console.log(`🌡️ Using FreshX for reefer shipment: ${rfq.fromZip} → ${rfq.toZip}`);
        try {
          const freshxQuotes = await freshxClient.getQuotes(rfq);
          quotes.push(...freshxQuotes);
        } catch (error: any) {
          console.error('❌ FreshX quotes failed:', error);
        }
      }
      
      // Use Project44 for non-reefer shipments, or as backup if FreshX is not available
      if (project44Client) {
        try {
          // Determine mode based on selected modes and RFQ characteristics
          const isVolumeMode = selectedModes.vltl && rfq.totalLinearFeet && rfq.totalLinearFeet > 12;
          const isFTLMode = selectedModes.ftl && (rfq.pallets >= 26 || rfq.grossWeight >= 40000);
          
          console.log(`📦 Using Project44 for ${isVolumeMode ? 'VLTL' : isFTLMode ? 'FTL' : 'LTL'} shipment: ${rfq.fromZip} → ${rfq.toZip}`);
          
          // Only call Project44 if it's not a reefer shipment, or if FreshX is not available
          if (!isReeferShipment || !freshxClient) {
            const project44Quotes = await project44Client.getQuotes(
              rfq,
              selectedCarrierIds,
              isVolumeMode,
              isFTLMode,
              false  // Always set isReeferMode to false for Project44 to avoid unsupported accessorials
            );
            quotes.push(...project44Quotes);
          }
        } catch (error) {
          console.error('❌ Project44 quotes failed:', error);
        }
      }
      
      // Apply pricing if we have settings and a selected customer
      if (quotes.length > 0 && pricingSettings && selectedCustomer) {
        try {
          const { calculatePricing } = await import('./pricingCalculator');
          
          // Apply pricing to each quote
          for (const quote of quotes) {
            const pricedQuote = calculatePricing(quote, pricingSettings, selectedCustomer);
            Object.assign(quote, pricedQuote);
          }
          
          console.log(`💰 Applied pricing to ${quotes.length} quotes for customer ${selectedCustomer.name}`);
        } catch (error) {
          console.error('❌ Failed to apply pricing:', error);
        }
      }
      
      allResults[i] = quotes;
      if (onQuoteReceived) {
        onQuoteReceived(rfq.rowIndex || i, quotes);
      }
      
      console.log(`✅ Processed RFQ ${i}: ${quotes.length} quotes received`);
      
    } catch (error) {
      console.error(`❌ Failed to process RFQ ${i}:`, error);
      allResults[i] = [];
    }
    
    processedCount++;
  }
  
  onProgress?.(100, `Completed processing ${rfqs.length} RFQs`);
  
  const totalQuotes = Object.values(allResults).reduce((sum, quotes) => sum + quotes.length, 0);
  console.log(`🎉 Batch processing complete: ${totalQuotes} total quotes for ${rfqs.length} RFQs`);
  
  return allResults;
}