import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Truck, 
  Edit, 
  Trash2, 
  Search, 
  Plus,
  Percent,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Loader,
  Save,
  X,
  RefreshCw,
  FileText,
  Building2
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { Customer, Carrier } from '../utils/database';

interface CustomerCarrier {
  MarkupId: number;
  InternalName?: string;
  P44CarrierCode?: string;
  MinDollar?: number;
  MaxDollar?: string;
  Percentage?: string;
  customer_id?: string;
  carrier_id?: string;
  customer?: Customer;
  carrier?: Carrier;
}

export const CustomerCarrierManagement: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [customerCarriers, setCustomerCarriers] = useState<CustomerCarrier[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMargin, setEditingMargin] = useState<CustomerCarrier | null>(null);
  const [formData, setFormData] = useState<Partial<CustomerCarrier>>({
    InternalName: '',
    P44CarrierCode: '',
    MinDollar: 0,
    MaxDollar: '',
    Percentage: ''
  });

  useEffect(() => {
    loadCustomers();
    loadCarriers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerCarriers(selectedCustomer);
    } else {
      setCustomerCarriers([]);
    }
  }, [selectedCustomer]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const loadCarriers = async () => {
    try {
      const { data, error } = await supabase
        .from('carriers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCarriers(data || []);
    } catch (err) {
      console.error('Failed to load carriers:', err);
    }
  };

  const loadCustomerCarriers = async (customerId: string) => {
    setLoading(true);
    try {
      // First get the customer name
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('name')
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;
      
      const customerName = customerData?.name;
      
      // Then get all customer carriers for this customer
      const { data, error } = await supabase
        .from('CustomerCarriers')
        .select(`
          *,
          customer:customer_id(id, name),
          carrier:carrier_id(id, name, scac)
        `)
        .eq('InternalName', customerName);

      if (error) throw error;
      setCustomerCarriers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer carriers');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.InternalName) {
      setError('Customer name is required');
      return;
    }

    if (!formData.P44CarrierCode) {
      setError('Carrier code is required');
      return;
    }

    if (!formData.Percentage) {
      setError('Percentage is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Find customer and carrier IDs
      const customer = customers.find(c => c.name === formData.InternalName);
      const carrier = carriers.find(c => c.name === formData.P44CarrierCode || c.scac === formData.P44CarrierCode);

      if (!customer) {
        throw new Error(`Customer "${formData.InternalName}" not found`);
      }

      if (!carrier) {
        throw new Error(`Carrier "${formData.P44CarrierCode}" not found`);
      }

      const marginData = {
        ...formData,
        customer_id: customer.id,
        carrier_id: carrier.id
      };

      if (editingMargin) {
        // Update existing margin
        const { error } = await supabase
          .from('CustomerCarriers')
          .update(marginData)
          .eq('MarkupId', editingMargin.MarkupId);

        if (error) throw error;
      } else {
        // Create new margin
        const { error } = await supabase
          .from('CustomerCarriers')
          .insert([marginData]);

        if (error) throw error;
      }

      if (selectedCustomer) {
        await loadCustomerCarriers(selectedCustomer);
      }
      handleCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer carrier margin');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (margin: CustomerCarrier) => {
    setEditingMargin(margin);
    setFormData({
      InternalName: margin.InternalName,
      P44CarrierCode: margin.P44CarrierCode,
      MinDollar: margin.MinDollar,
      MaxDollar: margin.MaxDollar,
      Percentage: margin.Percentage
    });
    setShowForm(true);
  };

  const handleDelete = async (margin: CustomerCarrier) => {
    if (!confirm(`Are you sure you want to delete this margin for ${margin.InternalName} and ${margin.P44CarrierCode}?`)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('CustomerCarriers')
        .delete()
        .eq('MarkupId', margin.MarkupId);

      if (error) throw error;
      
      if (selectedCustomer) {
        await loadCustomerCarriers(selectedCustomer);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete margin');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingMargin(null);
    setFormData({
      InternalName: selectedCustomer ? customers.find(c => c.id === selectedCustomer)?.name : '',
      P44CarrierCode: '',
      MinDollar: 0,
      MaxDollar: '',
      Percentage: ''
    });
    setError('');
  };

  const filteredMargins = customerCarriers.filter(margin =>
    margin.P44CarrierCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (margin.carrier?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderForm = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">
          {editingMargin ? 'Edit Carrier Margin' : 'Add New Carrier Margin'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer *
            </label>
            <select
              value={formData.InternalName || ''}
              onChange={(e) => setFormData({ ...formData, InternalName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              disabled={!!selectedCustomer}
              required
            >
              <option value="">Select Customer</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.name}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Carrier *
            </label>
            <select
              value={formData.P44CarrierCode || ''}
              onChange={(e) => setFormData({ ...formData, P44CarrierCode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select Carrier</option>
              {carriers.map(carrier => (
                <option key={carrier.id} value={carrier.name}>
                  {carrier.name} {carrier.scac ? `(${carrier.scac})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Dollar
            </label>
            <input
              type="number"
              value={formData.MinDollar || ''}
              onChange={(e) => setFormData({ ...formData, MinDollar: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Dollar
            </label>
            <input
              type="text"
              value={formData.MaxDollar || ''}
              onChange={(e) => setFormData({ ...formData, MaxDollar: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="No maximum"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Percentage Markup *
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.Percentage || ''}
                onChange={(e) => setFormData({ ...formData, Percentage: e.target.value })}
                className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="15.0"
                required
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-gray-500">%</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2 text-red-700">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <X className="h-4 w-4 mr-2 inline" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !formData.InternalName || !formData.P44CarrierCode || !formData.Percentage}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
          >
            {loading ? (
              <Loader className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {editingMargin ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Customer Carrier Margins</h2>
          <p className="text-sm text-gray-600">Manage carrier-specific pricing margins for customers</p>
        </div>
        <button
          onClick={() => {
            setFormData({
              ...formData,
              InternalName: selectedCustomer ? customers.find(c => c.id === selectedCustomer)?.name : ''
            });
            setShowForm(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          disabled={!selectedCustomer}
        >
          <Plus className="h-4 w-4" />
          <span>Add Carrier Margin</span>
        </button>
      </div>

      {/* Customer Selection */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Building2 className="inline h-4 w-4 mr-1" />
          Select Customer
        </label>
        <select
          value={selectedCustomer || ''}
          onChange={(e) => setSelectedCustomer(e.target.value || null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a customer to view their carrier margins</option>
          {customers.map(customer => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      {selectedCustomer && (
        <>
          {/* Search */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search carriers..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Error Display */}
          {error && !showForm && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}

          {/* Margins Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Dollar</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Dollar</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMargins.map((margin) => (
                    <tr key={margin.MarkupId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="bg-green-100 p-2 rounded-lg">
                            <Truck className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {margin.carrier?.name || margin.P44CarrierCode}
                            </div>
                            {margin.carrier?.scac && (
                              <div className="text-xs text-gray-500">SCAC: {margin.carrier.scac}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Percent className="h-4 w-4 text-blue-500" />
                          <span className="text-lg font-bold text-blue-600">{margin.Percentage}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-900">{margin.MinDollar || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-900">{margin.MaxDollar || 'No limit'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(margin)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(margin)}
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

            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            )}

            {!loading && filteredMargins.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No carrier margins found for this customer</p>
                <button
                  onClick={() => {
                    setFormData({
                      ...formData,
                      InternalName: selectedCustomer ? customers.find(c => c.id === selectedCustomer)?.name : ''
                    });
                    setShowForm(true);
                  }}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add First Carrier Margin
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {!selectedCustomer && !loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <Users className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-blue-900 mb-2">Select a Customer</h3>
          <p className="text-blue-700 max-w-md mx-auto">
            Please select a customer from the dropdown above to view and manage their carrier-specific pricing margins.
          </p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && renderForm()}
    </div>
  );
};