import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { PendingRegistration, UserProfile, Customer, SalesRepCustomer } from '../../types/auth';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Mail,
  Building2,
  Phone,
  MessageSquare,
  Shield,
  UserPlus,
  Trash2,
  Edit
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'users' | 'assignments'>('pending');
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [assignments, setAssignments] = useState<SalesRepCustomer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pending') {
        await loadPendingRegistrations();
      } else if (activeTab === 'users') {
        await loadUsers();
        await loadCustomers();
      } else if (activeTab === 'assignments') {
        await loadAssignments();
        await loadCustomers();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingRegistrations = async () => {
    const { data, error } = await supabase
      .from('pending_registrations')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setPendingRegistrations(data || []);
  };

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        customer:customers(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setUsers(data || []);
  };

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setCustomers(data || []);
  };

  const loadAssignments = async () => {
    const { data, error } = await supabase
      .from('sales_rep_customers')
      .select(`
        *,
        customer:customers(*)
      `)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    setAssignments(data || []);
  };

  const approveRegistration = async (registration: PendingRegistration) => {
    try {
      // Call the approve function
      const { error } = await supabase.rpc('approve_user_registration', {
        user_email: registration.email,
        approved_role: registration.requested_role,
        assigned_customer_name: registration.customer_name
      });

      if (error) throw error;
      
      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error approving registration:', error);
    }
  };

  const rejectRegistration = async (registrationId: string) => {
    try {
      const { error } = await supabase
        .from('pending_registrations')
        .update({ 
          status: 'rejected',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', registrationId);

      if (error) throw error;
      
      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error rejecting registration:', error);
    }
  };

  const assignCustomerToSalesRep = async (salesRepEmail: string, customerName: string) => {
    try {
      const { error } = await supabase.rpc('assign_customer_to_sales_rep', {
        sales_rep_email: salesRepEmail,
        customer_name: customerName
      });

      if (error) throw error;
      
      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error assigning customer:', error);
    }
  };

  const renderPendingRegistrations = () => (
    <div className="space-y-4">
      {pendingRegistrations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No pending registrations</p>
        </div>
      ) : (
        pendingRegistrations.map((registration) => (
          <div key={registration.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="bg-yellow-100 p-2 rounded-lg">
                    <UserPlus className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {registration.first_name} {registration.last_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Requested Role: {registration.requested_role.replace('_', ' ').toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span>{registration.email}</span>
                  </div>
                  
                  {registration.phone && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{registration.phone}</span>
                    </div>
                  )}
                  
                  {registration.company_name && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Building2 className="h-4 w-4" />
                      <span>{registration.company_name}</span>
                    </div>
                  )}
                  
                  {registration.customer_name && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Users className="h-4 w-4" />
                      <span>Customer: {registration.customer_name}</span>
                    </div>
                  )}
                </div>

                {registration.message && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-start space-x-2">
                      <MessageSquare className="h-4 w-4 text-gray-500 mt-0.5" />
                      <p className="text-sm text-gray-700">{registration.message}</p>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  Submitted: {new Date(registration.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => approveRegistration(registration)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Approve</span>
                </button>
                <button
                  onClick={() => rejectRegistration(registration.id)}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Reject</span>
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-4">
      {users.map((user) => (
        <div key={user.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`p-2 rounded-lg ${
                user.role === 'admin' ? 'bg-purple-100' :
                user.role === 'sales_rep' ? 'bg-blue-100' :
                'bg-green-100'
              }`}>
                <Shield className={`h-5 w-5 ${
                  user.role === 'admin' ? 'text-purple-600' :
                  user.role === 'sales_rep' ? 'text-blue-600' :
                  'text-green-600'
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {user.first_name} {user.last_name}
                </h3>
                <p className="text-sm text-gray-600">{user.email}</p>
                <div className="flex items-center space-x-4 mt-1">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                    user.role === 'sales_rep' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {user.role.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    user.is_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {user.is_approved ? 'Approved' : 'Pending'}
                  </span>
                  {user.customer && (
                    <span className="text-xs text-gray-500">
                      Customer: {user.customer.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAssignments = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Assignment</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select className="px-4 py-2 border border-gray-300 rounded-lg">
            <option value="">Select Sales Rep</option>
            {users.filter(u => u.role === 'sales_rep' && u.is_approved).map(rep => (
              <option key={rep.id} value={rep.email}>
                {rep.first_name} {rep.last_name} ({rep.email})
              </option>
            ))}
          </select>
          <select className="px-4 py-2 border border-gray-300 rounded-lg">
            <option value="">Select Customer</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.name}>
                {customer.name}
              </option>
            ))}
          </select>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Assign Customer
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {assignments.map((assignment) => (
          <div key={assignment.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {assignment.customer.name}
                </h3>
                <p className="text-sm text-gray-600">
                  Assigned to Sales Rep • {new Date(assignment.assigned_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex space-x-2">
                <button className="p-2 text-gray-600 hover:text-blue-600">
                  <Edit className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-600 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-600">Manage users, registrations, and assignments</p>
          </div>
        </div>

        <nav className="flex space-x-8">
          {[
            { id: 'pending', label: 'Pending Registrations', icon: Clock, count: pendingRegistrations.length },
            { id: 'users', label: 'All Users', icon: Users, count: users.length },
            { id: 'assignments', label: 'Sales Assignments', icon: UserCheck, count: assignments.length }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    activeTab === tab.id 
                      ? 'bg-purple-100 text-purple-800' 
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

      <div>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          </div>
        ) : (
          <>
            {activeTab === 'pending' && renderPendingRegistrations()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'assignments' && renderAssignments()}
          </>
        )}
      </div>
    </div>
  );
};