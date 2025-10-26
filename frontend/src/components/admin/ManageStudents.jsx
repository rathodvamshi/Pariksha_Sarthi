import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Trash2, Upload, FileSpreadsheet, Download, Edit2, X, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { axiosInstance } from '@/App';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const ManageStudents = ({ user }) => {
  const [students, setStudents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedBranch, setSelectedBranch] = useState('CSE');
  const [studentData, setStudentData] = useState({
    rollNumber: '',
    name: '',
    email: '',
    dob: '',
    branch: 'CSE',
    year: 1,
    section: 'A',
    attendancePercent: 85,
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedStudents, setImportedStudents] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showDragDropArea, setShowDragDropArea] = useState(false);
  const fileInputRef = useRef(null);

  const branches = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'];
  const years = [1, 2, 3, 4];

  useEffect(() => {
    fetchStudents();
  }, [selectedYear, selectedBranch]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      if (!user?.collegeId) {
        console.error('Missing collegeId, cannot fetch students');
        toast.error('Missing college information');
        setStudents([]);
        return;
      }
      
      console.log(`Fetching students with collegeId: ${user.collegeId}, year: ${selectedYear}, branch: ${selectedBranch}`);
      const response = await axiosInstance.get(`/students/${user.collegeId}?year=${selectedYear}&branch=${selectedBranch}`);
      console.log('Students fetched successfully:', response.data);
      
      // Ensure we have an array of students
      if (Array.isArray(response.data)) {
        setStudents(response.data);
      } else {
        console.warn('API returned non-array data:', response.data);
        setStudents([]);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      console.error('Error details:', error.response?.data);
      
      // More descriptive error message based on error type
      if (error.response?.status === 404) {
        toast.error('No students found for this college');
      } else if (error.response?.status === 401) {
        toast.error('Authentication error. Please log in again.');
      } else {
        toast.error('Failed to load students. Please try again.');
      }
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!studentData.rollNumber || !studentData.name) {
      toast.error('Roll number and name are required');
      return;
    }
    
    setLoading(true);
    try {
      const data = {
        collegeId: user.collegeId,
        ...studentData,
      };
      
      // Set password to roll number if not provided
      if (!data.password || data.password.trim() === '') {
        data.password = data.rollNumber;
      }
      
      // Ensure branch and year are properly set
      data.branch = data.branch || selectedBranch;
      data.year = data.year || selectedYear;
      
      console.log('Creating student with data:', JSON.stringify(data, null, 2));
      const response = await axiosInstance.post('/students', data);
      console.log('Student created successfully:', response.data);
      toast.success('Student created successfully');
      setShowModal(false);
      setStudentData({
        rollNumber: '',
        name: '',
        email: '',
        dob: '',
        branch: 'CSE',
        year: 1,
        section: 'A',
        attendancePercent: 85,
        password: '',
      });
      fetchStudents();
    } catch (error) {
      console.error('Error creating student:', error);
      console.error('Error response:', error.response);
      console.error('Error details:', error.response?.data);
      
      // More descriptive error messages based on error type
      if (error.response?.status === 409) {
        toast.error('Student with this roll number already exists');
      } else if (error.response?.status === 400) {
        const errorMessage = typeof error.response?.data?.detail === 'string' 
          ? error.response.data.detail 
          : 'Invalid student data. Please check all fields.';
        toast.error(errorMessage);
      } else {
        const errorMessage = typeof error.response?.data?.detail === 'string' 
          ? error.response.data.detail 
          : 'Failed to create student. Please try again.';
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
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
  
  const processFile = useCallback((file) => {
    if (!file) return;
    
    setPreviewLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Transform data to match our student model
        const students = jsonData.map((row, index) => ({
          id: crypto.randomUUID(),
          collegeId: user.collegeId,
          rollNumber: row.rollNumber || row['Roll Number'] || row['Roll_Number'] || '',
          name: row.name || row['Name'] || '',
          email: row.email || row['Email'] || null, // Set to null if empty to avoid validation issues
          dob: row.dob || row['Date of Birth'] || row['DOB'] || null,
          branch: row.branch || row['Branch'] || selectedBranch,
          year: parseInt(row.year || row['Year'] || selectedYear),
          section: row.section || row['Section'] || 'A',
          attendancePercent: parseFloat(row.attendancePercent || row['Attendance'] || '85'),
          password: row.password || row['Password'] || row.rollNumber || row['Roll Number'] || ''
        }));
        
        setImportedStudents(students);
        setShowImportModal(true);
        setShowDragDropArea(false); // Hide drag-drop area when showing preview
        toast.success(`Successfully parsed ${students.length} students from file`);
      } catch (error) {
        console.error('File parsing error:', error);
        toast.error('Failed to parse file. Please check the format.');
      } finally {
        setPreviewLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  }, [user.collegeId, selectedBranch, selectedYear]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleImportButtonClick = () => {
    setShowDragDropArea(true);
    fileInputRef.current?.click();
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const file = files.find(f => 
      f.type === 'text/csv' || 
      f.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      f.type === 'application/vnd.ms-excel' ||
      f.name.endsWith('.csv') ||
      f.name.endsWith('.xlsx') ||
      f.name.endsWith('.xls')
    );
    
    if (file) {
      processFile(file);
    } else {
      toast.error('Please select a valid CSV or Excel file');
    }
  }, [processFile]);
  
  const handleEditStudent = (studentId) => {
    const student = importedStudents.find(s => s.id === studentId);
    if (student) {
      setEditingStudent({ ...student });
    }
  };

  const handleUpdateStudent = () => {
    if (!editingStudent) return;
    
    setImportedStudents(prev => 
      prev.map(student => 
        student.id === editingStudent.id ? editingStudent : student
      )
    );
    setEditingStudent(null);
    toast.success('Student updated successfully');
  };

  const handleDeleteStudentFromPreview = (studentId) => {
    setImportedStudents(prev => prev.filter(student => student.id !== studentId));
    toast.success('Student removed from import list');
  };

  const handleImportStudents = async () => {
    if (importedStudents.length === 0) {
      toast.error('No students to import');
      return;
    }
    
    // Validate required fields
    const invalidStudents = importedStudents.filter(student => 
      !student.rollNumber || !student.name || !student.branch || !student.year
    );
    
    if (invalidStudents.length > 0) {
      toast.error(`Please fix ${invalidStudents.length} students with missing required fields (Roll Number, Name, Branch, Year)`);
      return;
    }
    
    // Validate user and collegeId
    if (!user || !user.collegeId) {
      toast.error('User information is missing. Please log in again.');
      return;
    }
    
    if (user.role !== 'admin') {
      toast.error('Only admin users can import students.');
      return;
    }
    
    setImportLoading(true);
    try {
      console.log('=== IMPORT REQUEST DEBUG ===');
      console.log('Number of students to import:', importedStudents.length);
      console.log('First student sample:', importedStudents[0]);
      console.log('User collegeId:', user.collegeId);
      console.log('User role:', user.role);
      console.log('Auth token exists:', !!localStorage.getItem('token'));
      console.log('Auth token value:', localStorage.getItem('token'));
      
      // Ensure all students have the correct collegeId
      const studentsWithCorrectCollegeId = importedStudents.map(student => ({
        ...student,
        collegeId: user.collegeId
      }));
      
      console.log('Students with corrected collegeId:', studentsWithCorrectCollegeId[0]);
      console.log('=== END REQUEST DEBUG ===');
      
      // Test authentication first
      try {
        const authTest = await axiosInstance.get('/auth/verify');
        console.log('Auth verification successful:', authTest.data);
      } catch (authError) {
        console.error('Auth verification failed:', authError);
        toast.error('Authentication failed. Please log in again.');
        return;
      }
      
      // Test with a simple request first
      try {
        console.log('Testing simple API call...');
        const testResponse = await axiosInstance.get('/colleges');
        console.log('Simple API call successful:', testResponse.data);
      } catch (testError) {
        console.error('Simple API call failed:', testError);
        toast.error('API connection failed. Please check your connection.');
        return;
      }
      
      console.log('Making bulk import request...');
      const response = await axiosInstance.post('/students/bulk', studentsWithCorrectCollegeId, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('Import response received:', response.data);
      toast.success(`${importedStudents.length} students imported successfully`);
      setShowImportModal(false);
      setImportedStudents([]);
      setShowDragDropArea(false); // Hide drag-drop area after successful import
      fetchStudents();
    } catch (error) {
      console.error('=== IMPORT ERROR DEBUG ===');
      console.error('Full error object:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      console.error('Error response status:', error.response?.status);
      console.error('Error response headers:', error.response?.headers);
      console.error('Request config:', error.config);
      console.error('=== END DEBUG ===');
      
      let errorMessage = 'Failed to import students';
      
      if (error.response?.data) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (typeof error.response.data.message === 'string') {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(`Import failed: ${errorMessage}`);
    } finally {
      setImportLoading(false);
    }
  };
  
  const downloadTemplate = () => {
    const template = [
      {
        'Roll Number': 'ABC123',
        'Name': 'Student Name',
        'Date of Birth': '2000-01-01',
        'Branch': 'CSE',
        'Year': '1',
        'Section': 'A',
        'Password': 'password123'
      }
    ];
    
    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, 'student_import_template.xlsx');
  };

  return (
    <div data-testid="manage-students" className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Manage Students</h2>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Button 
            variant="outline" 
            onClick={handleImportButtonClick}
            disabled={previewLoading}
          >
            {previewLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            Import CSV/Excel
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            className="hidden"
          />
          <Button data-testid="add-student-btn" onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 rounded-full">
            <Plus className="h-4 w-4 mr-2" /> Add Student
          </Button>
        </div>
      </div>

      {/* Drag and Drop Upload Area - Only shown when Import button is clicked */}
      {showDragDropArea && (
        <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors duration-200">
          <CardContent 
            className={`p-8 text-center transition-all duration-200 ${
              isDragOver ? 'bg-blue-50 border-blue-400' : 'bg-gray-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center space-y-4">
              <div className={`p-4 rounded-full transition-colors duration-200 ${
                isDragOver ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                <Upload className={`h-8 w-8 transition-colors duration-200 ${
                  isDragOver ? 'text-blue-600' : 'text-gray-400'
                }`} />
              </div>
              <div>
                <h3 className={`text-lg font-semibold transition-colors duration-200 ${
                  isDragOver ? 'text-blue-600' : 'text-gray-700'
                }`}>
                  {isDragOver ? 'Drop your file here' : 'Drag & Drop CSV/Excel files here'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  or click the Import button above to select files
                </p>
              </div>
              {previewLoading && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processing file...</span>
                </div>
              )}
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={previewLoading}
                >
                  {previewLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                  )}
                  Select File
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowDragDropArea(false)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Close
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="year-filter">Year:</Label>
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger id="year-filter" className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="branch-filter">Branch:</Label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger id="branch-filter" className="w-[120px]">
              <SelectValue placeholder="Branch" />
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
        
        <div className="ml-auto flex items-center">
          <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
            Total Students: {students.length}
          </div>
        </div>
      </div>

      <Tabs defaultValue="1" value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
        {years.map((year) => (
          <TabsContent key={year} value={String(year)} className="space-y-4">
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
                            <td className="p-3">{student.name}</td>
                            <td className="p-3">{student.branch}</td>
                            <td className="p-3">{student.section}</td>
                            <td className="p-3">{student.attendancePercent}%</td>
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
                value={studentData.name}
                onChange={(e) => setStudentData({ ...studentData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                value={studentData.email}
                onChange={(e) => setStudentData({ ...studentData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                data-testid="student-dob-input"
                id="dob"
                type="date"
                value={studentData.dob}
                onChange={(e) => setStudentData({ ...studentData, dob: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="branch">Branch</Label>
                <Select
                  value={studentData.branch}
                  onValueChange={(value) => setStudentData({ ...studentData, branch: value })}
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
                  value={String(studentData.year)}
                  onValueChange={(value) => setStudentData({ ...studentData, year: parseInt(value) })}
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
                value={studentData.section}
                onChange={(e) => setStudentData({ ...studentData, section: e.target.value })}
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

      {/* Enhanced Import Students Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Import Students Preview</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">
                  {importedStudents.length} students ready to import
                </span>
                <Button
                  onClick={handleImportStudents}
                  disabled={importLoading || importedStudents.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {importLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save All Students
                    </>
                  )}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Review and edit student data before importing.</strong> You can edit individual students or remove them from the import list.
              </p>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {importedStudents.map((student, index) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{student.rollNumber}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{student.branch}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{student.year}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{student.section}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditStudent(student.id)}
                            className="hover:text-blue-600"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteStudentFromPreview(student.id)}
                            className="hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => setShowImportModal(false)}>
              Cancel
            </Button>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                {importedStudents.length} students will be imported
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Student Modal */}
      <Dialog open={editingStudent !== null} onOpenChange={() => setEditingStudent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          {editingStudent && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-rollNumber">Roll Number</Label>
                <Input
                  id="edit-rollNumber"
                  value={editingStudent.rollNumber}
                  onChange={(e) => setEditingStudent({ ...editingStudent, rollNumber: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingStudent.email}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-branch">Branch</Label>
                  <Select
                    value={editingStudent.branch}
                    onValueChange={(value) => setEditingStudent({ ...editingStudent, branch: value })}
                  >
                    <SelectTrigger>
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
                  <Label htmlFor="edit-year">Year</Label>
                  <Select
                    value={String(editingStudent.year)}
                    onValueChange={(value) => setEditingStudent({ ...editingStudent, year: parseInt(value) })}
                  >
                    <SelectTrigger>
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
                <Label htmlFor="edit-section">Section</Label>
                <Input
                  id="edit-section"
                  value={editingStudent.section}
                  onChange={(e) => setEditingStudent({ ...editingStudent, section: e.target.value })}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingStudent(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateStudent} className="bg-blue-600 hover:bg-blue-700">
                  Update Student
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageStudents;