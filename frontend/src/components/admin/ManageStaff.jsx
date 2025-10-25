import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { axiosInstance } from '@/App';
import { toast } from 'sonner';

const ManageStaff = ({ user }) => {
  const [admins, setAdmins] = useState([]);
  const [invigilators, setInvigilators] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState('admin');
  const [staffData, setStaffData] = useState({
    email: '',
    profile: { name: '', employeeId: '' },
    password: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const [adminsRes, invigilatorsRes] = await Promise.all([
        axiosInstance.get(`/staff/${user.collegeId}?role=admin`),
        axiosInstance.get(`/staff/${user.collegeId}?role=invigilator`),
      ]);
      setAdmins(adminsRes.data);
      setInvigilators(invigilatorsRes.data);
    } catch (error) {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/staff', {
        collegeId: user.collegeId,
        role: selectedRole,
        ...staffData,
      });
      toast.success(`${selectedRole === 'admin' ? 'Admin' : 'Invigilator'} created successfully`);
      setShowModal(false);
      setStaffData({
        email: '',
        profile: { name: '', employeeId: '' },
        password: '',
      });
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create staff');
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;
    try {
      await axiosInstance.delete(`/staff/${staffId}`);
      toast.success('Staff deleted');
      fetchStaff();
    } catch (error) {
      toast.error('Failed to delete staff');
    }
  };

  return (
    <div data-testid="manage-staff" className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Manage Staff</h2>
        <Button
          data-testid="add-staff-btn"
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 rounded-full"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Staff
        </Button>
      </div>

      <Tabs defaultValue="admins">
        <TabsList>
          <TabsTrigger value="admins" data-testid="admins-tab">Admins</TabsTrigger>
          <TabsTrigger value="invigilators" data-testid="invigilators-tab">Invigilators</TabsTrigger>
        </TabsList>

        <TabsContent value="admins">
          <Card className="backdrop-blur-sm bg-white/70">
            <CardHeader>
              <CardTitle>Admin List</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : admins.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No admins found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Name</th>
                        <th className="text-left p-3 font-semibold">Email</th>
                        <th className="text-left p-3 font-semibold">Employee ID</th>
                        <th className="text-left p-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((admin) => (
                        <tr key={admin.id} data-testid={`admin-row-${admin.id}`} className="border-b hover:bg-blue-50">
                          <td className="p-3">{admin.profile?.name}</td>
                          <td className="p-3">{admin.email}</td>
                          <td className="p-3">{admin.profile?.employeeId}</td>
                          <td className="p-3">
                            <Button
                              data-testid={`delete-admin-${admin.id}`}
                              onClick={() => handleDeleteStaff(admin.id)}
                              size="sm"
                              variant="ghost"
                              className="hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invigilators">
          <Card className="backdrop-blur-sm bg-white/70">
            <CardHeader>
              <CardTitle>Invigilator List</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : invigilators.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No invigilators found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Name</th>
                        <th className="text-left p-3 font-semibold">Email</th>
                        <th className="text-left p-3 font-semibold">Employee ID</th>
                        <th className="text-left p-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invigilators.map((invigilator) => (
                        <tr key={invigilator.id} data-testid={`invigilator-row-${invigilator.id}`} className="border-b hover:bg-blue-50">
                          <td className="p-3">{invigilator.profile?.name}</td>
                          <td className="p-3">{invigilator.email}</td>
                          <td className="p-3">{invigilator.profile?.employeeId}</td>
                          <td className="p-3">
                            <Button
                              data-testid={`delete-invigilator-${invigilator.id}`}
                              onClick={() => handleDeleteStaff(invigilator.id)}
                              size="sm"
                              variant="ghost"
                              className="hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateStaff} className="space-y-4">
            <div>
              <Label>Role</Label>
              <div className="flex space-x-4 mt-2">
                <button
                  type="button"
                  data-testid="role-admin-btn"
                  onClick={() => setSelectedRole('admin')}
                  className={`flex-1 p-3 border-2 rounded-lg transition-all ${
                    selectedRole === 'admin' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  Admin
                </button>
                <button
                  type="button"
                  data-testid="role-invigilator-btn"
                  onClick={() => setSelectedRole('invigilator')}
                  className={`flex-1 p-3 border-2 rounded-lg transition-all ${
                    selectedRole === 'invigilator' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  Invigilator
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                data-testid="staff-name-input"
                id="name"
                value={staffData.profile.name}
                onChange={(e) => setStaffData({ ...staffData, profile: { ...staffData.profile, name: e.target.value } })}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                data-testid="staff-email-input"
                id="email"
                type="email"
                value={staffData.email}
                onChange={(e) => setStaffData({ ...staffData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="employeeId">Employee ID</Label>
              <Input
                data-testid="staff-employee-id-input"
                id="employeeId"
                value={staffData.profile.employeeId}
                onChange={(e) => setStaffData({ ...staffData, profile: { ...staffData.profile, employeeId: e.target.value } })}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                data-testid="staff-password-input"
                id="password"
                type="password"
                value={staffData.password}
                onChange={(e) => setStaffData({ ...staffData, password: e.target.value })}
                required
              />
            </div>
            <Button data-testid="create-staff-btn" type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Create Staff Member
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageStaff;