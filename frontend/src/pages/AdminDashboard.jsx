import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Building2, Users, FileText, CalendarDays, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import AdminOverview from '@/components/admin/AdminOverview';
import ManageInfrastructure from '@/components/admin/ManageInfrastructure';
import ManageStudents from '@/components/admin/ManageStudents';
import ManageStaff from '@/components/admin/ManageStaff';
import CreateExam from '@/components/admin/CreateExam';
import AdminProfile from './AdminProfile';

const AdminDashboard = ({ user, setUser }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
    toast.success('Logged out successfully');
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/admin' },
    { id: 'infrastructure', label: 'Infrastructure', icon: Building2, path: '/admin/infrastructure' },
    { id: 'students', label: 'Students', icon: Users, path: '/admin/students' },
    { id: 'staff', label: 'Staff', icon: FileText, path: '/admin/staff' },
    { id: 'exams', label: 'Exams', icon: CalendarDays, path: '/admin/exams' },
    { id: 'profile', label: 'Profile', icon: User, path: '/admin/profile' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100">
      <nav className="bg-white/80 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Portal</h1>
            <p className="text-sm text-gray-600">{user?.profile?.name}</p>
          </div>
          <Button data-testid="admin-logout-btn" onClick={handleLogout} variant="outline" className="rounded-full">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </nav>

      <div className="flex">
        <aside className="w-64 min-h-screen bg-white/70 backdrop-blur-md border-r border-blue-100 p-4">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => {
                  setActiveTab(item.id);
                  navigate(item.path);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-blue-50'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-8">
          <Routes>
            <Route path="/" element={<AdminOverview user={user} />} />
            <Route path="/infrastructure" element={<ManageInfrastructure user={user} />} />
            <Route path="/students" element={<ManageStudents user={user} />} />
            <Route path="/staff" element={<ManageStaff user={user} />} />
            <Route path="/exams" element={<CreateExam user={user} />} />
            <Route path="/profile" element={<AdminProfile user={user} setUser={setUser} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
