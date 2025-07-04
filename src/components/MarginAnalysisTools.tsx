import React, { useState } from 'react';
import { 
  Calculator, 
  DollarSign, 
  Percent, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Target,
  Truck,
  Users,
  Building2,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Info
} from 'lucide-react';
import { formatCurrency } from '../utils/pricingCalculator';

interface MarginScenario {
  id: number;
  name: string;
  baseRate: number;
  marginPercentage: number;
  minimumProfit: number;
  customerPrice: number;
  profit: number;
  profitMargin: number;
}

export const MarginAnalysisTools: React.FC = () => {
  const [baseRate, setBaseRate] = useState(1000);
  const [marginPercentage, setMarginPercentage] = useState(15);
  const [minimumProfit, setMinimumProfit] = useState(100);
  const [scenarios, setScenarios] = useState<MarginScenario[]>([
    {
      id: 1,
      name: 'Standard Margin',
      baseRate: 1000,
      marginPercentage: 15,
      minimumProfit: 100,
      customerPrice: 1176.47,
      profit: 176.47,
      profitMargin: 15
    },
    {
      id: 2,
      name: 'Premium Margin',
      baseRate: 1000,
      marginPercentage: 20,
      minimumProfit: 150,
      customerPrice: 1250,
      profit: 250,
      profitMargin: 20
    },
    {
      id: 3,
      name: 'Economy Margin',
      baseRate: 1000,
      marginPercentage: 12,
      minimumProfit: 75,
      customerPrice: 1136.36,
      profit: 136.36,
      profitMargin: 12
    }
  ]);
  const [showScenarioForm, setShowScenarioForm] = useState(false);
  const [editingScenario, setEditingScenario] = useState<MarginScenario | null>(null);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [newMarginPercentage, setNewMarginPercentage] = useState(15);
  const [newMinimumProfit, setNewMinimumProfit] = useState(100);
  const [showComparisonTable, setShowComparisonTable] = useState(true);
  const [showMarginCalculator, setShowMarginCalculator] = useState(true);
  const [showBreakEvenAnalysis, setShowBreakEvenAnalysis] = useState(true);

  // Calculate customer price and profit based on margin percentage
  const calculatePrice = (baseRate: number, marginPct: number, minProfit: number): { customerPrice: number; profit: number; profitMargin: number } => {
    // Calculate price using margin formula: Price = Cost / (1 - Margin%)
    const marginDecimal = marginPct / 100;
    let customerPrice = baseRate / (1 - marginDecimal);
    let profit = customerPrice - baseRate;
    
    // Apply minimum profit if needed
    if (profit < minProfit) {
      customerPrice = baseRate + minProfit;
      profit = minProfit;
    }
    
    // Calculate actual profit margin percentage
    const profitMargin = (profit / customerPrice) * 100;
    
    return {
      customerPrice: Math.round(customerPrice * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100
    };
  };

  // Update price calculation when inputs change
  const updateCalculation = () => {
    const { customerPrice, profit, profitMargin } = calculatePrice(baseRate, marginPercentage, minimumProfit);
    
    // Update scenarios with the new base rate
    setScenarios(prevScenarios => 
      prevScenarios.map(scenario => {
        const updated = calculatePrice(baseRate, scenario.marginPercentage, scenario.minimumProfit);
        return {
          ...scenario,
          baseRate,
          customerPrice: updated.customerPrice,
          profit: updated.profit,
          profitMargin: updated.profitMargin
        };
      })
    );
    
    return { customerPrice, profit, profitMargin };
  };

  // Handle base rate change
  const handleBaseRateChange = (value: number) => {
    setBaseRate(value);
    updateCalculation();
  };

  // Handle margin percentage change
  const handleMarginPercentageChange = (value: number) => {
    setMarginPercentage(value);
    updateCalculation();
  };

  // Handle minimum profit change
  const handleMinimumProfitChange = (value: number) => {
    setMinimumProfit(value);
    updateCalculation();
  };

  // Add or update scenario
  const handleSaveScenario = () => {
    if (!newScenarioName.trim()) return;
    
    const { customerPrice, profit, profitMargin } = calculatePrice(baseRate, newMarginPercentage, newMinimumProfit);
    
    if (editingScenario) {
      // Update existing scenario
      setScenarios(prevScenarios => 
        prevScenarios.map(scenario => 
          scenario.id === editingScenario.id 
            ? {
                ...scenario,
                name: newScenarioName,
                marginPercentage: newMarginPercentage,
                minimumProfit: newMinimumProfit,
                customerPrice,
                profit,
                profitMargin
              }
            : scenario
        )
      );
    } else {
      // Add new scenario
      const newId = Math.max(0, ...scenarios.map(s => s.id)) + 1;
      setScenarios(prevScenarios => [
        ...prevScenarios,
        {
          id: newId,
          name: newScenarioName,
          baseRate,
          marginPercentage: newMarginPercentage,
          minimumProfit: newMinimumProfit,
          customerPrice,
          profit,
          profitMargin
        }
      ]);
    }
    
    // Reset form
    setNewScenarioName('');
    setNewMarginPercentage(15);
    setNewMinimumProfit(100);
    setEditingScenario(null);
    setShowScenarioForm(false);
  };

  // Edit scenario
  const handleEditScenario = (scenario: MarginScenario) => {
    setEditingScenario(scenario);
    setNewScenarioName(scenario.name);
    setNewMarginPercentage(scenario.marginPercentage);
    setNewMinimumProfit(scenario.minimumProfit);
    setShowScenarioForm(true);
  };

  // Delete scenario
  const handleDeleteScenario = (id: number) => {
    setScenarios(prevScenarios => prevScenarios.filter(scenario => scenario.id !== id));
  };

  // Calculate current price and profit
  const { customerPrice, profit, profitMargin } = calculatePrice(baseRate, marginPercentage, minimumProfit);

  // Calculate break-even analysis
  const breakEvenAnalysis = {
    breakEvenRate: minimumProfit / (marginPercentage / 100),
    maxDiscountAmount: baseRate - (minimumProfit / (marginPercentage / 100)),
    maxDiscountPercent: ((baseRate - (minimumProfit / (marginPercentage / 100))) / baseRate) * 100
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Margin Analysis Tools</h2>
          <p className="text-sm text-gray-600">Calculate and compare different pricing scenarios</p>
        </div>
      </div>

      {/* Margin Calculator */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div 
          className="px-6 py-4 border-b border-gray-200 flex items-center justify-between cursor-pointer"
          onClick={() => setShowMarginCalculator(!showMarginCalculator)}
        >
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Margin Calculator</h3>
          </div>
          {showMarginCalculator ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
        </div>
        
        {showMarginCalculator && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Base Rate Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="inline h-4 w-4 mr-1" />
                  Carrier Base Rate
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={baseRate}
                    onChange={(e) => handleBaseRateChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1000"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    $
                  </div>
                </div>
              </div>
              
              {/* Margin Percentage Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Percent className="inline h-4 w-4 mr-1" />
                  Margin Percentage
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={marginPercentage}
                    onChange={(e) => handleMarginPercentageChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="15"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    %
                  </div>
                </div>
              </div>
              
              {/* Minimum Profit Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="inline h-4 w-4 mr-1" />
                  Minimum Profit
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={minimumProfit}
                    onChange={(e) => handleMinimumProfitChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="100"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    $
                  </div>
                </div>
              </div>
            </div>
            
            {/* Results */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-blue-700 mb-1">Customer Price</div>
                <div className="text-2xl font-bold text-blue-900">{formatCurrency(customerPrice)}</div>
                <div className="text-xs text-blue-600 mt-1">
                  Formula: Base Rate / (1 - Margin%)
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-sm text-green-700 mb-1">Profit Amount</div>
                <div className="text-2xl font-bold text-green-900">{formatCurrency(profit)}</div>
                <div className="text-xs text-green-600 mt-1">
                  Formula: Customer Price - Base Rate
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="text-sm text-purple-700 mb-1">Actual Margin</div>
                <div className="text-2xl font-bold text-purple-900">{profitMargin.toFixed(1)}%</div>
                <div className="text-xs text-purple-600 mt-1">
                  Formula: (Profit / Customer Price) × 100
                </div>
              </div>
            </div>
            
            {/* Explanation */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">How Margin Calculation Works</h4>
              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  <strong>Margin</strong> is calculated as a percentage of the <strong>selling price</strong>, not the cost.
                </p>
                <p>
                  The formula to calculate price from margin is: <code className="bg-gray-100 px-1 py-0.5 rounded">Price = Cost / (1 - Margin%)</code>
                </p>
                <p>
                  For example, with a base rate of ${baseRate} and a margin of {marginPercentage}%:
                </p>
                <p>
                  Price = ${baseRate} / (1 - {marginPercentage/100}) = ${customerPrice.toFixed(2)}
                </p>
                <p>
                  If the calculated profit (${profit.toFixed(2)}) is less than the minimum profit (${minimumProfit}), 
                  the minimum profit will be used instead.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Break-Even Analysis */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div 
          className="px-6 py-4 border-b border-gray-200 flex items-center justify-between cursor-pointer"
          onClick={() => setShowBreakEvenAnalysis(!showBreakEvenAnalysis)}
        >
          <div className="flex items-center space-x-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <Target className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Break-Even Analysis</h3>
          </div>
          {showBreakEvenAnalysis ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
        </div>
        
        {showBreakEvenAnalysis && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <div className="text-sm text-orange-700 mb-1">Break-Even Rate</div>
                <div className="text-2xl font-bold text-orange-900">{formatCurrency(breakEvenAnalysis.breakEvenRate)}</div>
                <div className="text-xs text-orange-600 mt-1">
                  Minimum carrier rate to maintain profit
                </div>
              </div>
              
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="text-sm text-red-700 mb-1">Maximum Discount</div>
                <div className="text-2xl font-bold text-red-900">{formatCurrency(breakEvenAnalysis.maxDiscountAmount)}</div>
                <div className="text-xs text-red-600 mt-1">
                  {breakEvenAnalysis.maxDiscountPercent.toFixed(1)}% of base rate
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-blue-700 mb-1">Minimum Selling Price</div>
                <div className="text-2xl font-bold text-blue-900">{formatCurrency(baseRate + minimumProfit)}</div>
                <div className="text-xs text-blue-600 mt-1">
                  Base Rate + Minimum Profit
                </div>
              </div>
            </div>
            
            {/* Explanation */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Understanding Break-Even Analysis</h4>
              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  <strong>Break-Even Rate</strong> is the carrier rate at which your minimum profit requirement is exactly met at your target margin percentage.
                </p>
                <p>
                  <strong>Maximum Discount</strong> is how much you can reduce the carrier rate while still maintaining your minimum profit at your target margin.
                </p>
                <p>
                  <strong>Minimum Selling Price</strong> is the absolute lowest price you can charge while still meeting your minimum profit requirement.
                </p>
                <p>
                  These metrics help you understand your pricing flexibility and negotiation boundaries.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scenario Comparison */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div 
          className="px-6 py-4 border-b border-gray-200 flex items-center justify-between cursor-pointer"
          onClick={() => setShowComparisonTable(!showComparisonTable)}
        >
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Margin Scenario Comparison</h3>
          </div>
          {showComparisonTable ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
        </div>
        
        {showComparisonTable && (
          <div className="p-6">
            <div className="flex justify-between mb-4">
              <button
                onClick={() => setShowScenarioForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Scenario
              </button>
            </div>
            
            {/* Scenario Form */}
            {showScenarioForm && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-3">
                  {editingScenario ? 'Edit Scenario' : 'Add New Scenario'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">
                      Scenario Name
                    </label>
                    <input
                      type="text"
                      value={newScenarioName}
                      onChange={(e) => setNewScenarioName(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Premium Pricing"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">
                      Margin Percentage
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={newMarginPercentage}
                        onChange={(e) => setNewMarginPercentage(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 pr-8 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="15"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500">
                        %
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">
                      Minimum Profit
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={newMinimumProfit}
                        onChange={(e) => setNewMinimumProfit(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 pr-8 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="100"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500">
                        $
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-4">
                  <button
                    onClick={() => {
                      setShowScenarioForm(false);
                      setEditingScenario(null);
                    }}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <X className="h-4 w-4 mr-1 inline" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveScenario}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Check className="h-4 w-4 mr-1 inline" />
                    {editingScenario ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
            )}
            
            {/* Scenarios Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scenario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Base Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Margin %
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Min Profit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actual Margin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scenarios.map((scenario) => (
                    <tr key={scenario.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {scenario.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(scenario.baseRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {scenario.marginPercentage}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(scenario.minimumProfit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatCurrency(scenario.customerPrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        {formatCurrency(scenario.profit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 font-medium">
                        {scenario.profitMargin.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => handleEditScenario(scenario)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteScenario(scenario.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Comparison Chart */}
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Profit Comparison</h4>
              <div className="space-y-4">
                {scenarios.map((scenario) => (
                  <div key={scenario.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full bg-blue-500`}></div>
                        <span className="text-sm font-medium text-gray-700">{scenario.name}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(scenario.profit)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${Math.min(100, (scenario.profit / (baseRate * 0.5)) * 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>Margin: {scenario.marginPercentage}%</span>
                      <span>Price: {formatCurrency(scenario.customerPrice)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Scenario Insights */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Info className="h-4 w-4 mr-1 text-blue-500" />
                Scenario Insights
              </h4>
              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  <strong>Best Profit:</strong> {formatCurrency(Math.max(...scenarios.map(s => s.profit)))} with {
                    scenarios.find(s => s.profit === Math.max(...scenarios.map(s => s.profit)))?.name
                  } scenario
                </p>
                <p>
                  <strong>Price Range:</strong> {formatCurrency(Math.min(...scenarios.map(s => s.customerPrice)))} to {formatCurrency(Math.max(...scenarios.map(s => s.customerPrice)))}
                </p>
                <p>
                  <strong>Margin Range:</strong> {Math.min(...scenarios.map(s => s.marginPercentage))}% to {Math.max(...scenarios.map(s => s.marginPercentage))}%
                </p>
                <p>
                  <strong>Recommendation:</strong> {
                    scenarios.length > 0 
                      ? `The ${scenarios.find(s => s.profit === Math.max(...scenarios.map(s => s.profit)))?.name} scenario provides the best balance of profit and competitiveness.`
                      : 'Add scenarios to get recommendations.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Customer-Specific Margin Analysis */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-green-600 p-2 rounded-lg">
            <Users className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Customer-Specific Margin Analysis</h3>
        </div>
        
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
          <div className="flex items-start space-x-3">
            <Building2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-green-800 mb-1">Customer-Specific Margins</h4>
              <p className="text-sm text-green-700">
                Configure customer-specific margins in the Margins tab. These will override your default margin settings when a customer is selected.
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
          <div className="flex items-start space-x-3">
            <Truck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-800 mb-1">Carrier-Specific Margins</h4>
              <p className="text-sm text-blue-700">
                You can set different margins for specific carriers within each customer's profile. This allows for precise control over pricing for each customer-carrier relationship.
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <TrendingUp className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-purple-800 mb-1">Margin Hierarchy</h4>
              <p className="text-sm text-purple-700">
                The system applies margins in this order of priority:
              </p>
              <ol className="list-decimal list-inside text-sm text-purple-700 mt-2 space-y-1">
                <li>Customer-carrier specific margin (if available)</li>
                <li>Customer default margin (if available)</li>
                <li>Fallback margin percentage (configured in settings)</li>
                <li>Global default margin (configured in settings)</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};