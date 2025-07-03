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
  Clock
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/pricingCalculator';

interface Customer {
  customer_name: string;
  total_shipments: number;
  total_spend: number;
  last_shipment_date: string;
}

interface Carrier {
  carrier_name: string;
  carrier_scac?: string;
  carrier_mc_number?: string;
  total_shipments: number;
  avg_rate: number;
  last_used_date: string;
}

interface Shipment {
  id: number;
  customer_name: string;
  shipment_date: string;
  origin_zip: string;
  destination_zip: string;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  pallets: number;
  gross_weight: number;
  is_reefer: boolean;
  temperature?: string;
  commodity?: string;
  carrier_name?: string;
  carrier_scac?: string;
  quoted_rate?: number;
  final_rate?: number;
  transit_days?: number;
  shipment_status: string;
  created_at: string;
}

interface CustomerCarrier {
  id: number;
  customer_name: string;
  carrier_name: string;
  carrier_scac?: string;
  carrier_mc_number?: string;
  preferred_carrier: boolean;
  rate_discount_percentage?: number;
  contract_number?: string;
  effective_date?: string;
  expiration_date?: string;
  notes?: string;
  created_at: string;
}

export const DatabaseToolbox: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'customers' | 'carriers' | 'shipments' | 'customer-carriers'>('customers');
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
  const [filterDate, setFilterDate] = useState('');
  
  // Data state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customerCarriers, setCustomerCarriers] = useState<CustomerCarrier[]>([]);

  useEffect(() => {
    loadData();
  }, [activeTab, currentPage, searchTerm, filterStatus, filterDate]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      
      switch (activeTab) {
        case 'customers':
          await loadCustomers(offset);
          break;
        case 'carriers':
          await loadCarriers(offset);
          break;
        case 'shipments':
          await loadShipments(offset);
          break;
        case 'customer-carriers':
          await loadCustomerCarriers(offset);
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async (offset: number) => {
    // Get unique customers with aggregated data
    let query = supabase
      .from('Shipments')
      .select('customer_name, quoted_rate, final_rate, shipment_date', { count: 'exact' });
    
    if (searchTerm) {
      query = query.ilike('customer_name', `%${searchTerm}%`);
    }
    
    const { data: shipmentData, error: shipmentError, count } = await query;
    
    if (shipmentError) throw shipmentError;
    
    // Aggregate customer data
    const customerMap = new Map<string, {
      total_shipments: number;
      total_spend: number;
      last_shipment_date: string;
    }>();
    
    shipmentData?.forEach(shipment => {
      const existing = customerMap.get(shipment.customer_name) || {
        total_shipments: 0,
        total_spend: 0,
        last_shipment_date: shipment.shipment_date
      };
      
      existing.total_shipments += 1;
      existing.total_spend += (shipment.final_rate || shipment.quoted_rate || 0);
      
      if (shipment.shipment_date > existing.last_shipment_date) {
        existing.last_shipment_date = shipment.shipment_date;
      }
      
      customerMap.set(shipment.customer_name, existing);
    });
    
    const customerList = Array.from(customerMap.entries()).map(([customer_name, data]) => ({
      customer_name,
      ...data
    }));
    
    // Sort by total shipments descending
    customerList.sort((a, b) => b.total_shipments - a.total_shipments);
    
    // Paginate
    const paginatedCustomers = customerList.slice(offset, offset + itemsPerPage);
    
    setCustomers(paginatedCustomers);
    setTotalCount(customerList.length);
    setTotalPages(Math.ceil(customerList.length / itemsPerPage));
  };

  const loadCarriers = async (offset: number) => {
    // Get unique carriers with aggregated data
    let query = supabase
      .from('Shipments')
      .select('carrier_name, carrier_scac, quoted_rate, final_rate, shipment_date', { count: 'exact' })
      .not('carrier_name', 'is', null);
    
    if (searchTerm) {
      query = query.or(`carrier_name.ilike.%${searchTerm}%,carrier_scac.ilike.%${searchTerm}%`);
    }
    
    const { data: shipmentData, error: shipmentError } = await query;
    
    if (shipmentError) throw shipmentError;
    
    // Aggregate carrier data
    const carrierMap = new Map<string, {
      carrier_scac?: string;
      total_shipments: number;
      total_spend: number;
      last_used_date: string;
    }>();
    
    shipmentData?.forEach(shipment => {
      if (!shipment.carrier_name) return;
      
      const existing = carrierMap.get(shipment.carrier_name) || {
        carrier_scac: shipment.carrier_scac,
        total_shipments: 0,
        total_spend: 0,
        last_used_date: shipment.shipment_date
      };
      
      existing.total_shipments += 1;
      existing.total_spend += (shipment.final_rate || shipment.quoted_rate || 0);
      
      if (shipment.shipment_date > existing.last_used_date) {
        existing.last_used_date = shipment.shipment_date;
      }
      
      carrierMap.set(shipment.carrier_name, existing);
    });
    
    const carrierList = Array.from(carrierMap.entries()).map(([carrier_name, data]) => ({
      carrier_name,
      carrier_scac: data.carrier_scac,
      carrier_mc_number: undefined,
      total_shipments: data.total_shipments,
      avg_rate: data.total_spend / data.total_shipments,
      last_used_date: data.last_used_date
    }));
    
    // Sort by total shipments descending
    carrierList.sort((a, b) => b.total_shipments - a.total_shipments);
    
    // Paginate
    const paginatedCarriers = carrierList.slice(offset, offset + itemsPerPage);
    
    setCarriers(paginatedCarriers);
    setTotalCount(carrierList.length);
    setTotalPages(Math.ceil(carrierList.length / itemsPerPage));
  };

  const loadShipments = async (offset: number) => {
    let query = supabase
      .from('Shipments')
      .select('*', { count: 'exact' })
      .order('shipment_date', { ascending: false })
      .range(offset, offset + itemsPerPage - 1);
    
    if (searchTerm) {
      query = query.or(`customer_name.ilike.%${searchTerm}%,carrier_name.ilike.%${searchTerm}%,origin_zip.ilike.%${searchTerm}%,destination_zip.ilike.%${searchTerm}%`);
    }
    
    if (filterStatus) {
      query = query.eq('shipment_status', filterStatus);
    }
    
    if (filterDate) {
      query = query.gte('shipment_date', filterDate);
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    setShipments(data || []);
    setTotalCount(count || 0);
    setTotalPages(Math.ceil((count || 0) / itemsPerPage));
  };

  const loadCustomerCarriers = async (offset: number) => {
    let query = supabase
      .from('CustomerCarrier')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + itemsPerPage - 1);
    
    if (searchTerm) {
      query = query.or(`customer_name.ilike.%${searchTerm}%,carrier_name.ilike.%${searchTerm}%,carrier_scac.ilike.%${searchTerm}%`);
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    setCustomerCarriers(data || []);
    setTotalCount(count || 0);
    setTotalPages(Math.ceil((count || 0) / itemsPerPage));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page when searching
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

  const renderCustomersTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-600">View all customers and their shipping activity</p>
        </div>
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
              placeholder="Search customers..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Shipments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Spend</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg per Shipment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Shipment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {customers.map((customer, index) => (
                <tr key={`${customer.customer_name}-${index}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{customer.customer_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{customer.total_shipments}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(customer.total_spend)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatCurrency(customer.total_spend / customer.total_shipments)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{customer.last_shipment_date}</td>
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
        
        {customers.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No customers found</p>
          </div>
        )}
        
        {renderPagination()}
      </div>
    </div>
  );

  const renderCarriersTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Carriers</h2>
          <p className="text-sm text-gray-600">View all carriers and their performance</p>
        </div>
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
              placeholder="Search carriers..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Carriers Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SCAC</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Shipments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Used</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {carriers.map((carrier, index) => (
                <tr key={`${carrier.carrier_name}-${index}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{carrier.carrier_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{carrier.carrier_scac || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{carrier.total_shipments}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(carrier.avg_rate)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{carrier.last_used_date}</td>
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
        
        {carriers.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No carriers found</p>
          </div>
        )}
        
        {renderPagination()}
      </div>
    </div>
  );

  const renderShipmentsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Shipments</h2>
          <p className="text-sm text-gray-600">View all shipment records</p>
        </div>
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
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="QUOTED">Quoted</option>
            <option value="BOOKED">Booked</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
          
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterStatus('');
              setFilterDate('');
              setCurrentPage(1);
            }}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{shipment.shipment_date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{shipment.customer_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      <span>{shipment.origin_zip} → {shipment.destination_zip}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="space-y-1">
                      <div>{shipment.pallets} pallets, {shipment.gross_weight.toLocaleString()} lbs</div>
                      {shipment.is_reefer && (
                        <div className="text-blue-600 text-xs">Reefer {shipment.temperature && `(${shipment.temperature})`}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{shipment.carrier_name || '—'}</div>
                      {shipment.carrier_scac && (
                        <div className="text-xs text-gray-500">{shipment.carrier_scac}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{formatCurrency(shipment.final_rate || shipment.quoted_rate || 0)}</div>
                      {shipment.transit_days && (
                        <div className="text-xs text-gray-500">{shipment.transit_days} days</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      shipment.shipment_status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                      shipment.shipment_status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
                      shipment.shipment_status === 'BOOKED' ? 'bg-yellow-100 text-yellow-800' :
                      shipment.shipment_status === 'QUOTED' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {shipment.shipment_status}
                    </span>
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
          <h2 className="text-xl font-semibold text-gray-900">Customer-Carrier Relationships</h2>
          <p className="text-sm text-gray-600">View customer-carrier preferences and contracts</p>
        </div>
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
              placeholder="Search customer-carrier relationships..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Customer-Carriers Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SCAC</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preferred</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contract</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {customerCarriers.map((relationship) => (
                <tr key={relationship.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{relationship.customer_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{relationship.carrier_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{relationship.carrier_scac || '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    {relationship.preferred_carrier ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Preferred
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {relationship.rate_discount_percentage ? `${relationship.rate_discount_percentage}%` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{relationship.contract_number || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{relationship.effective_date || '—'}</td>
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
            <p>No customer-carrier relationships found</p>
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
              Browse and manage your freight data - {totalCount} records found
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'customers', label: 'Customers', icon: Users },
            { id: 'carriers', label: 'Carriers', icon: Truck },
            { id: 'shipments', label: 'Shipments', icon: Package },
            { id: 'customer-carriers', label: 'Customer-Carriers', icon: Database }
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
                  setFilterDate('');
                }}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
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
          {activeTab === 'customers' && renderCustomersTab()}
          {activeTab === 'carriers' && renderCarriersTab()}
          {activeTab === 'shipments' && renderShipmentsTab()}
          {activeTab === 'customer-carriers' && renderCustomerCarriersTab()}
        </>
      )}
    </div>
  );
};