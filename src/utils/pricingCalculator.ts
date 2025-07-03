import { Quote, QuoteWithPricing, PricingSettings, RateCharge } from '../types';

export const calculatePricing = (
  quote: Quote, 
  settings: PricingSettings,
  customPrice?: number
): QuoteWithPricing => {
  // Use the Project44 total directly - no complex categorization
  let carrierTotalRate: number;
  let chargeBreakdown = {
    baseCharges: [] as RateCharge[],
    fuelCharges: [] as RateCharge[],
    accessorialCharges: [] as RateCharge[],
    discountCharges: [] as RateCharge[],
    premiumCharges: [] as RateCharge[],
    otherCharges: [] as RateCharge[]
  };

  if (quote.rateQuoteDetail?.total !== undefined && quote.rateQuoteDetail.total > 0) {
    // Use Project44's calculated total
    carrierTotalRate = quote.rateQuoteDetail.total;
    
    // Simply display ALL charges exactly as they come from Project44
    if (quote.rateQuoteDetail.charges && Array.isArray(quote.rateQuoteDetail.charges)) {
      // Put all charges in "otherCharges" to display them exactly as received
      chargeBreakdown.otherCharges = [...quote.rateQuoteDetail.charges];
      
      console.log(`💰 Displaying ${quote.rateQuoteDetail.charges.length} charges exactly as received from Project44`);
      quote.rateQuoteDetail.charges.forEach((charge, index) => {
        console.log(`  ${index + 1}. ${charge.code || 'NO_CODE'} - ${charge.description || 'No description'}: $${charge.amount || 0}`);
      });
    }
    
    // For legacy compatibility, set these to zero since we're showing actual charges
    quote.baseRate = 0;
    quote.fuelSurcharge = 0;
    quote.premiumsAndDiscounts = carrierTotalRate;
  } else if (quote.baseRate > 0 || quote.fuelSurcharge > 0) {
    // Fall back to legacy calculation if we have valid base components
    carrierTotalRate = quote.baseRate + quote.fuelSurcharge + quote.premiumsAndDiscounts;
    
    // Create legacy charge breakdown
    if (quote.baseRate > 0) {
      chargeBreakdown.baseCharges.push({
        amount: quote.baseRate,
        code: 'BASE',
        description: 'Base Rate'
      });
    }
    
    if (quote.fuelSurcharge > 0) {
      chargeBreakdown.fuelCharges.push({
        amount: quote.fuelSurcharge,
        code: 'FUEL',
        description: 'Fuel Surcharge'
      });
    }
    
    if (quote.premiumsAndDiscounts !== 0) {
      if (quote.premiumsAndDiscounts > 0) {
        chargeBreakdown.premiumCharges.push({
          amount: quote.premiumsAndDiscounts,
          code: 'PREMIUM',
          description: 'Premiums and Accessorials'
        });
      } else {
        chargeBreakdown.discountCharges.push({
          amount: quote.premiumsAndDiscounts,
          code: 'DISCOUNT',
          description: 'Discounts'
        });
      }
    }
    
    // Add accessorial charges if available
    if (quote.accessorial && Array.isArray(quote.accessorial)) {
      quote.accessorial.forEach(acc => {
        if (typeof acc === 'object' && acc.amount) {
          chargeBreakdown.accessorialCharges.push(acc);
        }
      });
    }
  } else {
    // No valid pricing data - this quote should have been filtered out
    console.warn('Quote has no valid pricing data:', quote);
    carrierTotalRate = 0;
  }
  
  let customerPrice: number;
  let markupApplied: number;
  let isCustomPrice = false;

  if (customPrice !== undefined) {
    // Custom price override
    customerPrice = customPrice;
    markupApplied = customerPrice - carrierTotalRate;
    isCustomPrice = true;
  } else {
    // Apply default markup
    if (settings.markupType === 'percentage') {
      markupApplied = carrierTotalRate * (settings.markupPercentage / 100);
    } else {
      markupApplied = settings.markupPercentage;
    }
    
    // Ensure minimum profit is met
    markupApplied = Math.max(markupApplied, settings.minimumProfit);
    customerPrice = carrierTotalRate + markupApplied;
  }

  const profit = customerPrice - carrierTotalRate;

  return {
    ...quote,
    carrierTotalRate,
    customerPrice,
    profit,
    markupApplied,
    isCustomPrice,
    chargeBreakdown
  };
};

export const calculateBestQuote = (quotes: QuoteWithPricing[]): QuoteWithPricing | null => {
  if (quotes.length === 0) return null;
  
  return quotes.reduce((best, current) => 
    current.customerPrice < best.customerPrice ? current : best
  );
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatProfit = (profit: number): string => {
  const formatted = formatCurrency(profit);
  return profit >= 0 ? `+${formatted}` : formatted;
};

export const getTotalChargesByCategory = (charges: RateCharge[]): number => {
  return charges.reduce((sum, charge) => sum + charge.amount, 0);
};

export const formatChargeDescription = (charge: RateCharge): string => {
  if (charge.description) {
    return charge.description;
  }
  
  // Fallback to code-based descriptions
  const codeDescriptions: { [key: string]: string } = {
    'BASE': 'Base Rate',
    'FUEL': 'Fuel Surcharge',
    'LGPU': 'Liftgate Pickup',
    'LGDEL': 'Liftgate Delivery',
    'INPU': 'Inside Pickup',
    'INDEL': 'Inside Delivery',
    'RESPU': 'Residential Pickup',
    'RESDEL': 'Residential Delivery',
    'APPTPU': 'Appointment Pickup',
    'APPTDEL': 'Appointment Delivery',
    'LTDPU': 'Limited Access Pickup',
    'LTDDEL': 'Limited Access Delivery'
  };
  
  return codeDescriptions[charge.code] || charge.code || 'Additional Charge';
};