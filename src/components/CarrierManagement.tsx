import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Shield,
  Award,
  TrendingUp,
  CheckCircle,
  XCircle,
  Loader,
  Save,
  X
} from 'lucide-react';
import { supabase } from '../utils/supabase';

interface Carrier {
  id: string;
  name: string;
  scac?: string;
  mc_number?: string;
  dot_number?: string;
  account_code?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const CarrierManagement: React.FC = () => {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [formData, setFormData] = useState<Partial<Carrier>>({
    name: '',
    scac: '',
    mc_number: '',
    dot_number: '',
    account_code: '',
    is_active: true
  });

  useEffect(() => {
    loadCarriers();
  }, []);

  const loadCarriers = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('carriers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCarriers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load carriers');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      setError('Carrier name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (editingCarrier) {
        // Update existing carrier
        const { error } = await supabase
          .from('carriers')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCarrier.id);

        if (error) throw error;
      } else {
        // Create new carrier
        const { error } = await supabase
          .from('carriers')
          .insert([formData]);

        if (error) throw error;
      }

      await loadCarriers();
      handleCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save carrier');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (carrier: Carrier) => {
    setEditingCarrier(carrier);
    setFormData(carrier);
    setShowForm(true);
  };

  const handleDelete = async (carrier: Carrier) => {
    if (!confirm(`Are you sure you want to delete carrier "${carrier.name}"?`)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('carriers')
        .delete()
        .eq('id', carrier.id);

      if (error) throw error;
      await loadCarriers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete carrier');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCarrier(null);
    setFormData({
      name: '',
      scac: '',
      mc_number: '',
      dot_number: '',
      account_code: '',
      is_active: true
    });
    setError('');
  };

  const filteredCarriers = carriers.filter(carrier =>
    carrier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    carrier.scac?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    carrier.mc_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderForm = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">
          {editingCarrier ? 'Edit Carrier' : 'Add New Carrier'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Carrier Name *
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SCAC Code
            </label>
            <input
              type="text"
              value={formData.scac || ''}
              onChange={(e) => setFormData({ ...formData, scac: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., FXFE"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              MC Number
            </label>
            <input
              type="text"
              value={formData.mc_number || ''}
              onChange={(e) => setFormData({ ...formData, mc_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., MC-123456"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              DOT Number
            </label>
            <input
              type="text"
              value={formData.dot_number || ''}
              onChange={(e) => setFormData({ ...formData, dot_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., DOT-123456"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Code
            </label>
            <input
              type="text"
              value={formData.account_code || ''}
              onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Internal account code"
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_active || false}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
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
            disabled={loading || !formData.name?.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
          >
            {loading ? (
              <Loader className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {editingCarrier ? 'Update' : 'Save'}
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
          <h2 className="text-xl font-semibold text-gray-900">Carrier Management</h2>
          <p className="text-sm text-gray-600">Manage your carrier database</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span>Add Carrier</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search carriers by name, SCAC, or MC number..."
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

      {/* Carriers Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Identifiers</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCarriers.map((carrier) => (
                <tr key={carrier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="bg-green-100 p-2 rounded-lg">
                        <Truck className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{carrier.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {carrier.scac && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Award className="h-3 w-3" />
                          <span>SCAC: {carrier.scac}</span>
                        </div>
                      )}
                      {carrier.mc_number && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Shield className="h-3 w-3" />
                          <span>MC: {carrier.mc_number}</span>
                        </div>
                      )}
                      {carrier.dot_number && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <TrendingUp className="h-3 w-3" />
                          <span>DOT: {carrier.dot_number}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {carrier.account_code || '—'}
                  </td>
                  <td className="px-6 py-4">
                    {carrier.is_active ? (
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Active</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm">Inactive</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(carrier.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(carrier)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(carrier)}
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

        {!loading && filteredCarriers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No carriers found</p>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && renderForm()}
    </div>
  );
};