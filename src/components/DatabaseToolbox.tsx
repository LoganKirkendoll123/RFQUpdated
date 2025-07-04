import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Users, 
  Package, 
  Truck,
  Search, 
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  Plus,
  Calendar,
  MapPin,
  DollarSign,
  Clock,
  RefreshCw,
  Shield,
  CheckCircle,
  XCircle,
  Info,
  Calculator,
  Building2,
  UserCheck,
  TrendingUp,
  BarChart3,
  Download,
  Upload
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { MarginAnalysisTools } from './MarginAnalysisTools';
import { LaneAnalyzer } from './LaneAnalyzer';
import { VirtualizedTable } from './VirtualizedTable';
import { showSuccessToast, showErrorToast } from './Toast';

// Updated interfaces matching your exact database schema
interface Shipment {
  "Invoice #": number;
  "Customer"?: string;
  "Branch"?: string;
  "Scheduled Pickup Date"?: string;
  "Actual Pickup Date"?: string;
  "Scheduled Delivery Date"?: string;
  "Actual Delivery Date"?: string;
  "Origin City"?: string;
  "State"?: string;
  "Zip"?: string;
  "Destination City"?: string;
  "State_1"?: string;
  "Zip_1"?: string;
  "Sales Rep"?: string;
  "Account Rep"?: string;
  "Dispatch Rep"?: string;
  "Quote Created By"?: string;
  "Line Items"?: number;
  "Tot Packages"?: number;
  "Tot Weight"?: string;
  "Max Freight Class"?: string;
  "Max Length"?: string;
  "Max Width"?: string;
  "Max Height"?: string;
  "Tot Linear Ft"?: string;
  "Is VLTL"?: string;
  "Commodities"?: string;
  "Accessorials"?: string;
  "Booked Carrier"?: string;
  "Quoted Carrier"?: string;
  "Service Level"?: string;
  "Revenue"?: string;
  "Carrier Quote"?: string;
  "Carrier Expense"?: string;
  "Other Expense"?: string;
  "Profit"?: string;
  "Revenue w/o Accessorials"?: string;
  "Expense w/o Accessorials"?: string;
}

interface CustomerCarrier {
  "MarkupId": number;
  "CarrierId"?: number;
  "CustomerID"?: number;
  "InternalName"?: string;
  "P44CarrierCode"?: string;
  "MinDollar"?: number;
  "MaxDollar"?: string;
  "Percentage"?: string;
}

