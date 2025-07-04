// Utility functions for pricing calculations and formatting

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatProfit = (profit: number): string => {
  const color = profit >= 0 ? 'text-green-600' : 'text-red-600';
  return formatCurrency(profit);
};

export const formatChargeDescription = (charge: any): string => {
  if (!charge) return 'Unknown Charge';
  
  // Handle different charge object structures
  if (charge.description) return charge.description;
  if (charge.name) return charge.name;
  if (charge.type) return charge.type;
  if (charge.chargeType) return charge.chargeType;
  
  // Fallback to a generic description
  return 'Freight Charge';
};

export const calculateMargin = (customerPrice: number, carrierCost: number): number => {
  if (carrierCost === 0) return 0;
  return ((customerPrice - carrierCost) / carrierCost) * 100;
};

export const calculateProfit = (customerPrice: number, carrierCost: number): number => {
  return customerPrice - carrierCost;
};

export const applyMargin = (baseCost: number, marginPercentage: number): number => {
  return baseCost * (1 + marginPercentage / 100);
};