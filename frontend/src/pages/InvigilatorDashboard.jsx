import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardCheck, Calendar, MapPin, Bell, LogOut, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { axiosInstance } from '@/App';
import { toast } from 'sonner';

const InvigilatorDashboard = ({ user, setUser }) => {
  const [duties, setDuties] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedDuty, setSelectedDuty] = useState(null);
  const [students, setStudents] = useState([]);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentData, setIncidentData] = useState({ description: '', studentId: '' });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dutiesRes, notifsRes] = await Promise.all([
        axiosInstance.get(`/duties/invigilator/${user.id}`),
        axiosInstance.get(`/notifications/${user.id}`),
      ]);
      setDuties(dutiesRes.data);
      setNotifications(notifsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptDuty = async (dutyId) => {
    try {
      await axiosInstance.put(`/duties/${dutyId}/status?status=accepted`);
      toast.success('Duty accepted');
      fetchData();
    } catch (error) {
      toast.error('Failed to accept duty');
    }
  };

  const handleDeclineDuty = async (dutyId) => {
    try {
      await axiosInstance.put(`/duties/${dutyId}/status?status=declined&reason=${encodeURIComponent(declineReason)}`);
      toast.success('Duty declined');
      setShowDeclineModal(false);
      setDeclineReason('');
      fetchData();
    } catch (error) {
      toast.error('Failed to decline duty');
    }
  };

  const handleViewDuty = async (duty) => {
    setSelectedDuty(duty);
    try {
      const response = await axiosInstance.get(`/duties/room/${duty.roomId}/exam/${duty.examSessionId}`);
      setStudents(response.data);
    } catch (error) {
      toast.error('Failed to load students');
    }
  };

  const handleMarkAttendance = async (allocationId, status) => {
    try {
      await axiosInstance.put(`/allocations/${allocationId}/attendance?attendance=${status}`);
      toast.success('Attendance marked');
      setStudents(prev => prev.map(s => s.id === allocationId ? { ...s, attendance: status } : s));
    } catch (error) {
      toast.error('Failed to mark attendance');
    }
  };

  const handleSubmitIncident = async () => {
    try {
      await axiosInstance.post('/incidents', {
        examSessionId: selectedDuty.examSessionId,
        invigilatorId: user.id,
        roomId: selectedDuty.roomId,
        studentId: incidentData.studentId || null,
        description: incidentData.description,
      });
      toast.success('Incident reported');
      setShowIncidentModal(false);
      setIncidentData({ description: '', studentId: '' });
    } catch (error) {
      toast.error('Failed to submit incident');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-teal-100">
      <nav className="bg-white/80 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invigilator Portal</h1>
            <p className="text-sm text-gray-600">{user?.profile?.name}</p>
          </div>
          <Button data-testid="invigilator-logout-btn" onClick={handleLogout} variant="outline" className="rounded-full">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </nav>

      <div  className="container mx-auto px-4 py-8>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}  className="mb-8>
          <h2  className="text-3xl font-bold text-gray-900 mb-2>Welcome, {user?.profile?.name}!</h2>
        </motion.div>

        <div  className="grid lg:grid-cols-3 gap-6 mb-8>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}  className="lg:col-span-2>
            <Card  data-testid="duties-card\"  className="backdrop-blur-sm bg-white/70>
              <CardHeader>
                <CardTitle  className="flex items-center>
                  <ClipboardCheck  className="h-5 w-5 mr-2 text-green-600\" />
                  My Duties
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div  className="text-center py-8>
                    <div  className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto></div>
                  </div>
                ) : duties.length === 0 ? (
                  <p  className="text-center text-gray-500 py-8>No duties assigned</p>
                ) : (
                  <div  className="space-y-4>
                    {duties.map((duty) => (
                      <div
                        key={duty.id}
                        data-testid={`duty-${duty.id}`}
                         className="p-4 border border-green-200 rounded-xl bg-gradient-to-r from-green-50 to-teal-50\"
                      >
                        <div  className="flex items-center justify-between mb-3>
                          <h3  className="text-lg font-semibold text-gray-900>{duty.exam?.title}</h3>
                          <Badge
                            className={
                              duty.status === 'accepted'
                                ? 'bg-green-500'
                                : duty.status === 'declined'
                                ? 'bg-red-500'
                                : 'bg-yellow-500'
                            }
                          >
                            {duty.status}
                          </Badge>
                        </div>
                        <div  className="space-y-2 text-sm text-gray-600 mb-4>
                          <div  className="flex items-center>
                            <Calendar  className="h-4 w-4 mr-2\" />
                            {duty.exam?.date} | {duty.exam?.startTime} - {duty.exam?.endTime}
                          </div>
                          <div  className="flex items-center>
                            <MapPin  className="h-4 w-4 mr-2\" />
                            Block: {duty.block?.name} | Room: {duty.room?.roomNumber}
                          </div>
                        </div>
                        <div  className="flex space-x-2>
                          {duty.status === 'pending' && (
                            <>
                              <Button
                                data-testid={`accept-duty-${duty.id}`}
                                onClick={() => handleAcceptDuty(duty.id)}
                                size=\"sm\"
                                 className="bg-green-600 hover:bg-green-700\"
                              >
                                <CheckCircle  className="h-4 w-4 mr-1\" /> Accept
                              </Button>
                              <Button
                                data-testid={`decline-duty-${duty.id}`}
                                onClick={() => {
                                  setSelectedDuty(duty);
                                  setShowDeclineModal(true);
                                }}
                                size=\"sm\"
                                variant=\"destructive\"
                              >
                                <XCircle  className="h-4 w-4 mr-1\" /> Decline
                              </Button>
                            </>
                          )}
                          {duty.status === 'accepted' && (
                            <Button
                              data-testid={`view-duty-${duty.id}`}
                              onClick={() => handleViewDuty(duty)}
                              size=\"sm\"
                               className="bg-blue-600 hover:bg-blue-700\"
                            >
                              View Details
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card  data-testid="invigilator-notifications-card\"  className="backdrop-blur-sm bg-white/70>
              <CardHeader>
                <CardTitle  className="flex items-center>
                  <Bell  className="h-5 w-5 mr-2 text-blue-600\" />
                  Notifications
                  {notifications.filter((n) => !n.isRead).length > 0 && (
                    <Badge  className="ml-auto\" variant=\"destructive>
                      {notifications.filter((n) => !n.isRead).length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent  className="space-y-3 max-h-96 overflow-y-auto>
                {notifications.length === 0 ? (
                  <p  className="text-sm text-gray-500>No notifications</p>
                ) : (
                  notifications.slice(0, 10).map((notif) => (
                    <div key={notif.id}  className="p-3 bg-blue-50 rounded-lg>
                      <p  className="text-sm>{notif.message}</p>
                      {!notif.isRead && (
                        <Badge  className="mt-2\" variant=\"secondary>
                          New
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <Dialog open={!!selectedDuty && !showDeclineModal} onOpenChange={() => setSelectedDuty(null)}>
        <DialogContent  className="max-w-3xl>
          <DialogHeader>
            <DialogTitle>Duty Details - Room {selectedDuty?.room?.roomNumber}</DialogTitle>
          </DialogHeader>
          <div  className="space-y-4>
            <div  className="flex justify-between items-center>
              <h3  className="text-lg font-semibold>{selectedDuty?.exam?.title}</h3>
              <Button
                 data-testid="report-incident-btn\"
                onClick={() => setShowIncidentModal(true)}
                size=\"sm\"
                variant=\"outline\"
                 className="text-orange-600 border-orange-600 hover:bg-orange-50\"
              >
                <AlertTriangle  className="h-4 w-4 mr-1\" /> Report Incident
              </Button>
            </div>
            <div  className="space-y-2>
              {students.map((student) => (
                <div
                  key={student.id}
                  data-testid={`student-attendance-${student.id}`}
                   className="flex items-center justify-between p-3 border rounded-lg\"
                >
                  <div>
                    <p  className="font-semibold>{student.student?.profile?.name}</p>
                    <p  className="text-sm text-gray-600>
                      Roll: {student.student?.rollNumber} | Bench: {student.benchNumber}
                    </p>
                  </div>
                  <div  className="flex space-x-2>
                    <Button
                      data-testid={`mark-present-${student.id}`}
                      onClick={() => handleMarkAttendance(student.id, 'present')}
                      size=\"sm\"
                      disabled={student.attendance === 'present'}
                      className={student.attendance === 'present' ? 'bg-green-600' : ''}
                    >
                      Present
                    </Button>
                    <Button
                      data-testid={`mark-absent-${student.id}`}
                      onClick={() => handleMarkAttendance(student.id, 'absent')}
                      size=\"sm\"
                      variant=\"destructive\"
                      disabled={student.attendance === 'absent'}
                    >
                      Absent
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeclineModal} onOpenChange={setShowDeclineModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Duty</DialogTitle>
          </DialogHeader>
          <div  className="space-y-4>
            <div>
              <Label>Reason for declining</Label>
              <Textarea
                 data-testid="decline-reason-input\"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder=\"Please provide a reason...\"
                rows={4}
              />
            </div>
            <div  className="flex space-x-2>
              <Button onClick={() => setShowDeclineModal(false)} variant=\"outline\"  className="flex-1>
                Cancel
              </Button>
              <Button
                 data-testid="submit-decline-btn\"
                onClick={() => handleDeclineDuty(selectedDuty?.id)}
                variant=\"destructive\"
                 className="flex-1\"
              >
                Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showIncidentModal} onOpenChange={setShowIncidentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Incident</DialogTitle>
          </DialogHeader>
          <div  className="space-y-4>
            <div>
              <Label>Description</Label>
              <Textarea
                 data-testid="incident-description-input\"
                value={incidentData.description}
                onChange={(e) => setIncidentData({ ...incidentData, description: e.target.value })}
                placeholder=\"Describe the incident...\"
                rows={4}
              />
            </div>
            <div  className="flex space-x-2>
              <Button onClick={() => setShowIncidentModal(false)} variant=\"outline\"  className="flex-1>
                Cancel
              </Button>
              <Button
                 data-testid="submit-incident-btn\"
                onClick={handleSubmitIncident}
                 className="flex-1 bg-orange-600 hover:bg-orange-700\"
              >
                Submit Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvigilatorDashboard;
