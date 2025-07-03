import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Users, 
  Truck, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  Download,
  Upload,
  BarChart3,
  Calendar,
  MapPin,
  Package,
  DollarSign,
  Clock,
  Thermometer,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react';
import { 
  CustomerCarrier, 
  Shipment, 
  getCustomerCarriers, 
  saveCustomerCarrier, 
  updateCustomerCarrier, 
  deleteCustomerCarrier,
  getShipments,
  saveShipment,
  updateShipment,
  deleteShipment,
  getShipmentAnalytics,
  getCustomerList
} from '../utils/database';
import { formatCurrency } from '../utils/pricingCalculator';

interface DatabaseManagerProps {
  onSaveResults?: (customerName: string) => void;
}

export const DatabaseManager: React.FC<DatabaseManagerProps> = ({ onSaveResults }) => {
  const [activeTab, setActiveTab] = useState<'carriers' | 'shipments' | 'analytics'>('carriers');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Customer Carrier State
  const [customerCarriers, setCustomerCarriers] = useState<CustomerCarrier[]>([]);
  const [editingCarrier, setEditingCarrier] = useState<CustomerCarrier | null>(null);
  const [showCarrierForm, setShowCarrierForm] = useState(false);
  
  // Shipment State
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [showShipmentForm, setShowShipmentForm] = useState(false);
  
  // Filter State
  const [customerFilter, setCustomerFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState('');
  
  // Analytics State
  const [analytics, setAnalytics] = useState<any>(null);
  const [customerList, setCustomerList] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');

  useEffect(() => {
    loadData();
    loadCustomerList();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'carriers') {
        const carriers = await getCustomerCarriers(customerFilter || undefined);
        setCustomerCarriers(carriers);
      } else if (activeTab === 'shipments') {
        const filters = {
          customerName: customerFilter || undefined,
          startDate: dateFilter.start || undefined,
          endDate: dateFilter.end || undefined,
          carrierName: carrierFilter || undefined,
          status: statusFilter || undefined
        };
        const shipmentData = await getShipments(filters);
        setShipments(shipmentData);
      } else if (activeTab === 'analytics') {
        const analyticsData = await getShipmentAnalytics(selectedCustomer || undefined);
        setAnalytics(analyticsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerList = async () => {
    try {
      const customers = await getCustomerList();
      setCustomerList(customers);
    } catch (err) {
      console.error('Failed to load customer list:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, customerFilter, carrierFilter, dateFilter, statusFilter, selectedCustomer]);

  const handleSaveCarrier = async (carrier: Omit<CustomerCarrier, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setLoading(true);
      if (editingCarrier?.id) {
        await updateCustomerCarrier(editingCarrier.id, carrier);
      } else {
        await saveCustomerCarrier(carrier);
      }
      setShowCarrierForm(false);
      setEditingCarrier(null);
      await loadData();
      await loadCustomerList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save carrier');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCarrier = async (id: number) => {
    if (!confirm('Are you sure you want to delete this customer-carrier relationship?')) return;
    
    try {
      setLoading(true);
      await deleteCustomerCarrier(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete carrier');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveShipment = async (shipment: Omit<Shipment, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setLoading(true);
      if (editingShipment?.id) {
        await updateShipment(editingShipment.id, shipment);
      } else {
        await saveShipment(shipment);
      }
      setShowShipmentForm(false);
      setEditingShipment(null);
      await loadData();
      await loadCustomerList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save shipment');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShipment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this shipment?')) return;
    
    try {
      setLoading(true);
      await deleteShipment(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete shipment');
    } finally {
      setLoading(false);
    }
  };

  const renderCarrierForm = () => {
    const [formData, setFormData] = useState<Omit<CustomerCarrier, 'id' | 'created_at' | 'updated_at'>>({
      customer_name: editingCarrier?.customer_name || '',
      carrier_name: editingCarrier?.carrier_name || '',
      carrier_scac: editingCarrier?.carrier_scac || '',
      carrier_mc_number: editingCarrier?.carrier_mc_number || '',
      preferred_carrier: editingCarrier?.preferred_carrier || false,
      rate_discount_percentage: editingCarrier?.rate_discount_percentage || 0,
      contract_number: editingCarrier?.contract_number || '',
      effective_date: editingCarrier?.effective_date || '',
      expiration_date: editingCarrier?.expiration_date || '',
      notes: editingCarrier?.notes || ''
    });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">
            {editingCarrier ? 'Edit Customer-Carrier' : 'Add Customer-Carrier'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Name *</label>
              <input
                type="text"
                value={formData.carrier_name}
                onChange={(e) => setFormData({ ...formData, carrier_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SCAC Code</label>
              <input
                type="text"
                value={formData.carrier_scac}
                onChange={(e) => setFormData({ ...formData, carrier_scac: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MC Number</label>
              <input
                type="text"
                value={formData.carrier_mc_number}
                onChange={(e) => setFormData({ ...formData, carrier_mc_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Discount %</label>
              <input
                type="number"
                step="0.1"
                value={formData.rate_discount_percentage}
                onChange={(e) => setFormData({ ...formData, rate_discount_percentage: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contract Number</label>
              <input
                type="text"
                value={formData.contract_number}
                onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
              <input
                type="date"
                value={formData.effective_date}
                onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
              <input
                type="date"
                value={formData.expiration_date}
                onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.preferred_carrier}
                  onChange={(e) => setFormData({ ...formData, preferred_carrier: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Preferred Carrier</span>
              </label>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => {
                setShowCarrierForm(false);
                setEditingCarrier(null);
              }}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSaveCarrier(formData)}
              disabled={!formData.customer_name || !formData.carrier_name}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {editingCarrier ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCarriersTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Customer-Carrier Relationships</h2>
          <p className="text-sm text-gray-600">Manage preferred carriers and contract rates for customers</p>
        </div>
        <button
          onClick={() => setShowCarrierForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span>Add Carrier</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Filter</label>
            <input
              type="text"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              placeholder="Filter by customer name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setCustomerFilter('')}
            className="mt-6 px-3 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Carriers Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SCAC</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preferred</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contract</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {customerCarriers.map((carrier) => (
                <tr key={carrier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{carrier.customer_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{carrier.carrier_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{carrier.carrier_scac || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{carrier.rate_discount_percentage || 0}%</td>
                  <td className="px-6 py-4 text-sm">
                    {carrier.preferred_carrier ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{carrier.contract_number || '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setEditingCarrier(carrier);
                          setShowCarrierForm(true);
                        }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCarrier(carrier.id!)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
      </div>
    </div>
  );

  const renderShipmentsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Shipment History</h2>
          <p className="text-sm text-gray-600">Track and manage all shipments</p>
        </div>
        {onSaveResults && (
          <button
            onClick={() => {
              const customerName = prompt('Enter customer name to save results:');
              if (customerName) {
                onSaveResults(customerName);
              }
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Upload className="h-4 w-4" />
            <span>Save Current Results</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Customers</option>
              {customerList.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="QUOTED">Quoted</option>
              <option value="BOOKED">Booked</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setCustomerFilter('');
                setDateFilter({ start: '', end: '' });
                setStatusFilter('');
              }}
              className="w-full px-3 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
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
                      <div className="flex items-center space-x-2">
                        <Package className="h-3 w-3 text-gray-400" />
                        <span>{shipment.pallets} pallets, {shipment.gross_weight.toLocaleString()} lbs</span>
                      </div>
                      {shipment.is_reefer && (
                        <div className="flex items-center space-x-2">
                          <Thermometer className="h-3 w-3 text-blue-500" />
                          <span className="text-blue-600">{shipment.temperature || 'Reefer'}</span>
                        </div>
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
                        <div className="text-xs text-gray-500 flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{shipment.transit_days} days</span>
                        </div>
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
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setEditingShipment(shipment);
                          setShowShipmentForm(true);
                        }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteShipment(shipment.id!)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
      </div>
    </div>
  );

  const renderAnalyticsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Shipment Analytics</h2>
          <p className="text-sm text-gray-600">Performance insights and trends</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Customers</option>
            {customerList.map(customer => (
              <option key={customer} value={customer}>{customer}</option>
            ))}
          </select>
        </div>
      </div>

      {analytics && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Shipments</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.totalShipments}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Weight</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.totalWeight.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">lbs</p>
                </div>
                <Package className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Spend</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.totalSpend)}</p>
                  <p className="text-sm text-gray-500">Avg: {formatCurrency(analytics.avgRate)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Transit</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.avgTransitDays.toFixed(1)}</p>
                  <p className="text-sm text-gray-500">days</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Carriers */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Carriers</h3>
              <div className="space-y-3">
                {analytics.topCarriers.map((carrier: any, index: number) => (
                  <div key={carrier.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="font-medium">{carrier.name}</span>
                    </div>
                    <span className="text-gray-600">{carrier.count} shipments</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Lanes */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Lanes</h3>
              <div className="space-y-3">
                {analytics.topLanes.map((lane: any, index: number) => (
                  <div key={lane.lane} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{lane.lane}</span>
                    </div>
                    <span className="text-gray-600">{lane.count} shipments</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Mix</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Reefer Shipments</span>
                  <span className="text-sm text-gray-600">{analytics.reeferPercentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${analytics.reeferPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'carriers', label: 'Customer-Carriers', icon: Users },
            { id: 'shipments', label: 'Shipments', icon: Package },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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
          {activeTab === 'carriers' && renderCarriersTab()}
          {activeTab === 'shipments' && renderShipmentsTab()}
          {activeTab === 'analytics' && renderAnalyticsTab()}
        </>
      )}

      {/* Forms */}
      {showCarrierForm && renderCarrierForm()}
    </div>
  );
};