import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Building2, FileText, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { axiosInstance } from '@/App';
import { toast } from 'sonner';

const AdminOverview = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axiosInstance.get(`/stats/${user.collegeId}`);
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    { title: 'Total Students', value: stats?.totalStudents || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { title: 'Total Blocks', value: stats?.totalBlocks || 0, icon: Building2, color: 'text-green-600', bg: 'bg-green-100' },
    { title: 'Total Rooms', value: stats?.totalRooms || 0, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-100' },
    { title: 'Total Exams', value: stats?.totalExams || 0, icon: CalendarDays, color: 'text-orange-600', bg: 'bg-orange-100' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div data-testid="admin-overview" className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card data-testid={`stat-card-${stat.title.toLowerCase().replace(/ /g, '-')}`} className="backdrop-blur-sm bg-white/70 hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`${stat.bg} p-3 rounded-xl`}>
                    <stat.icon className={`h-8 w-8 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
          <Card className="backdrop-blur-sm bg-white/70">
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="font-medium">Students</span>
                  <span className="text-2xl font-bold text-blue-600">{stats?.totalStudents || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="font-medium">Staff Members</span>
                  <span className="text-2xl font-bold text-green-600">{stats?.totalStaff || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <span className="font-medium">Infrastructure</span>
                  <span className="text-2xl font-bold text-purple-600">
                    {stats?.totalBlocks || 0} Blocks / {stats?.totalRooms || 0} Rooms
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
          <Card className="backdrop-blur-sm bg-white/70">
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border-l-4 border-green-500 bg-green-50 rounded">
                  <span>Database</span>
                  <span className="text-green-600 font-semibold">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 border-l-4 border-green-500 bg-green-50 rounded">
                  <span>Backend Services</span>
                  <span className="text-green-600 font-semibold">Running</span>
                </div>
                <div className="flex items-center justify-between p-3 border-l-4 border-green-500 bg-green-50 rounded">
                  <span>Allocation System</span>
                  <span className="text-green-600 font-semibold">Ready</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminOverview;