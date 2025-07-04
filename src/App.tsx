import React, { useState, useEffect } from 'react';
import { Search, Users, Building2, CheckCircle, AlertCircle, History, Loader, RefreshCw } from 'lucide-react';
import { supabase } from './utils/supabase';

interface CustomerSelectionProps {
  selectedCustomer: string;
  onCustomerChange: (customer: string) => void;
}

export const CustomerSelection: React.FC<CustomerSelectionProps> = ({
  selectedCustomer,
  onCustomerChange
}) => {
  const [customers, setCustomers] = useState<string[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasMore, setHasMore] = useState(true); 
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 200;
  const [loadedCount, setLoadedCount] = useState(0); 
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = customers.filter(customer =>
        customer.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchTerm, customers]);

  const loadCustomers = async () => {
    setLoading(true);
    setError('');
    setCustomers([]);
    setFilteredCustomers([]);
    setPage(0); 
    setLoadedCount(0);
    try {
      // Get customers from customers table
      console.log('🔍 Loading customers from customers table...');
      
      // First get the total count
      const { count, error: countError } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      if (countError) throw countError;
      
      setTotalCount(count || 0);
      console.log(`📊 Total customer count: ${count}`);
      setHasMore(true);
      setHasMore(true);

      await loadCustomerBatch(0);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load customers';
      setError(errorMsg);
      console.error('❌ Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  

  const loadCustomersFromHistory = async () => {
    setLoadingHistory(true);
    setError('');
    try {
      // Get unique customers from Shipments table
      console.log('🔍 Loading customers from shipment history...');
      
      const { data: shipmentCustomers, error: shipmentError } = await supabase
        .from('Shipments')
        .select('"Customer"')
        .not('"Customer"', 'is', null);
      
      if (shipmentError) throw shipmentError;
      
      // Get unique customers from CustomerCarriers table
      const { data: carrierCustomers, error: carrierError } = await supabase
        .from('CustomerCarriers')
        .select('InternalName')
        .not('InternalName', 'is', null);
      
      if (carrierError) throw carrierError;
      
      // Combine and deduplicate
      const shipmentNames = shipmentCustomers?.map(s => s.Customer).filter(Boolean) || [];
      const carrierNames = carrierCustomers?.map(c => c.InternalName).filter(Boolean) || [];
      const allHistoryNames = [...shipmentNames, ...carrierNames];
      const uniqueHistoryNames = Array.from(new Set(allHistoryNames)).sort();
      
      console.log(`✅ Loaded ${uniqueHistoryNames.length} customers from history (${shipmentNames.length} from shipments, ${carrierNames.length} from carrier relationships)`);
      
      // Add to existing customers without duplicates
      const combinedCustomers = Array.from(new Set([...customers, ...uniqueHistoryNames]));
      setCustomers(combinedCustomers);
      setFilteredCustomers(combinedCustomers);
      setLoadedCount(combinedCustomers.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers from history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const [page, setPage] = useState(0);
  const loadCustomerBatch = async (pageNum: number) => {
    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      console.log(`📋 Loading customers batch ${pageNum + 1} (${from}-${to})...`);
      
      if (pageNum > 0) {
        setLoadingMore(true);
      }
      
      const { data, error, count } = await supabase
        .from('customers')
        .select('name')
        .not('name', 'is', null)
        .eq('is_active', true)
        .order('name')
        .range(from, to);
      
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        setHasMore(false);
        console.log('📋 No more customers to load');
      } else {
        // Extract customer names and append to existing list
        const customerNames = data.map(customer => customer.name);
        const uniqueNames = Array.from(new Set([...customers, ...customerNames]));
        setCustomers(uniqueNames);
        setFilteredCustomers(searchTerm ? uniqueNames.filter(name => name.toLowerCase().includes(searchTerm.toLowerCase())) : uniqueNames);
        setPage(pageNum);
        setLoadedCount(uniqueNames.length);
        console.log(`✅ Loaded ${customerNames.length} more customers (batch ${pageNum + 1}), total: ${uniqueNames.length}`);
        
        // Check if we should load more
        setHasMore(data.length === PAGE_SIZE);
      }
      
      // Update total count if we have it
      if (count !== null) setTotalCount(count);
      
      // Update total count if we have it
      if (count !== null) setTotalCount(count);
    } catch (err) {
      console.error(`❌ Failed to load customers batch ${pageNum + 1}:`, err);
      throw err;
    } finally {
      setLoadingMore(false);
    }
  };

  // Function to search customers directly from the database
  const searchCustomers = async (term: string) => {
    if (!term || term.length < 2) return;
    
    setLoading(true);
    try {
      console.log(`🔍 Searching for customers with term: "${term}"...`);
      
      const { data, error, count } = await supabase
        .from('customers')
        .select('name')
        .eq('is_active', true)
        .ilike('name', `%${term}%`) 
        .limit(100);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const searchResults = data.map(c => c.name);
        console.log(`✅ Found ${searchResults.length} customers matching "${term}"`);
        
        // Add search results to the existing list without duplicates
        const combinedResults = Array.from(new Set([...customers, ...searchResults]));
        setCustomers(combinedResults);
        setFilteredCustomers(searchResults);
      } else {
        console.log(`ℹ️ No customers found matching "${term}"`);
        setFilteredCustomers([]);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = (customer: string) => {
    onCustomerChange(customer);
    setIsOpen(false);
    setSearchTerm('');
  };

  const clearSelection = () => {
    onCustomerChange('');
    setIsOpen(false);
    setSearchTerm('');
  };

  const loadMoreCustomers = () => {
    if (hasMore && !loadingMore) {
      loadCustomerBatch(page + 1);
    }
  };

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    if (term.length >= 2) {
      // For longer search terms, search directly in the database
      searchCustomers(term);
    } else if (term.length > 0) {
      // For shorter terms, filter the already loaded customers
      const filtered = customers.filter(customer =>
        customer.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredCustomers(filtered);
    } else {
      // If search is cleared, show all loaded customers
      setFilteredCustomers(customers);
    }
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <Building2 className="inline h-4 w-4 mr-1" />
        Customer Selection
      </label>
      
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className={selectedCustomer ? 'text-gray-900' : 'text-gray-500'}>
              {selectedCustomer || 'Select a customer...'}
            </span>
            <div className="flex items-center space-x-2">
              {selectedCustomer && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              <Users className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </button> 

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
            {/* Search Input */}
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search customers..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div className="text-xs text-gray-500 mt-1 flex justify-between">
                Type 3+ characters to search all customers
              </div>
            </div>

            {/* Customer List */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500 flex items-center justify-center space-x-2">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Loading customers...</span>
                </div>
              ) : error ? (
                <div className="p-4 text-center text-red-600 flex items-center justify-center space-x-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm"> 
                  {searchTerm ? 'No customers found' : 'No customers available'}
                </div>
              ) : searchTerm.length >= 3 ? (
                <>
                  {/* Clear Selection Option */}
                  <button
                    onClick={clearSelection}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors border-b border-gray-100"
                  >
                    <span className="text-gray-500 italic">No customer selected</span>
                  </button>
                  
                  <div className="p-2 text-xs text-blue-600 bg-blue-50 border-b border-blue-100">
                    Showing {filteredCustomers.length} search results for "{searchTerm}" 
                  </div>
                  
                  {/* Search Results */}
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer}
                      onClick={() => handleCustomerSelect(customer)}
                      className={`w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors ${
                        selectedCustomer === customer ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{customer}</span>
                        {selectedCustomer === customer && (
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {/* Clear Selection Option */}
                  <button
                    onClick={clearSelection}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors border-b border-gray-100"
                  >
                    <span className="text-gray-500 italic">No customer selected</span>
                  </button>
                  
                  {/* Customer Options */}
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer}
                      onClick={() => handleCustomerSelect(customer)}
                      className={`w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors ${
                        selectedCustomer === customer ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{customer}</span>
                        {selectedCustomer === customer && (
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
            
            {hasMore && (
              <div className="p-3 text-center border-t border-gray-200 bg-gray-50">
                <button
                  onClick={loadMoreCustomers} 
                  disabled={loadingMore}
                  className="text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-2 rounded-md transition-colors flex items-center justify-center space-x-2 w-full"
                > 
                  {loadingMore ? (
                    <>
                      <Loader className="h-3 w-3 animate-spin" />
                      <span>Loading more ({loadedCount} of {totalCount})...</span>
                    </>
                  ) : (
                    <>
                      <span>Load more customers</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedCustomer && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">
              Customer selected: {selectedCustomer}
            </span>
          </div>
          <p className="text-xs text-green-700 mt-1">
            Customer-specific margins will be applied where available
          </p>
        </div>
      )}

      {customers.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Loaded {loadedCount} of {totalCount} customer{totalCount !== 1 ? 's' : ''} from customers table
          {hasMore && ' (type 3+ characters to search all customers)'}
        </p>
      )}
    </div>
  );
};

// Main App component
const App: React.FC = () => {
  const [selectedCustomer, setSelectedCustomer] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Customer Management</h1>
        <CustomerSelection 
          selectedCustomer={selectedCustomer}
          onCustomerChange={setSelectedCustomer}
        />
      </div>
    </div>
  );
};

export default App;