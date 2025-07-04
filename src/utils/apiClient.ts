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
  HazmatDetail,
  EnhancedHandlingUnit
} from '../types';

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

  constructor(config: Project44OAuthConfig) {
    this.config = config;
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

  // NEW: Package type mapping for API compatibility
  private mapPackageType(packageType?: string): string {
    if (!packageType) return 'PLT';
    
    // Map common package types to API-compatible values
    const packageTypeMapping: { [key: string]: string } = {
      'PLT': 'PLT',
      'PALLET': 'PLT', // Map PALLET to PLT
      'BOX': 'BOX',
      'CRATE': 'CRATE',
      'CARTON': 'CARTON',
      'CASE': 'CASE',
      'DRUM': 'DRUM',
      'PAIL': 'PAIL',
      'TOTE': 'TOTE',
      'TUBE': 'TUBE',
      'ROLL': 'ROLL',
      'REEL': 'REEL',
      'PIECES': 'PIECES',
      'SKID': 'SKID',
      'BUNDLE': 'BUNDLE',
      'BALE': 'BALE',
      'BAG': 'BAG',
      'BUCKET': 'BUCKET',
      'CAN': 'CAN',
      'COIL': 'COIL',
      'CYLINDER': 'CYLINDER'
    };
    
    const mapped = packageTypeMapping[packageType.toUpperCase()];
    if (!mapped) {
      console.warn(`⚠️ Unknown package type '${packageType}', defaulting to 'PLT'`);
      return 'PLT';
    }
    
    console.log(`📦 Mapped package type '${packageType}' to '${mapped}'`);
    return mapped;
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
      lineItems: this.buildLineItems(rfq), // Always include line items as required by API
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
      
      // Add enhanced handling units for VLTL
      requestPayload.enhancedHandlingUnits = this.buildEnhancedHandlingUnits(rfq);
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
      lineItems: this.buildLineItems(rfq), // Always include line items as required by API
      accessorialServices: this.buildAccessorialServices(rfq, isReeferMode),
      pickupWindow: this.buildPickupWindow(rfq),
      deliveryWindow: this.buildDeliveryWindow(rfq),
      apiConfiguration: {
        accessorialServiceConfiguration: {
          allowUnacceptedAccessorials: false,
          fetchAllGuaranteed: false,
          fetchAllInsideDelivery: false,
          fetchAllServiceLevels: false
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
      
      // Add enhanced handling units for VLTL
      requestPayload.enhancedHandlingUnits = this.buildEnhancedHandlingUnits(rfq);
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

  private calculateLinearFeet(rfq: RFQRow): number {
    // Calculate linear feet based on pallets and dimensions
    // Standard pallet is 48" x 40", so length is typically 48"
    const palletLength = 48; // inches - use standard pallet length
    const totalLinearInches = rfq.pallets * palletLength;
    const totalLinearFeet = Math.ceil(totalLinearInches / 12);
    
    console.log(`📏 Calculated linear feet: ${rfq.pallets} pallets × ${palletLength}" = ${totalLinearInches}" = ${totalLinearFeet} linear feet`);
    return totalLinearFeet;
  }

  // NEW: Build enhanced handling units for VLTL
  private buildEnhancedHandlingUnits(rfq: RFQRow): EnhancedHandlingUnit[] {
    const handlingUnits: EnhancedHandlingUnit[] = [];
    
    if (rfq.lineItems && rfq.lineItems.length > 0) {
      // Use line items to create enhanced handling units
      rfq.lineItems.forEach((item, index) => {
        const handlingUnit: EnhancedHandlingUnit = {
          description: item.description || `Item ${index + 1}`,
          handlingUnitDimensions: {
            length: item.packageLength,
            width: item.packageWidth,
            height: item.packageHeight
          },
          handlingUnitQuantity: item.totalPackages || 1,
          handlingUnitType: this.mapPackageType(item.packageType) as any,
          weightPerHandlingUnit: item.totalWeight / (item.totalPackages || 1),
          stackable: item.stackable,
          freightClasses: [item.freightClass],
          commodityType: item.commodityType,
          harmonizedCode: item.harmonizedCode
        };
        
        if (item.totalValue) {
          handlingUnit.totalValue = {
            amount: item.totalValue,
            currency: 'USD'
          };
        }
        
        if (item.nmfcItemCode) {
          handlingUnit.nmfcCodes = [{ code: item.nmfcItemCode }];
        }
        
        handlingUnits.push(handlingUnit);
      });
    } else {
      // Create a single handling unit from RFQ data
      const handlingUnit: EnhancedHandlingUnit = {
        description: rfq.commodityDescription || 'General Freight',
        handlingUnitDimensions: {
          length: 48, // Standard pallet length
          width: 40,  // Standard pallet width
          height: 48  // Standard pallet height
        },
        handlingUnitQuantity: rfq.pallets,
        handlingUnitType: this.mapPackageType(rfq.packageType) as any,
        weightPerHandlingUnit: rfq.grossWeight / rfq.pallets,
        stackable: rfq.isStackable,
        freightClasses: [rfq.freightClass || '70'],
        commodityType: rfq.commodityType
      };
      
      if (rfq.totalValue) {
        handlingUnit.totalValue = {
          amount: rfq.totalValue,
          currency: 'USD'
        };
      }
      
      if (rfq.nmfcCode) {
        handlingUnit.nmfcCodes = [{ code: rfq.nmfcCode }];
      }
      
      handlingUnits.push(handlingUnit);
    }
    
    console.log(`📦 Built ${handlingUnits.length} enhanced handling units for VLTL:`, handlingUnits);
    return handlingUnits;
  }

  private getCarrierNameFromCode(carrierCode?: string): string {
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
  }

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
    console.log('📦 Building line items for Project44 API...');
    
    // If line items are provided, use them
    if (rfq.lineItems && rfq.lineItems.length > 0) {
      console.log(`📦 Using ${rfq.lineItems.length} provided line items`);
      return rfq.lineItems.map(item => {
        const lineItem: LineItem = {
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
          packageType: this.mapPackageType(item.packageType) as any,
          stackable: item.stackable,
          totalPackages: item.totalPackages,
          totalPieces: item.totalPieces,
          totalValue: item.totalValue,
          harmonizedCode: item.harmonizedCode,
          id: item.id,
          insuranceAmount: item.insuranceAmount
        };

        // Add hazmat details if present
        if (item.hazmat) {
          lineItem.hazmatDetail = {
            hazardClass: item.hazmatClass || '',
            identificationNumber: item.hazmatIdNumber || '',
            packingGroup: item.hazmatPackingGroup || 'III',
            properShippingName: item.hazmatProperShippingName || ''
          };
        }

        console.log(`📦 Built line item: ${item.description} - ${item.totalWeight}lbs - ${item.freightClass} - ${item.packageLength}x${item.packageWidth}x${item.packageHeight}`);
        return lineItem;
      });
    }

    // Fallback to single line item from RFQ data
    console.log('📦 Creating single line item from RFQ data');
    const lineItem: LineItem = {
      totalWeight: rfq.grossWeight,
      packageDimensions: {
        length: 48, // Standard pallet length
        width: 40,  // Standard pallet width  
        height: 48  // Standard pallet height
      },
      freightClass: rfq.freightClass || '70',
      description: rfq.commodityDescription || 'General Freight',
      nmfcItemCode: rfq.nmfcCode,
      nmfcSubCode: rfq.nmfcSubCode,
      commodityType: rfq.commodityType,
      countryOfManufacture: rfq.countryOfManufacture,
      packageType: this.mapPackageType(rfq.packageType) as any,
      stackable: rfq.isStackable,
      totalPackages: rfq.totalPackages || rfq.pallets,
      totalPieces: rfq.totalPieces || rfq.pallets,
      totalValue: rfq.totalValue,
      harmonizedCode: rfq.h