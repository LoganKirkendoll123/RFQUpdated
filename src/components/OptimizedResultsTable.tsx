import React, { useState, useMemo, useCallback } from 'react';
import { ProcessingResult } from '../types';
import { 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Filter,
  Search,
  SortAsc,
  SortDesc,
  Eye,
  Users,
  BarChart3,
  Target
} from 'lucide-react';
import { RFQCard } from './RFQCard';
import { CustomerQuoteView } from './CustomerQuoteView';
import { QuoteComparison } from './QuoteComparison';
import { ProfitAnalyzer } from './ProfitAnalyzer';
import { CarrierPerformanceTracker } from './CarrierPerformanceTracker';
import { QuickActions } from './QuickActions';
import { useDebounce } from '../hooks/useDebounce';

interface OptimizedResultsTableProps {
  results: ProcessingResult[];
  onExport: () => void;
  onPriceUpdate: (resultIndex: number, quoteId: number, newPrice: number) => void;
}

export const OptimizedResultsTable: React.FC<OptimizedResultsTableProps> = ({ 
  results, 
  onExport, 
  onPriceUpdate 
}) => {
  const [activeView, setActiveView] = useState<'results' | 'customer' | 'comparison' | 'profit' | 'performance'>('results');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'index' | 'status' | 'quotes' | 'bestPrice'>('index');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');
  const [showCustomerView, setShowCustomerView] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Memoized filtered and sorted results
  const processedResults = useMemo(() => {
    let filtered = results;

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    // Apply search filter
    if (debouncedSearchTerm) {
      filtered = filtered.filter(r => 
        r.originalData.fromZip.includes(debouncedSearchTerm) ||
        r.originalData.toZip.includes(debouncedSearchTerm) ||
        r.quotes.some(q => q.carrier.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
      );
    }

    // Sort results
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'index':
          comparison = a.rowIndex - b.rowIndex;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'quotes':
          comparison = a.quotes.length - b.quotes.length;
          break;
        case 'bestPrice':
          const aBest = a.quotes.length > 0 ? Math.min(...a.quotes.map(q => (q as any).customerPrice || 0)) : Infinity;
          const bBest = b.quotes.length > 0 ? Math.min(...b.quotes.map(q => (q as any).customerPrice || 0)) : Infinity;
          comparison = aBest - bBest;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [results, filterStatus, debouncedSearchTerm, sortBy, sortOrder]);

  const handleSort = useCallback((column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  }, [sortBy, sortOrder]);

  const getSortIcon = (column: typeof sortBy) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />;
  };

  const allQuotes = useMemo(() => 
    results.flatMap(r => r.quotes).filter(q => (q as any).customerPrice !== undefined),
    [results]
  );

  const handleExportCustomerView = useCallback(() => {
    setShowCustomerView(true);
  }, []);

  const handleExportAnalytics = useCallback(() => {
    onExport();
  }, [onExport]);

  const handleShareQuotes = useCallback(() => {
    // Implementation for sharing quotes
    console.log('Share quotes functionality');
  }, []);

  const handleCalculateMargins = useCallback(() => {
    setActiveView('profit');
  }, []);

  const views = [
    { id: 'results', label: 'Results', icon: Eye },
    { id: 'customer', label: 'Customer View', icon: Users },
    { id: 'comparison', label: 'Comparison', icon: Target },
    { id: 'profit', label: 'Profit Analysis', icon: BarChart3 },
    { id: 'performance', label: 'Carrier Performance', icon: BarChart3 }
  ];

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <QuickActions
        results={results}
        onExportCustomerView={handleExportCustomerView}
        onExportAnalytics={handleExportAnalytics}
        onShareQuotes={handleShareQuotes}
        onCalculateMargins={handleCalculateMargins}
      />

      {/* View Tabs */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {views.map((view) => {
              const Icon = view.icon;
              return (
                <button
                  key={view.id}
                  onClick={() => setActiveView(view.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeView === view.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{view.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeView === 'results' && (
            <div className="space-y-6">
              {/* Filters and Search */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by ZIP or carrier..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success Only</option>
                  <option value="error">Errors Only</option>
                </select>

                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Sort by:</span>
                  <button
                    onClick={() => handleSort('bestPrice')}
                    className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <span>Best Price</span>
                    {getSortIcon('bestPrice')}
                  </button>
                  <button
                    onClick={() => handleSort('quotes')}
                    className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <span>Quote Count</span>
                    {getSortIcon('quotes')}
                  </button>
                </div>

                <button
                  onClick={onExport}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </button>
              </div>

              {/* Results */}
              <div className="space-y-6">
                {processedResults.map((result, index) => (
                  <RFQCard
                    key={result.rowIndex}
                    result={result}
                    onPriceUpdate={(quoteId, newPrice) => onPriceUpdate(result.rowIndex, quoteId, newPrice)}
                  />
                ))}
              </div>

              {processedResults.length === 0 && (
                <div className="text-center py-12">
                  <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
                  <p className="text-gray-600">Try adjusting your filters or search terms.</p>
                </div>
              )}
            </div>
          )}

          {activeView === 'customer' && (
            <CustomerQuoteView
              results={results}
              customerName="Valued Customer"
              hideCarrierDetails={false}
              showOnlyBestQuotes={false}
            />
          )}

          {activeView === 'comparison' && (
            <QuoteComparison quotes={allQuotes as any} />
          )}

          {activeView === 'profit' && (
            <ProfitAnalyzer results={results} targetMargin={20} />
          )}

          {activeView === 'performance' && (
            <CarrierPerformanceTracker results={results} />
          )}
        </div>
      </div>
    </div>
  );
};