export const DatabaseToolbox: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shipments' | 'customercarriers' | 'margin-tools' | 'lane-analyzer' | 'data-import'>('shipments');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 25;
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSalesRep, setFilterSalesRep] = useState('');
  const [filterCarrier, setFilterCarrier] = useState('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  
  // Data state
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customerCarriers, setCustomerCarriers] = useState<CustomerCarrier[]>([]);
  
  // Unique values for filters
  const [uniqueCustomers, setUniqueCustomers] = useState<string[]>([]);
  const [uniqueBranches, setUniqueBranches] = useState<string[]>([]);
  const [uniqueSalesReps, setUniqueSalesReps] = useState<string[]>([]);
  const [uniqueCarriers, setUniqueCarriers] = useState<string[]>([]);

  useEffect(() => {
    loadData();
    loadFilterOptions();
  }, [activeTab, currentPage, searchTerm, filterCustomer, filterBranch, filterSalesRep, filterCarrier, dateFilter]);

  const testSupabaseConnection = async () => {
    try {
      console.log('🔍 Testing Supabase connection...');
      
      // Test basic connection
      const { data: testData, error: testError } = await supabase
        .from('Shipments')
        .select('count', { count: 'exact', head: true });
      
      if (testError) {
        console.error('❌ Supabase connection test failed:', testError);
        return false;
      }
      
      console.log('✅ Supabase connection successful');
      return true;
    } catch (err) {
      console.error('❌ Connection test error:', err);
      return false;
    }
  };

  const loadFilterOptions = async () => {
    try {
      console.log('🔍 Loading filter options...');
      
      // Test connection first
      const connectionOk = await testSupabaseConnection();
      if (!connectionOk) {
        return;
      }
      
      // Load unique customers from Shipments
      console.log('📋 Loading unique customers...');
      const { data: customerData, error: customerError } = await supabase
        .from('Shipments')
        .select('"Customer"')
        .not('"Customer"', 'is', null)
        .limit(100);
      
      if (customerError) {
        console.error('❌ Error loading customers:', customerError);
      } else {
        const customers = [...new Set(customerData?.map(s => s.Customer).filter(Boolean))];
        setUniqueCustomers(customers);
        console.log(`✅ Loaded ${customers.length} unique customers`);
      }
      
      // Load unique branches
      console.log('📋 Loading unique branches...');
      const { data: branchData, error: branchError } = await supabase
        .from('Shipments')
        .select('"Branch"')
        .not('"Branch"', 'is', null)
        .limit(100);
      
      if (branchError) {
        console.error('❌ Error loading branches:', branchError);
      } else {
        const branches = [...new Set(branchData?.map(s => s.Branch).filter(Boolean))];
        setUniqueBranches(branches);
        console.log(`✅ Loaded ${branches.length} unique branches`);
      }
      
      // Load unique sales reps
      console.log('📋 Loading unique sales reps...');
      const { data: salesRepData, error: salesRepError } = await supabase
        .from('Shipments')
        .select('"Sales Rep"')
        .not('"Sales Rep"', 'is', null)
        .limit(100);
      
      if (salesRepError) {
        console.error('❌ Error loading sales reps:', salesRepError);
      } else {
        const salesReps = [...new Set(salesRepData?.map(s => s["Sales Rep"]).filter(Boolean))];
        setUniqueSalesReps(salesReps);
        console.log(`✅ Loaded ${salesReps.length} unique sales reps`);
      }
      
      // Load unique carriers
      console.log('📋 Loading unique carriers...');
      const { data: carrierData, error: carrierError } = await supabase
        .from('Shipments')
        .select('"Booked Carrier", "Quoted Carrier"')
        .limit(100);
      
      if (carrierError) {
        console.error('❌ Error loading carriers:', carrierError);
      } else {
        const carriers = new Set<string>();
        carrierData?.forEach(s => {
          if (s["Booked Carrier"]) carriers.add(s["Booked Carrier"]);
          if (s["Quoted Carrier"]) carriers.add(s["Quoted Carrier"]);
        });
        const uniqueCarriersList = Array.from(carriers);
        setUniqueCarriers(uniqueCarriersList);
        console.log(`✅ Loaded ${uniqueCarriersList.length} unique carriers`);
      }
      
    } catch (err) {
      console.error('❌ Failed to load filter options:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log(`🔄 Loading data for tab: ${activeTab}`);
      
      // Test connection first
      const connectionOk = await testSupabaseConnection();
      if (!connectionOk) {
        setError('Failed to connect to Supabase. Please check your configuration.');
        return;
      }
      
      const offset = (currentPage - 1) * itemsPerPage;
      
      switch (activeTab) {
        case 'shipments':
          await loadShipments(offset);
          break;
        case 'customercarriers':
          await loadCustomerCarriers(offset);
          break;
        case 'margin-tools':
          // No data loading needed for margin tools
          break;
        case 'lane-analyzer':
          // Lane analyzer handles its own data loading
          break;
        case 'data-import':
          // Data import doesn't need initial data loading
          break;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMsg);
      console.error('❌ Data loading failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadShipments = async (offset: number) => {
    try {
      console.log('📦 Loading shipments...');
      
      let query = supabase
        .from('Shipments')
        .select('*', { count: 'exact' })
        .order('"Invoice #"', { ascending: false })
        .range(offset, offset + itemsPerPage - 1);
      
      // Apply search filter
      if (searchTerm) {
        console.log(`🔍 Applying search filter: ${searchTerm}`);
        query = query.or(`"Invoice #".eq.${searchTerm},"Customer".ilike.%${searchTerm}%,"Booked Carrier".ilike.%${searchTerm}%,"Quoted Carrier".ilike.%${searchTerm}%,"Zip".ilike.%${searchTerm}%,"Zip_1".ilike.%${searchTerm}%`);
      }
      
      // Apply customer filter
      if (filterCustomer) {
        console.log(`👤 Applying customer filter: ${filterCustomer}`);
        query = query.eq('"Customer"', filterCustomer);
      }
      
      // Apply branch filter
      if (filterBranch) {
        console.log(`🏢 Applying branch filter: ${filterBranch}`);
        query = query.eq('"Branch"', filterBranch);
      }
      
      // Apply sales rep filter
      if (filterSalesRep) {
        console.log(`👨‍💼 Applying sales rep filter: ${filterSalesRep}`);
        query = query.eq('"Sales Rep"', filterSalesRep);
      }
      
      // Apply carrier filter
      if (filterCarrier) {
        console.log(`🚛 Applying carrier filter: ${filterCarrier}`);
        query = query.or(`"Booked Carrier".eq.${filterCarrier},"Quoted Carrier".eq.${filterCarrier}`);
      }
      
      // Apply date filter
      if (dateFilter.start) {
        console.log(`📅 Applying start date filter: ${dateFilter.start}`);
        query = query.gte('"Scheduled Pickup Date"', dateFilter.start);
      }
      
      if (dateFilter.end) {
        console.log(`📅 Applying end date filter: ${dateFilter.end}`);
        query = query.lte('"Scheduled Pickup Date"', dateFilter.end);
      }
      
      const { data, error, count } = await query;
      
      if (error) {
        console.error('❌ Shipments query error:', error);
        throw error;
      }
      
      setShipments(data || []);
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
      
      console.log(`✅ Loaded ${data?.length || 0} Shipments records (${count} total)`);
    } catch (err) {
      console.error('❌ Failed to load Shipments:', err);
      throw err;
    }
  };

  const loadCustomerCarriers = async (offset: number) => {
    try {
      console.log('🚛 Loading customer carriers...');
      
      let query = supabase
        .from('CustomerCarriers')
        .select('*', { count: 'exact' })
        .order('"MarkupId"', { ascending: false })
        .range(offset, offset + itemsPerPage - 1);
      
      // Apply search filter
      if (searchTerm) {
        console.log(`🔍 Applying search filter: ${searchTerm}`);
        query = query.or(`"InternalName".ilike.%${searchTerm}%,"P44CarrierCode".ilike.%${searchTerm}%`);
      }
      
      const { data, error, count } = await query;
      
      if (error) {
        console.error('❌ CustomerCarriers query error:', error);
        throw error;
      }
      
      setCustomerCarriers(data || []);
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
      
      console.log(`✅ Loaded ${data?.length || 0} CustomerCarriers records (${count} total)`);
    } catch (err) {
      console.error('❌ Failed to load CustomerCarriers:', err);
      throw err;
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Read the file
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get the first sheet
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          if (jsonData.length === 0) {
            throw new Error('No data found in the file');
          }
          
          // Determine the table based on the columns
          let targetTable = '';
          const firstRow = jsonData[0] as any;
          
          if ('Invoice #' in firstRow) {
            targetTable = 'Shipments';
          } else if ('MarkupId' in firstRow) {
            targetTable = 'CustomerCarriers';
          } else {
            throw new Error('Unable to determine target table from file structure');
          }
          
          // Insert the data
          const { data: insertedData, error: insertError } = await supabase
            .from(targetTable)
            .insert(jsonData);
          
          if (insertError) {
            throw insertError;
          }
          
          showSuccessToast(`Successfully imported ${jsonData.length} records to ${targetTable}`);
          
          // Reload data
          loadData();
        } catch (error) {
          console.error('Import error:', error);
          setError(error instanceof Error ? error.message : 'Failed to import data');
          showErrorToast('Failed to import data');
        } finally {
          setLoading(false);
        }
      };
      
      reader.onerror = () => {
        setError('Failed to read file');
        setLoading(false);
        showErrorToast('Failed to read file');
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to import data');
      setLoading(false);
      showErrorToast('Failed to import data');
    }
  };

  const exportTableData = (tableName: 'Shipments' | 'CustomerCarriers') => {
    setLoading(true);
    
    supabase
      .from(tableName)
      .select('*')
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
          showErrorToast(`Failed to export ${tableName}`);
          return;
        }
        
        if (!data || data.length === 0) {
          setError(`No data found in ${tableName}`);
          showErrorToast(`No data found in ${tableName}`);
          return;
        }
        
        // Convert to XLSX
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, tableName);
        
        // Generate file and trigger download
        XLSX.writeFile(wb, `${tableName}-${new Date().toISOString().split('T')[0]}.xlsx`);
        showSuccessToast(`Exported ${data.length} records from ${tableName}`);
      })
      .catch(err => {
        setError(err.message);
        showErrorToast('Export failed');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterCustomer('');
    setFilterBranch('');
    setFilterSalesRep('');
    setFilterCarrier('');
    setDateFilter({ start: '', end: '' });
    setCurrentPage(1);
  };

  const parseNumeric = (value: string | null | undefined): number => {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const renderValue = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') {
      // Format currency-like numbers
      if (value > 100 && Number.isFinite(value)) {
        return formatCurrency(value);
      }
      return value.toString();
    }
    if (typeof value === 'string') {
      // Check if it looks like a currency value
      if (value.match(/^\d+\.?\d*$/) && parseFloat(value) > 100) {
        return formatCurrency(parseFloat(value));
      }
      // Truncate long strings
      return value.length > 50 ? value.substring(0, 50) + '...' : value;
    }
    return String(value);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return (
      <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center text-sm text-gray-700">
          <span>
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} results
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          {pages.map(page => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-1 text-sm rounded-md ${
                page === currentPage
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          ))}
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderShipmentsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Shipments</h2>
          <p className="text-sm text-gray-600">Browse all shipment records from your database</p>
        </div>
        <button
          onClick={() => loadData()}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search shipments..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Customers ({uniqueCustomers.length})</option>
            {uniqueCustomers.map(customer => (
              <option key={customer} value={customer}>{customer}</option>
            ))}
          </select>
          
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Branches ({uniqueBranches.length})</option>
            {uniqueBranches.map(branch => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
          
          <select
            value={filterSalesRep}
            onChange={(e) => setFilterSalesRep(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sales Reps ({uniqueSalesReps.length})</option>
            {uniqueSalesReps.map(rep => (
              <option key={rep} value={rep}>{rep}</option>
            ))}
          </select>
          
          <select
            value={filterCarrier}
            onChange={(e) => setFilterCarrier(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Carriers ({uniqueCarriers.length})</option>
            {uniqueCarriers.map(carrier => (
              <option key={carrier} value={carrier}>{carrier}</option>
            ))}
          </select>
          
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
        
        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateFilter.start}
              onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateFilter.end}
              onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pickup Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Rep</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shipments.map((shipment) => (
                <tr key={shipment["Invoice #"]} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {shipment["Invoice #"]}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {shipment["Customer"] || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center space-x-1">
                      <Building2 className="h-3 w-3 text-gray-400" />
                      <span>{shipment["Branch"] || '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      <span>
                        {shipment["Zip"] || '?'} → {shipment["Zip_1"] || '?'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {shipment["Origin City"]}, {shipment["State"]} → {shipment["Destination City"]}, {shipment["State_1"]}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Package className="h-3 w-3 text-gray-400" />
                        <span>{shipment["Tot Packages"] || 0} packages</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Weight: {shipment["Tot Weight"] || '—'}
                      </div>
                      {shipment["Is VLTL"] === "TRUE" && (
                        <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          VLTL
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{shipment["Booked Carrier"] || shipment["Quoted Carrier"] || '—'}</div>
                      {shipment["Service Level"] && (
                        <div className="text-xs text-gray-500">{shipment["Service Level"]}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {shipment["Revenue"] ? formatCurrency(parseNumeric(shipment["Revenue"])) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      {shipment["Profit"] ? formatCurrency(parseNumeric(shipment["Profit"])) : '—'}
                      {shipment["Revenue"] && shipment["Profit"] && (
                        <div className="text-xs text-gray-500">
                          {((parseNumeric(shipment["Profit"]) / parseNumeric(shipment["Revenue"])) * 100).toFixed(1)}% margin
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div>{shipment["Scheduled Pickup Date"] || '—'}</div>
                      {shipment["Actual Pickup Date"] && shipment["Actual Pickup Date"] !== shipment["Scheduled Pickup Date"] && (
                        <div className="text-xs text-gray-500">
                          Actual: {shipment["Actual Pickup Date"]}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center space-x-1">
                      <UserCheck className="h-3 w-3 text-gray-400" />
                      <span>{shipment["Sales Rep"] || '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button className="text-blue-600 hover:text-blue-700">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {shipments.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No shipments found</p>
          </div>
        )}
        
        {renderPagination()}
      </div>
    </div>
  );

  const renderCustomerCarriersTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Customer Carriers</h2>
          <p className="text-sm text-gray-600">Browse customer-carrier markup configurations</p>
        </div>
        <button
          onClick={() => loadData()}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search customer carriers..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* CustomerCarriers Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Markup ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer (Internal Name)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier (P44 Code)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Dollar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Dollar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {customerCarriers.map((carrier) => (
                <tr key={carrier["MarkupId"]} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {carrier["MarkupId"]}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{carrier["InternalName"] || '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center space-x-2">
                      <Truck className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{carrier["P44CarrierCode"] || '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      parseFloat(carrier["Percentage"] || '0') > 15 ? 'bg-green-100 text-green-800' :
                      parseFloat(carrier["Percentage"] || '0') > 10 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {carrier["Percentage"] || '0'}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {carrier["MinDollar"] ? formatCurrency(carrier["MinDollar"]) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {carrier["MaxDollar"] || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button className="text-blue-600 hover:text-blue-700">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {customerCarriers.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No customer carriers found</p>
          </div>
        )}
        
        {renderPagination()}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Database Toolbox</h1>
            <p className="text-sm text-gray-600">
              Browse your freight data and analyze carrier margins - {totalCount} records found
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'shipments', label: 'Shipments', icon: Package, count: activeTab === 'shipments' ? totalCount : null },
            { id: 'customercarriers', label: 'Customer Carriers', icon: Users, count: activeTab === 'customercarriers' ? totalCount : null },
            { id: 'margin-tools', label: 'Margin Analysis', icon: Calculator, count: null },
            { id: 'lane-analyzer', label: 'Lane Analyzer', icon: MapPin, count: null },
            { id: 'data-import', label: 'Import/Export', icon: Upload, count: null }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setCurrentPage(1);
                  setSearchTerm('');
                  setFilterCustomer('');
                  setFilterBranch('');
                  setFilterSalesRep('');
                  setFilterCarrier('');
                  setDateFilter({ start: '', end: '' });
                }}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    activeTab === tab.id 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}

      {/* Tab Content */}
      {!loading && (
        <>
          {activeTab === 'shipments' && renderShipmentsTab()}
          {activeTab === 'customercarriers' && renderCustomerCarriersTab()}
          {activeTab === 'margin-tools' && <MarginAnalysisTools />}
          {activeTab === 'lane-analyzer' && <LaneAnalyzer />}
          {activeTab === 'data-import' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <Upload className="h-5 w-5 text-blue-500" />
                  <span>Import Data</span>
                </h3>
                
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Import data from Excel files. The system will automatically detect the target table based on the file structure.
                  </p>
                  
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileImport}
                      className="hidden"
                      id="file-import"
                    />
                    <label
                      htmlFor="file-import"
                      className="cursor-pointer flex flex-col items-center justify-center"
                    >
                      <Upload className="h-12 w-12 text-gray-400 mb-3" />
                      <span className="text-sm font-medium text-gray-900 mb-1">Click to upload</span>
                      <span className="text-xs text-gray-500">XLSX or XLS</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <Download className="h-5 w-5 text-green-500" />
                  <span>Export Data</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => exportTableData('Shipments')}
                    className="flex items-center justify-center space-x-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Package className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Export Shipments</span>
                  </button>
                  
                  <button
                    onClick={() => exportTableData('CustomerCarriers')}
                    className="flex items-center justify-center space-x-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Users className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">Export Customer-Carriers</span>
                  </button>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800 mb-2">Data Import/Export Tips</h4>
                    <ul className="space-y-1 text-sm text-blue-700 list-disc list-inside">
                      <li>For importing Shipments, ensure your file has an "Invoice #" column</li>
                      <li>For importing CustomerCarriers, ensure your file has a "MarkupId" column</li>
                      <li>Exported files maintain the exact database structure</li>
                      <li>You can modify exported files and re-import them to update records</li>
                      <li>Large files may take longer to process</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};