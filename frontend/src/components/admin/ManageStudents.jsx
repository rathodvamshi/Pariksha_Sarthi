import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { axiosInstance } from '@/App';
import { toast } from 'sonner';

const ManageStudents = ({ user }) => {
  const [students, setStudents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedBranch, setSelectedBranch] = useState('CSE');
  const [studentData, setStudentData] = useState({
    rollNumber: '',
    profile: { name: '', dob: '', branch: 'CSE', year: 1, section: 'A', attendancePercent: 85 },
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const branches = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'];
  const years = [1, 2, 3, 4];

  useEffect(() => {
    fetchStudents();
  }, [selectedYear, selectedBranch]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(`/students/${user.collegeId}?year=${selectedYear}&branch=${selectedBranch}`);
      setStudents(response.data);
    } catch (error) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/students', {
        collegeId: user.collegeId,
        ...studentData,
      });
      toast.success('Student created successfully');
      setShowModal(false);
      setStudentData({
        rollNumber: '',
        profile: { name: '', dob: '', branch: 'CSE', year: 1, section: 'A', attendancePercent: 85 },
        password: '',
      });
      fetchStudents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create student');
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;
    try {
      await axiosInstance.delete(`/students/${studentId}`);
      toast.success('Student deleted');
      fetchStudents();
    } catch (error) {
      toast.error('Failed to delete student');
    }
  };

  return (
    <div data-testid="manage-students" className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Manage Students</h2>
        <div className="flex space-x-2">
          <Button data-testid="add-student-btn" onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 rounded-full">
            <Plus className="h-4 w-4 mr-2" /> Add Student
          </Button>
        </div>
      </div>

      <Tabs defaultValue="1" value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
        <TabsList>
          {years.map((year) => (
            <TabsTrigger key={year} value={String(year)} data-testid={`year-tab-${year}`}>
              Year {year}
            </TabsTrigger>
          ))}
        </TabsList>

        {years.map((year) => (
          <TabsContent key={year} value={String(year)} className="space-y-4">
            <div className="flex items-center space-x-4 mb-4">
              <Label>Branch:</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger data-testid="branch-filter" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card className="backdrop-blur-sm bg-white/70">
              <CardContent className="p-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : students.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No students found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-semibold">Roll Number</th>
                          <th className="text-left p-3 font-semibold">Name</th>
                          <th className="text-left p-3 font-semibold">Branch</th>
                          <th className="text-left p-3 font-semibold">Section</th>
                          <th className="text-left p-3 font-semibold">Attendance</th>
                          <th className="text-left p-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => (
                          <tr key={student.id} data-testid={`student-row-${student.id}`} className="border-b hover:bg-blue-50">
                            <td className="p-3">{student.rollNumber}</td>
                            <td className="p-3">{student.profile?.name}</td>
                            <td className="p-3">{student.profile?.branch}</td>
                            <td className="p-3">{student.profile?.section}</td>
                            <td className="p-3">{student.profile?.attendancePercent}%</td>
                            <td className="p-3">
                              <Button
                                data-testid={`delete-student-${student.id}`}
                                onClick={() => handleDeleteStudent(student.id)}
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
        ))}
      </Tabs>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateStudent} className="space-y-4">
            <div>
              <Label htmlFor="rollNumber">Roll Number</Label>
              <Input
                data-testid="student-roll-input"
                id="rollNumber"
                value={studentData.rollNumber}
                onChange={(e) => setStudentData({ ...studentData, rollNumber: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                data-testid="student-name-input"
                id="name"
                value={studentData.profile.name}
                onChange={(e) => setStudentData({ ...studentData, profile: { ...studentData.profile, name: e.target.value } })}
                required
              />
            </div>
            <div>
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                data-testid="student-dob-input"
                id="dob"
                type="date"
                value={studentData.profile.dob}
                onChange={(e) => setStudentData({ ...studentData, profile: { ...studentData.profile, dob: e.target.value } })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="branch">Branch</Label>
                <Select
                  value={studentData.profile.branch}
                  onValueChange={(value) => setStudentData({ ...studentData, profile: { ...studentData.profile, branch: value } })}
                >
                  <SelectTrigger data-testid="student-branch-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="year">Year</Label>
                <Select
                  value={String(studentData.profile.year)}
                  onValueChange={(value) => setStudentData({ ...studentData, profile: { ...studentData.profile, year: parseInt(value) } })}
                >
                  <SelectTrigger data-testid="student-year-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        Year {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="section">Section</Label>
              <Input
                data-testid="student-section-input"
                id="section"
                value={studentData.profile.section}
                onChange={(e) => setStudentData({ ...studentData, profile: { ...studentData.profile, section: e.target.value } })}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Default Password</Label>
              <Input
                data-testid="student-password-input"
                id="password"
                type="password"
                value={studentData.password}
                onChange={(e) => setStudentData({ ...studentData, password: e.target.value })}
                placeholder="Default password for student"
                required
              />
            </div>
            <Button data-testid="create-student-btn" type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Create Student
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageStudents;