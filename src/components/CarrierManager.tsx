import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  Download,
  Upload,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Loader,
  Award,
  Shield,
  TrendingUp
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { Carrier, CarrierWithStats } from '../types/carrier';
import { formatCurrency } from '../utils/pricingCalculator';

export const CarrierManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [carriers, setCarriers] = useState<CarrierWithStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  
  useEffect(() => {
    loadCarriers();
  }, [searchTerm]);

  const loadCarriers = async () => {
    setLoading(true);
    setError('');
    try {
      // Get carriers with stats
      let query = supabase
        .from('carriers')
        .select(`
          *,
          shipment_count:Shipments(count),
          customer_count:CustomerCarriers(count)
        `);
      
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Get margin data for each carrier
      const carriersWithStats = await Promise.all((data || []).map(async (carrier) => {
        const { data: marginData, error: marginError } = await supabase
          .from('CustomerCarriers')
          .select('Percentage')
          .eq('carrier_id', carrier.id);
        
        if (marginError) throw marginError;
        
        const margins = marginData?.map(d => parseFloat(d.Percentage || '0')).filter(m => !isNaN(m)) || [];
        const avgMargin = margins.length > 0 ? margins.reduce((sum, m) => sum + m, 0) / margins.length : 0;
        
        return {
          ...carrier,
          shipment_count: carrier.shipment_count?.[0]?.count || 0,
          customer_count: carrier.customer_count?.[0]?.count || 0,
          avg_margin: avgMargin
        };
      }));
      
      setCarriers(carriersWithStats);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load carriers';
      setError(errorMsg);
      console.error('❌ Failed to load carriers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCarrier = async (carrier: Omit<Carrier, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setLoading(true);
      if (editingCarrier?.id) {
        const { error } = await supabase
          .from('carriers')
          .update({
            ...carrier,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCarrier.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('carriers')
          .insert([{
            ...carrier,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);
        
        if (error) throw error;
      }
      
      setShowForm(false);
      setEditingCarrier(null);
      await loadCarriers();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save carrier';
      setError(errorMsg);
      console.error('❌ Failed to save carrier:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCarrier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this carrier?')) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('carriers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      await loadCarriers();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete carrier';
      setError(errorMsg);
      console.error('❌ Failed to delete carrier:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderCarrierForm = () => {
    const [formData, setFormData] = useState<Omit<Carrier, 'id' | 'created_at' | 'updated_at'>>({
      name: editingCarrier?.name || '',
      scac: editingCarrier?.scac || '',
      mc_number: editingCarrier?.mc_number || '',
      dot_number: editingCarrier?.dot_number || '',
      account_code: editingCarrier?.account_code || '',
      is_active: editingCarrier?.is_active ?? true
    });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">
            {editingCarrier ? 'Edit Carrier' : 'Add Carrier'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SCAC Code</label>
              <input
                type="text"
                value={formData.scac}
                onChange={(e) => setFormData({ ...formData, scac: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">P44 Account Code</label>
              <input
                type="text"
                value={formData.account_code}
                onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MC Number</label>
              <input
                type="text"
                value={formData.mc_number}
                onChange={(e) => setFormData({ ...formData, mc_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DOT Number</label>
              <input
                type="text"
                value={formData.dot_number}
                onChange={(e) => setFormData({ ...formData, dot_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => {
                setShowForm(false);
                setEditingCarrier(null);
              }}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSaveCarrier(formData)}
              disabled={!formData.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {editingCarrier ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Carrier Management</h2>
              <p className="text-sm text-gray-600">
                Manage carriers and view performance metrics
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingCarrier(null);
              setShowForm(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            <span>Add Carrier</span>
          </button>
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
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search carriers..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setSearchTerm('')}
            className="px-3 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
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

      {/* Carriers Table */}
      {!loading && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Carrier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Identifiers</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shipments</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customers</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {carriers.map((carrier) => (
                  <tr key={carrier.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <Truck className="h-5 w-5 text-gray-400" />
                        <span className="font-medium text-gray-900">{carrier.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        {carrier.scac && (
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Award className="h-3 w-3" />
                            <span>SCAC: {carrier.scac}</span>
                          </div>
                        )}
                        {carrier.account_code && (
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Shield className="h-3 w-3" />
                            <span>P44 Code: {carrier.account_code}</span>
                          </div>
                        )}
                        {carrier.mc_number && (
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Shield className="h-3 w-3" />
                            <span>MC: {carrier.mc_number}</span>
                          </div>
                        )}
                        {carrier.dot_number && (
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <TrendingUp className="h-3 w-3" />
                            <span>DOT: {carrier.dot_number}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {carrier.shipment_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {carrier.customer_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        carrier.avg_margin > 20 ? 'bg-green-100 text-green-800' :
                        carrier.avg_margin > 10 ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {carrier.avg_margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        carrier.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {carrier.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingCarrier(carrier);
                            setShowForm(true);
                          }}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCarrier(carrier.id)}
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
          
          {carriers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No carriers found</p>
            </div>
          )}
        </div>
      )}

      {/* Carrier Form Modal */}
      {showForm && renderCarrierForm()}
    </div>
  );
};