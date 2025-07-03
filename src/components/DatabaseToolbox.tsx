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
  Calculator
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';
import { MarginAnalysisTools } from './MarginAnalysisTools';

// Interfaces matching your exact database schema
interface Shipment {
  "Shipment ID": string;
  "BOL"?: string;
  "Status"?: string;
  "Customer"?: string;
  "Customer Contact"?: string;
  "Primary Rep"?: string;
  "Mode"?: string;
  "Equipment"?: string;
  "Partial"?: boolean;
  "Carrier"?: string;
  "USDOT"?: number;
  "MC Number"?: number;
  "SCAC"?: string;
  "Carrier Source"?: string;
  "Carrier Quote Number"?: string;
  "Service Level"?: string;
  "Transit Days"?: string;
  "PRO Number"?: string;
  "Cost"?: number;
  "Price"?: number;
  "Profit"?: number;
  "Margin"?: number;
  "Booked Date"?: string;
  "Booked By"?: string;
  "Covered Date"?: string;
  "Covered By"?: string;
  "Pickup Date"?: string;
  "Original Pickup Date"?: string;
  "Actual Pickup Date"?: string;
  "Delivery Date"?: string;
  "Original Delivery Date"?: string;
  "Actual Delivery Date"?: string;
  "Origin Company"?: string;
  "Origin Street"?: string;
  "Origin Street 2"?: string;
  "Origin City"?: string;
  "Origin State"?: string;
  "Origin Postal Code"?: string;
  "Origin Country"?: string;
  "Origin Open Time"?: string;
  "Origin Open Close"?: string;
  "Origin Contact"?: string;
  "Origin Phone"?: string;
  "Origin Email"?: string;
  "Origin Location Type"?: string;
  "Origin Appointment"?: boolean;
  "Origin Liftgate"?: boolean;
  "Origin Inside Pickup"?: boolean;
  "Origin Reference Number"?: string;
  "Origin Instructions"?: string;
  "Destination Company"?: string;
  "Destination Street"?: string;
  "Destination Street 2"?: string;
  "Destination City"?: string;
  "Destination State"?: string;
  "Destination Postal Code"?: string;
  "Destination Country"?: string;
  "Destination Open Time"?: string;
  "Destination Open Close"?: string;
  "Destination Contact"?: string;
  "Destination Phone"?: string;
  "Destination Email"?: string;
  "Destination Location Type"?: string;
  "Destination Appointment"?: boolean;
  "Destination Liftgate"?: boolean;
  "Destination Inside Pickup"?: boolean;
  "Destination Notify"?: boolean;
  "Destination Reference Number"?: string;
  "Destination Instructions"?: string;
  "Stopoffs"?: string;
  "Distance In Miles"?: string;
  "Total Units"?: number;
  "Total Weight"?: string;
  "Cost Per Lb"?: string;
  "Price Per Lb"?: number;
  "Total Length"?: string;
  "Total Density"?: number;
  "Hazmat"?: boolean;
  "Hazmat Emergency Response Phone"?: string;
  "Hazmat Contact"?: string;
  "Hazmat Contact Number"?: string;
  "Sort & Segregate"?: boolean;
  "Protect from Freezing"?: boolean;
  "Description 1"?: string;
  "Freight Class 1"?: string;
  "Carrier Contact"?: string;
  "Carrier Contact Phone"?: string;
  "Carrier Contact Email"?: string;
  "Driver"?: string;
  "Driver Phone"?: string;
  "Tractor Number"?: string;
  "Trailer Number"?: string;
  "Customer Invoice Sent"?: boolean;
  "Customer Invoice Sent By"?: string;
  "Customer Invoice Sent Date"?: string;
  "Customer Invoice Number"?: number;
  "Customer Invoice Total"?: number;
  "Customer Invoice Date"?: string;
  "Customer Invoice Due Date"?: string;
  "Customer Invoice Balance Due"?: string;
  "Customer Paid in Full"?: string;
  "Carrier Bill Added"?: boolean;
  "Carrier Bill Number"?: string;
  "Carrier Bill Total"?: number;
  "Carrier Bill Date"?: string;
  "Carrier Bill Due Date"?: string;
  "Carrier Quick Pay Requested"?: string;
  "Carrier Bill Balance Due"?: string;
  "Carrier Bill Paid in Full"?: boolean;
  "Customer Paid in Full or Factored"?: string;
  "To Be Factored"?: string;
  "Factoring Fee"?: string;
  "Price After Factoring"?: string;
  "Profit After Factoring"?: string;
  "Sent to Factor"?: string;
  "Booked Price"?: number;
  "Customer Invoice Price"?: number;
  "Booked Cost"?: number;
  "Carrier Bill Cost"?: number;
  "UOM"?: string;
  "Customer Invoice Pushed to Accounting"?: boolean;
  "Customer Invoice Pushed to Accounting Date"?: string;
  "Carrier Bill Pushed to Accounting"?: boolean;
  "Carrier Bill Pushed to Accounting Date"?: string;
  "URL"?: string;
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
  const [activeTab, setActiveTab] = useState<'shipments' | 'customercarriers' | 'margin-tools'>('shipments');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 25;
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  
  // Data state
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customerCarriers, setCustomerCarriers] = useState<CustomerCarrier[]>([]);
  
  // Unique values for filters
  const [uniqueCustomers, setUniqueCustomers] = useState<string[]>([]);
  const [uniqueStatuses, setUniqueStatuses] = useState<string[]>([]);

  useEffect(() => {
    loadData();
    loadFilterOptions();
  }, [activeTab, currentPage, searchTerm, filterStatus, filterCustomer]);

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
      
      // Load unique statuses from Shipments
      console.log('📋 Loading unique statuses...');
      const { data: statusData, error: statusError } = await supabase
        .from('Shipments')
        .select('"Status"')
        .not('"Status"', 'is', null)
        .limit(100);
      
      if (statusError) {
        console.error('❌ Error loading statuses:', statusError);
      } else {
        const statuses = [...new Set(statusData?.map(s => s.Status).filter(Boolean))];
        setUniqueStatuses(statuses);
        console.log(`✅ Loaded ${statuses.length} unique statuses`);
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
        .order('"Shipment ID"', { ascending: false })
        .range(offset, offset + itemsPerPage - 1);
      
      // Apply search filter
      if (searchTerm) {
        console.log(`🔍 Applying search filter: ${searchTerm}`);
        query = query.or(`"Shipment ID".ilike.%${searchTerm}%,"Customer".ilike.%${searchTerm}%,"Carrier".ilike.%${searchTerm}%,"Origin Postal Code".ilike.%${searchTerm}%,"Destination Postal Code".ilike.%${searchTerm}%`);
      }
      
      // Apply status filter
      if (filterStatus) {
        console.log(`📊 Applying status filter: ${filterStatus}`);
        query = query.eq('"Status"', filterStatus);
      }
      
      // Apply customer filter
      if (filterCustomer) {
        console.log(`👤 Applying customer filter: ${filterCustomer}`);
        query = query.eq('"Customer"', filterCustomer);
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterStatus('');
    setFilterCustomer('');
    setCurrentPage(1);
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses ({uniqueStatuses.length})</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipment ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pickup Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shipments.map((shipment) => (
                <tr key={shipment["Shipment ID"]} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {shipment["Shipment ID"]}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {shipment["Customer"] || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      shipment["Status"] === 'Delivered' ? 'bg-green-100 text-green-800' :
                      shipment["Status"] === 'In Transit' ? 'bg-blue-100 text-blue-800' :
                      shipment["Status"] === 'Booked' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {shipment["Status"] || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      <span>
                        {shipment["Origin Postal Code"] || '?'} → {shipment["Destination Postal Code"] || '?'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {shipment["Origin City"]}, {shipment["Origin State"]} → {shipment["Destination City"]}, {shipment["Destination State"]}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{shipment["Carrier"] || '—'}</div>
                      {shipment["SCAC"] && (
                        <div className="text-xs text-gray-500">SCAC: {shipment["SCAC"]}</div>
                      )}
                      {shipment["MC Number"] && (
                        <div className="text-xs text-gray-500">MC: {shipment["MC Number"]}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {shipment["Cost"] ? formatCurrency(shipment["Cost"]) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {shipment["Price"] ? formatCurrency(shipment["Price"]) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      {shipment["Profit"] ? formatCurrency(shipment["Profit"]) : '—'}
                      {shipment["Margin"] && (
                        <div className="text-xs text-gray-500">{shipment["Margin"]}% margin</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {shipment["Pickup Date"] || '—'}
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
            { id: 'margin-tools', label: 'Margin Analysis', icon: Calculator, count: null }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setCurrentPage(1);
                  setSearchTerm('');
                  setFilterStatus('');
                  setFilterCustomer('');
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
        </>
      )}
    </div>
  );
};