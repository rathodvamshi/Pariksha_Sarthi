import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Calendar, MapPin, Bell, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { axiosInstance } from '@/App';
import { toast } from 'sonner';

const StudentDashboard = ({ user, setUser }) => {
  const [allocations, setAllocations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [allocRes, notifRes] = await Promise.all([
        axiosInstance.get(`/allocations/student/${user.id}`),
        axiosInstance.get(`/notifications/${user.id}`),
      ]);
      setAllocations(allocRes.data);
      setNotifications(notifRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
    toast.success('Logged out successfully');
  };

  const attendanceData = [
    { name: 'Present', value: user?.profile?.attendancePercent || 85, color: '#10b981' },
    { name: 'Absent', value: 100 - (user?.profile?.attendancePercent || 85), color: '#ef4444' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <nav className="bg-white/80 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <GraduationCap className="h-8 w-8 text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900">Student Portal</h1>
          </div>
          <Button data-testid="logout-btn" onClick={handleLogout} variant="outline" className="rounded-full">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome, {user?.profile?.name}!</h2>
          <p className="text-gray-600">Roll Number: {user?.rollNumber}</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Card data-testid="profile-card" className="backdrop-blur-sm bg-white/70">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2 text-purple-600" />
                  Profile Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-semibold">{user?.profile?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Branch</p>
                  <p className="font-semibold">{user?.profile?.branch}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Year</p>
                  <p className="font-semibold">Year {user?.profile?.year}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Section</p>
                  <p className="font-semibold">Section {user?.profile?.section}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card data-testid="attendance-card" className="backdrop-blur-sm bg-white/70">
              <CardHeader>
                <CardTitle>Attendance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={attendanceData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">
                      {attendanceData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-center mt-4 text-2xl font-bold text-purple-600">
                  {user?.profile?.attendancePercent || 85}%
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <Card data-testid="notifications-card" className="backdrop-blur-sm bg-white/70">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="h-5 w-5 mr-2 text-blue-600" />
                  Notifications
                  {notifications.filter((n) => !n.isRead).length > 0 && (
                    <Badge className="ml-auto" variant="destructive">
                      {notifications.filter((n) => !n.isRead).length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-500">No notifications</p>
                ) : (
                  notifications.slice(0, 5).map((notif) => (
                    <div key={notif.id} className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm">{notif.message}</p>
                      {!notif.isRead && <Badge className="mt-2" variant="secondary">New</Badge>}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card data-testid="seating-arrangements-card" className="backdrop-blur-sm bg-white/70">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-indigo-600" />
                My Seating Arrangements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                </div>
              ) : allocations.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No upcoming exams</p>
              ) : (
                <div className="space-y-4">
                  {allocations.map((allocation) => (
                    <div
                      key={allocation.id}
                      data-testid={`exam-allocation-${allocation.id}`}
                      className="p-6 border border-indigo-200 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 hover:shadow-md transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">{allocation.exam?.title}</h3>
                          <div className="space-y-2">
                            <div className="flex items-center text-gray-600">
                              <Calendar className="h-4 w-4 mr-2" />
                              <span>{allocation.exam?.date} | {allocation.exam?.startTime} - {allocation.exam?.endTime}</span>
                            </div>
                            <div className="flex items-center text-gray-600">
                              <MapPin className="h-4 w-4 mr-2" />
                              <span>
                                Block: {allocation.block?.name} | Room: {allocation.room?.roomNumber} | Bench: {allocation.benchNumber}
                                {allocation.seatPosition && ` - Seat ${allocation.seatPosition}`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 md:mt-0">
                          <Badge className="bg-green-500 text-white px-4 py-2">Confirmed</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default StudentDashboard;