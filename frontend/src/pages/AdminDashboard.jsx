import React, { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Building2, Users, FileText, CalendarDays, LogOut, User, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { axiosInstance } from '@/App';
import AdminOverview from '@/components/admin/AdminOverview';
import ManageInfrastructure from '@/components/admin/ManageInfrastructure';
import ManageStudents from '@/components/admin/ManageStudents';
import ManageStaff from '@/components/admin/ManageStaff';
import CreateExam from '@/components/admin/CreateExam';
import AdminProfile from './AdminProfile';

const AdminDashboard = ({ user, setUser }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [college, setCollege] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef(null);
  const backendBase = (axiosInstance?.defaults?.baseURL || '').replace(/\/api\/?$/, '');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar:collapsed');
      if (saved !== null) {
        setCollapsed(saved === '1');
      } else if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setCollapsed(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const loadCollege = async () => {
      try {
        const res = await axiosInstance.get('/colleges');
        const found = res.data?.find((c) => c.id === user?.collegeId) || null;
        setCollege(found);
      } catch (e) {
        console.error('Failed to load college', e);
      }
    };
    if (user?.collegeId) loadCollege();
  }, [user?.collegeId]);

  const handleLogoClick = () => fileInputRef.current?.click();

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.collegeId) return;
    const form = new FormData();
    form.append('file', file);
    try {
      setUploading(true);
      const res = await axiosInstance.post(`/colleges/${user.collegeId}/logo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.logoUrl;
      setCollege((prev) => (prev ? { ...prev, logoUrl: url } : prev));
      toast.success('College logo updated');
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || 'Failed to update logo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem('sidebar:collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  };
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

  const navRef = useRef(null);

  useLayoutEffect(() => {
    const setNavbarVar = () => {
      const h = navRef.current?.offsetHeight || 72;
      document.documentElement.style.setProperty('--navbar-h', `${h}px`);
    };
    setNavbarVar();
    window.addEventListener('resize', setNavbarVar);
    return () => window.removeEventListener('resize', setNavbarVar);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100">
      <nav ref={navRef} className="bg-white/80 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full ring-2 ring-blue-200 overflow-hidden shadow bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                {college?.logoUrl ? (
                  <img src={`${backendBase}${college.logoUrl}`} alt={college?.name || 'College'} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-blue-700 font-semibold text-sm md:text-base">
                    {(college?.name || 'College').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()}
                  </span>
                )}
              </div>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-full cursor-pointer" onClick={handleLogoClick}>
                <Camera className="h-5 w-5 text-white" />
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              {uploading && (
                <div className="absolute inset-0 bg-white/60 rounded-full flex items-center justify-center">
                  <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
                {college?.name || 'College'}
              </h1>
              <p className="text-sm text-gray-600">{user?.profile?.name}</p>
            </div>
          </div>
          <Button data-testid="admin-logout-btn" onClick={handleLogout} variant="outline" className="rounded-full">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </nav>

      <div className="flex">
        <aside className={`relative sticky top-[var(--navbar-h)] h-[calc(100vh-var(--navbar-h))] bg-white/70 backdrop-blur-md border-r border-blue-100 p-4 transition-all duration-300 overflow-y-auto shrink-0 ${collapsed ? 'w-16' : 'w-64'}`}>
          <div className="absolute top-4 right-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
                    data-testid="sidebar-toggle"
                    className="rounded-full shadow-sm"
                    onClick={toggleCollapsed}
                  >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {collapsed ? 'Open sidebar' : 'Close sidebar'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <nav className="space-y-2 mt-12">
            <TooltipProvider>
              {navItems.map((item) => {
                const ButtonEl = (
                  <button
                    key={item.id}
                    data-testid={`nav-${item.id}`}
                    aria-label={item.label}
                    onClick={() => {
                      setActiveTab(item.id);
                      navigate(item.path);
                    }}
                    className={`group w-full flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-3 py-3 rounded-xl transition-all ${
                      activeTab === item.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    <span className="flex-shrink-0 inline-flex items-center justify-center h-6 w-6">
                      <item.icon className="h-5 w-5" />
                    </span>
                    {!collapsed && <span className="font-medium truncate">{item.label}</span>}
                  </button>
                );

                return collapsed ? (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      {ButtonEl}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  ButtonEl
                );
              })}
            </TooltipProvider>
          </nav>
        </aside>

        <main className="flex-1 min-w-0 p-8">
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
