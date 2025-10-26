import React, { useEffect, useState } from 'react';
import { Plus, CheckCircle, Download, Edit, Trash2, Eye, ArrowLeft, ArrowRight, Users, Building2, Clock, CalendarDays, FileText, Save, Calendar, Search, Filter, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { axiosInstance } from '@/App';
import { toast } from 'sonner';
import CalendarSidebar from './CalendarSidebar';

const CreateExam = ({ user }) => {
  const [exams, setExams] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [invigilators, setInvigilators] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [examData, setExamData] = useState({
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    subjects: [],
    years: [],
    branches: [],
    allocationType: 'serial',
    studentsPerBench: 1,
  });
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createdExamId, setCreatedExamId] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [selectedInvigilators, setSelectedInvigilators] = useState({});
  const [capacityInfo, setCapacityInfo] = useState({ totalStudents: 0, allocatedCapacity: 0, isComplete: false });
  const [draftExams, setDraftExams] = useState([]);
  const [activeTab, setActiveTab] = useState('existing');
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editingExamId, setEditingExamId] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [restrictedStudents, setRestrictedStudents] = useState([]);
  const [csvParseErrors, setCsvParseErrors] = useState([]);
  const [showRestrictedModal, setShowRestrictedModal] = useState(false);
  const [csvUploaded, setCsvUploaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [searchRestricted, setSearchRestricted] = useState('');

  const branches = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'];
  const years = [1, 2, 3, 4];

  useEffect(() => {
    fetchData();
    
    // Suppress PostHog/analytics errors (common with ad blockers)
    const originalError = console.error;
    console.error = function(...args) {
      if (args[0]?.includes?.('posthog') || args[0]?.includes?.('ERR_BLOCKED_BY_CLIENT')) {
        // Silently ignore analytics errors
        return;
      }
      originalError.apply(console, args);
    };
    
    return () => {
      console.error = originalError;
    };
  }, []);

  useEffect(() => {
    if (examData.branches.length > 0) {
      fetchSubjects();
    }
  }, [examData.branches]);

  const fetchData = async () => {
    try {
      const [examsRes, blocksRes, invigilatorsRes, yearsRes, draftRes] = await Promise.all([
        axiosInstance.get(`/exams/${user.collegeId}`),
        axiosInstance.get(`/blocks/${user.collegeId}`),
        axiosInstance.get(`/staff/${user.collegeId}?role=invigilator`),
        axiosInstance.get('/years'),
        axiosInstance.get(`/draft_exam/${user.collegeId}`),
      ]);
      setExams(examsRes.data);
      setBlocks(blocksRes.data);
      setInvigilators(invigilatorsRes.data);
      setAvailableYears(yearsRes.data);
      setDraftExams(draftRes.data);

      const roomsPromises = blocksRes.data.map((block) => axiosInstance.get(`/rooms/${block.id}`));
      const roomsResults = await Promise.all(roomsPromises);
      const rooms = roomsResults.flatMap((res) => res.data);
      setAllRooms(rooms);
    } catch (error) {
      toast.error('Failed to load data');
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await axiosInstance.get('/subjects', {
        params: {
          college_id: user.collegeId,
          branch_id: examData.branches.join(','),
        }
      });
      setSubjects(response.data);
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
    }
  };

  const handleCreateExam = async () => {
    try {
      const response = await axiosInstance.post('/exams', {
        collegeId: user.collegeId,
        ...examData,
        subjects: examData.subjects,
      });
      toast.success('Exam created successfully');
      setCreatedExamId(response.data.id);
      setCurrentStep(2);
      await fetchCapacityInfo();
    } catch (error) {
      toast.error('Failed to create exam');
    }
  };

  const handleSaveDraft = async () => {
    try {
      const draftData = {
        collegeId: user.collegeId,
        ...examData,
        subjects: examData.subjects,
        selectedRooms,
        selectedInvigilators,
        studentAllocations: allocations,
      };
      
      if (isEditing && editingExamId) {
        await axiosInstance.put(`/draft_exam/${editingExamId}`, draftData);
        toast.success('Draft updated successfully');
      } else {
        await axiosInstance.post('/draft_exam', draftData);
        toast.success('Draft saved successfully');
      }
      
      fetchData();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Save draft error:', error);
      toast.error('Failed to save draft');
    }
  };

  const handleFinalizeDraft = async (draftId) => {
    try {
      const response = await axiosInstance.post(`/draft_exam/${draftId}/finalize`);
      toast.success('Draft finalized successfully');
      fetchData();
    } catch (error) {
      console.error('Finalize draft error:', error);
      toast.error('Failed to finalize draft');
    }
  };

  const handleEditExam = async (examId, isDraft = false) => {
    try {
      const endpoint = isDraft ? `/draft_exam/${examId}` : `/exams/${examId}`;
      const response = await axiosInstance.get(endpoint);
      
      setExamData({
        title: response.data.title,
        date: response.data.date,
        startTime: response.data.startTime,
        endTime: response.data.endTime,
        subjects: response.data.subjects || [],
        years: response.data.years || [],
        branches: response.data.branches || [],
        allocationType: response.data.allocationType || 'serial',
        studentsPerBench: response.data.studentsPerBench || 1,
      });
      
      if (isDraft) {
        setSelectedRooms(response.data.selectedRooms || []);
        setSelectedInvigilators(response.data.selectedInvigilators || {});
        setEditingExamId(examId);
        setIsEditing(true);
      } else {
        setCreatedExamId(examId);
        setIsEditing(true);
      }
      
      setShowModal(true);
      setCurrentStep(1);
      toast.success('Exam loaded for editing');
    } catch (error) {
      console.error('Edit exam error:', error);
      toast.error('Failed to load exam details');
    }
  };

  const handleCalendarExamClick = (examId) => {
    if (examId) {
      handleEditExam(examId, false);
    }
  };

  const filteredExams = exams.filter(exam => {
    const matchesSearch = exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        exam.subjects?.some(subject => subject.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || exam.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredDrafts = draftExams.filter(draft => {
    const matchesSearch = draft.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        draft.subjects?.some(subject => subject.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const fetchCapacityInfo = async () => {
    if (!createdExamId) {
      setCapacityInfo({ totalStudents: 0, allocatedCapacity: 0, isComplete: false });
      return;
    }
    try {
      const response = await axiosInstance.get(`/allocate_room/${createdExamId}/capacity`);
      setCapacityInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch capacity info:', error);
      setCapacityInfo({ totalStudents: 0, allocatedCapacity: 0, isComplete: false });
    }
  };

  const handleAllocateRoom = async (roomId, invigilatorId = null) => {
    try {
      const response = await axiosInstance.post('/allocate_room', {
        exam_id: createdExamId,
        room_id: roomId,
        invigilator_id: invigilatorId,
      });
      setSelectedRooms([...selectedRooms, roomId]);
      if (invigilatorId) {
        setSelectedInvigilators({ ...selectedInvigilators, [roomId]: invigilatorId });
      }
      await fetchCapacityInfo();
      toast.success(`Room allocated successfully! Capacity: ${response.data.capacity} seats`);
    } catch (error) {
      console.error('Room allocation error:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to allocate room';
      toast.error(errorMessage);
    }
  };

  const handleRemoveRoom = async (roomId) => {
    if (!confirm('Remove this room from the exam?')) return;
    try {
      await axiosInstance.delete(`/allocate_room/${createdExamId}/${roomId}`);
      setSelectedRooms(selectedRooms.filter(id => id !== roomId));
      const newInvigilators = { ...selectedInvigilators };
      delete newInvigilators[roomId];
      setSelectedInvigilators(newInvigilators);
      await fetchCapacityInfo();
      toast.success('Room removed successfully');
    } catch (error) {
      console.error('Remove room error:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to remove room';
      toast.error(errorMessage);
    }
  };

  const handleAllocateSeats = async () => {
    if (selectedRooms.length === 0) {
      toast.error('Please select at least one room');
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.post(`/exams/${createdExamId}/allocate`, selectedRooms);
      toast.success(`${response.data.count} seats allocated successfully`);
      
      const allocationsRes = await axiosInstance.get(`/allocations/exam/${createdExamId}`);
      setAllocations(allocationsRes.data);
      setCurrentStep(3);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to allocate seats');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignInvigilator = async (roomId, invigilatorId) => {
    try {
      await axiosInstance.post('/duties', {
        examSessionId: createdExamId,
        invigilatorId,
        roomId,
      });
      setSelectedInvigilators({ ...selectedInvigilators, [roomId]: invigilatorId });
      toast.success('Invigilator assigned');
    } catch (error) {
      toast.error('Failed to assign invigilator');
    }
  };

  const handleDownloadAllocation = async (examId, format = 'excel') => {
    try {
      const response = await axiosInstance.get(`/exams/${examId}/download?format=${format}`, {
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/octet-stream' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.headers['content-disposition']?.split('filename=')[1] || `allocation_list.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Download started');
    } catch (error) {
      toast.error('Failed to download allocation list');
    }
  };


  const handleDeleteExam = async (examId) => {
    if (!confirm('Are you sure you want to delete this exam? This action cannot be undone. This will also remove it from the calendar.')) {
      return;
    }

    try {
      // Delete exam
      await axiosInstance.delete(`/exams/${examId}`);

      // Remove any calendar events linked to this exam
      try {
        const evRes = await axiosInstance.get(`/calendar_events/${user.collegeId}`);
        const linked = (evRes.data || []).filter(ev => ev.examId === examId || ev.linkedExamId === examId);
        await Promise.all(linked.map(ev => axiosInstance.delete(`/calendar_events/${ev.id}`)));
        // notify calendar sidebar to refresh immediately
        try { window.dispatchEvent(new Event('calendar:refresh')); } catch (e) { /* no-op */ }
      } catch (calErr) {
        console.error('Failed to remove calendar events for exam:', calErr);
      }

      toast.success('Exam deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Delete exam error:', error);
      toast.error('Failed to delete exam');
    }
  };

  const handleFinalize = () => {
    toast.success('Exam arrangement finalized successfully!');
    setShowModal(false);
    resetForm();
    fetchData();
  };

  const handleCsvUpload = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      processCsvFile(file);
    } else {
      toast.error('Please select a valid CSV file');
    }
  };

  const processCsvFile = (file) => {
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      try {
        const { rows, headers } = parseCsv(text);
        // Validate rows
        const { validRows, errors } = validateCsvRows(rows, headers);
        setCsvPreview(validRows);
        setCsvParseErrors(errors);
        if (errors.length > 0) {
          toast.error(`CSV loaded with ${errors.length} validation issue(s). Fix or edit rows before upload.`);
        } else {
          toast.success('CSV parsed successfully');
        }
      } catch (err) {
        console.error('CSV parse error', err);
        toast.error('Failed to parse CSV file. Ensure it is a valid CSV.');
        setCsvPreview([]);
        setCsvParseErrors([{ row: null, message: 'Malformed CSV' }]);
      }
    };
    reader.readAsText(file);
    
  };

  // Robust CSV parser - handles quoted fields and commas inside quotes
  const parseCsv = (text) => {
    const rows = [];
    let cur = '';
    let row = [];
    let inQuotes = false;
    let i = 0;
    const pushCell = () => { row.push(cur); cur = ''; };
    const pushRow = () => { rows.push(row); row = []; };

    while (i < text.length) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuotes && text[i+1] === '"') {
          // escaped quote
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = !inQuotes;
        i++;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        pushCell();
        i++;
        continue;
      }
      if ((ch === '\n' || ch === '\r') && !inQuotes) {
        // handle CRLF or LF
        pushCell();
        pushRow();
        // skip possible \r\n
        if (ch === '\r' && text[i+1] === '\n') i++;
        i++;
        continue;
      }
      cur += ch;
      i++;
    }
    // push last
    if (cur !== '' || inQuotes === false) pushCell();
    if (row.length > 0) pushRow();

    // Trim cells
    const trimmedRows = rows.map(r => r.map(cell => cell.trim()));
    const headers = trimmedRows[0] || [];
    const dataRows = trimmedRows.slice(1).filter(r => r.some(c => c !== ''));
    // Map rows to objects using headers
    const mapped = dataRows.map(r => {
      const obj = {};
      headers.forEach((h, idx) => {
        if (h) obj[h.trim()] = r[idx] ?? '';
      });
      return obj;
    });
    return { rows: mapped, headers };
  };

  const validateCsvRows = (rows, headers) => {
    const errors = [];
    const validRows = [];

    // Normalization helpers
    const normalizeRow = (r) => {
      // map common headers to canonical keys
      const out = {};
      const keys = Object.keys(r);
      const get = (names) => {
        for (const n of names) {
          if (r[n] !== undefined && String(r[n]).trim() !== '') return String(r[n]).trim();
        }
        return '';
      };
      out.studentName = get(['Student Name', 'studentName', 'name']);
      out.rollNumber = get(['Roll Number', 'rollNumber', 'roll']);
      out.branch = get(['Branch', 'branch']);
      out.year = get(['Year', 'year']);
      out.attendancePercentage = get(['Attendance %', 'Attendance', 'attendancePercentage', 'attendance']);
      return out;
    };

    rows.forEach((r, idx) => {
      const nr = normalizeRow(r);
      const rowNum = idx + 2; // account for header
      // Basic validations
      if (!nr.studentName) errors.push({ row: rowNum, message: 'Missing student name' });
      if (!nr.rollNumber) errors.push({ row: rowNum, message: 'Missing roll number' });
      // attendance validation
      if (nr.attendancePercentage) {
        const num = Number(String(nr.attendancePercentage).replace('%', '').trim());
        if (Number.isNaN(num) || num < 0 || num > 100) {
          errors.push({ row: rowNum, message: 'Invalid attendance percentage' });
        } else {
          nr.attendancePercentage = num;
        }
      } else {
        // If no attendance provided, treat as 0 and raise a warning
        nr.attendancePercentage = '';
      }

      // If critical fields exist (name or roll) keep row available for editing/upload
      validRows.push(nr);
    });

    return { validRows, errors };
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      processCsvFile(file);
    } else {
      toast.error('Please drop a valid CSV file');
    }
  };

  const downloadTemplate = () => {
    // Create template with exact column names expected by backend
    const template = 'Student Name,Roll Number,Branch,Year,Attendance %\n"John Doe","21CSE001","CSE",3,62.5\n"Jane Smith","21ECE015","ECE",2,58.3\n"Alex Johnson","21EEE023","EEE",4,45.0\n';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'attendance_restrictions_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success('Template downloaded successfully');
  };

  const handleUploadCsvToBackend = async () => {
    if (!csvFile || !createdExamId) {
      toast.error('Please select a CSV file and create an exam first');
      return;
    }

    if (csvParseErrors && csvParseErrors.length > 0) {
      if (!confirm(`There are ${csvParseErrors.length} issues in the CSV. Proceed to upload anyway? It's recommended to fix them first.`)) {
        return;
      }
    }

    try {
      setLoading(true);
      setUploadProgress(0);

      const formData = new FormData();
      // If user edited preview, upload normalized CSV built from csvPreview, otherwise upload original file
      if (csvPreview && csvPreview.length > 0) {
        // Build CSV text from preview using canonical headers
        const headers = ['Student Name','Roll Number','Branch','Year','Attendance %'];
        const rows = csvPreview.map(r => [
          (r.studentName || r['Student Name'] || '').replace(/"/g, '""'),
          (r.rollNumber || r['Roll Number'] || '').replace(/"/g, '""'),
          (r.branch || r.Branch || '').replace(/"/g, '""'),
          (r.year || r.Year || '').replace(/"/g, '""'),
          (r.attendancePercentage !== undefined && r.attendancePercentage !== '') ? String(r.attendancePercentage) : ''
        ]);
        const csvText = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob([csvText], { type: 'text/csv' });
        formData.append('file', blob, csvFile.name || 'upload.csv');
      } else {
        formData.append('file', csvFile);
      }

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const response = await axiosInstance.post(
        `/exams/${createdExamId}/upload_attendance_csv`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          },
        }
      );

      clearInterval(progressInterval);
      setUploadProgress(100);
      toast.success(`${response.data.message} (${response.data.total} restrictions created)`);
      setCsvUploaded(true);
      
      // Fetch restricted students
      await fetchRestrictedStudents();
      
      if (response.data.errors && response.data.errors.length > 0) {
        // Only show warning if significant errors occurred
        const errorCount = response.data.errors.length;
        if (errorCount > 0 && errorCount >= response.data.total / 2) {
          toast.warning(`${errorCount} errors occurred. ${response.data.total} students processed successfully.`);
        }
        // Silently log errors to console without showing the array
        if (response.data.errors.length <= 10) {
          response.data.errors.forEach(err => console.debug('Upload note:', err));
        } else {
          console.debug(`${response.data.errors.length} upload issues occurred`);
        }
      }
    } catch (error) {
      // Only log actual errors, not analytics blocks
      if (!error?.message?.includes?.('posthog') && !error?.message?.includes?.('ERR_BLOCKED')) {
        console.error('CSV upload error:', error);
      }
      
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to upload CSV';
      toast.error(errorMessage, {
        duration: 5000
      });
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchRestrictedStudents = async () => {
    if (!createdExamId) return;

    try {
      const response = await axiosInstance.get(`/exams/${createdExamId}/restricted_students`);
      setRestrictedStudents(response.data);
    } catch (error) {
      console.error('Failed to fetch restricted students:', error);
    }
  };

  // Local preview edit/save
  const handleSaveLocalEdit = (updated) => {
    if (editingIndex == null) return;
    setCsvPreview(prev => prev.map((r, i) => i === editingIndex ? { ...r, ...updated } : r));
    setEditingIndex(null);
    setEditingStudent(null);
    setShowEditStudentModal(false);
    toast.success('Row updated in preview');
  };

  // Backend: edit restricted student
  const handleEditRestrictedStudent = (student) => {
    // reuse same modal state for editing (showEditStudentModal) but indicate backend edit
    setEditingStudent(student);
    setShowEditStudentModal(true);
  };

  const handleSaveRestrictedEdit = async (updated) => {
    if (!createdExamId || !editingStudent) return;
    try {
      const studentId = editingStudent.studentId;
      const payload = {
        studentName: updated.studentName ?? editingStudent.studentName,
        rollNumber: updated.rollNumber ?? editingStudent.rollNumber,
        branch: updated.branch ?? editingStudent.branch,
        year: updated.year ?? editingStudent.year,
        attendancePercentage: updated.attendancePercentage ?? editingStudent.attendancePercentage,
      };
      await axiosInstance.put(`/exams/${createdExamId}/restricted_students/${studentId}`, payload);
      // update local state
      setRestrictedStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, ...payload } : s));
      setEditingStudent(null);
      setShowEditStudentModal(false);
      toast.success('Student details updated');
    } catch (error) {
      console.error('Failed to update restricted student:', error);
      toast.error('Failed to update student');
    }
  };

  const handleDeleteRestrictedStudent = async (studentId) => {
    if (!createdExamId) return;
    if (!confirm('Delete this restricted student permanently?')) return;
    try {
      await axiosInstance.delete(`/exams/${createdExamId}/restricted_students/${studentId}`);
      setRestrictedStudents(prev => prev.filter(s => s.studentId !== studentId));
      toast.success('Student deleted');
    } catch (error) {
      console.error('Failed to delete restricted student:', error);
      toast.error('Failed to delete student');
    }
  };

  const handleGrantPermission = async (studentId) => {
    try {
      await axiosInstance.post(`/exams/${createdExamId}/grant_permission/${studentId}`);
      toast.success('Permission granted successfully');
      
      // Update local state
      setRestrictedStudents(prev => 
        prev.map(s => s.studentId === studentId ? { ...s, isAllowed: true } : s)
      );
    } catch (error) {
      console.error('Grant permission error:', error);
      toast.error('Failed to grant permission');
    }
  };

  const handleGrantAllPermissions = async () => {
    try {
      const response = await axiosInstance.post(`/exams/${createdExamId}/grant_all_permissions`);
      toast.success(response.data.message);
      
      // Update local state
      setRestrictedStudents(prev => 
        prev.map(s => ({ ...s, isAllowed: true }))
      );
    } catch (error) {
      console.error('Grant all permissions error:', error);
      toast.error('Failed to grant all permissions');
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setExamData({
      title: '',
      date: '',
      startTime: '',
      endTime: '',
      subjects: [],
      years: [],
      branches: [],
      allocationType: 'serial',
      studentsPerBench: 1,
    });
    setSelectedRooms([]);
    setCreatedExamId(null);
    setAllocations([]);
    setSelectedInvigilators({});
    setCapacityInfo({ totalStudents: 0, allocatedCapacity: 0, isComplete: false });
    setIsEditing(false);
    setEditingExamId(null);
    setCsvFile(null);
    setCsvPreview([]);
    setRestrictedStudents([]);
    setShowRestrictedModal(false);
    setCsvUploaded(false);
    setUploadProgress(0);
    setIsDragging(false);
    setSearchRestricted('');
  };

  const toggleYear = (year) => {
    setExamData({
      ...examData,
      years: examData.years.includes(year) ? examData.years.filter((y) => y !== year) : [...examData.years, year],
    });
  };

  const toggleBranch = (branch) => {
    setExamData({
      ...examData,
      branches: examData.branches.includes(branch)
        ? examData.branches.filter((b) => b !== branch)
        : [...examData.branches, branch],
    });
  };

  const toggleSubject = (subject) => {
    setExamData({
      ...examData,
      subjects: examData.subjects.includes(subject)
        ? examData.subjects.filter((s) => s !== subject)
        : [...examData.subjects, subject],
    });
  };

  const toggleRoom = (roomId) => {
    setSelectedRooms(
      selectedRooms.includes(roomId) ? selectedRooms.filter((r) => r !== roomId) : [...selectedRooms, roomId]
    );
  };

  const getSelectedCapacity = () => {
    return allRooms
      .filter((r) => selectedRooms.includes(r.id))
      .reduce((sum, room) => sum + room.benches * examData.studentsPerBench, 0);
  };

  const groupAllocationsByRoom = () => {
    const grouped = {};
    allocations.forEach((alloc) => {
      if (!grouped[alloc.roomId]) {
        grouped[alloc.roomId] = {
          room: alloc.room,
          block: alloc.block,
          students: [],
        };
      }
      grouped[alloc.roomId].students.push(alloc);
    });
    return grouped;
  };

  // Prepare displayed students for the Restricted Students modal (normalize fields)
  const displayedStudents = (csvUploaded ? restrictedStudents : csvPreview)
    .map(r => ({
      studentId: r.studentId || r.id || r['Roll Number'] || r.rollNumber || null,
      studentName: r.studentName || r['Student Name'] || Object.values(r)[0] || '',
      rollNumber: r.rollNumber || r['Roll Number'] || Object.values(r)[1] || '',
      branch: r.branch || r.Branch || Object.values(r)[2] || '',
      year: r.year || r.Year || Object.values(r)[3] || '',
      attendancePercentage: r.attendancePercentage || r['Attendance %'] || r['Attendance'] || r.attendance || '',
      isAllowed: r.isAllowed || false,
      raw: r,
    }))
    .filter(student => 
      !searchRestricted || 
      String(student.studentName).toLowerCase().includes(searchRestricted.toLowerCase()) ||
      String(student.rollNumber).toLowerCase().includes(searchRestricted.toLowerCase()) ||
      String(student.branch).toLowerCase().includes(searchRestricted.toLowerCase())
    );

  return (
    <div data-testid="create-exam" className="flex h-screen">
      {/* Calendar Sidebar */}
      <CalendarSidebar 
        user={user} 
        onExamClick={handleCalendarExamClick}
        isCollapsed={isCalendarCollapsed}
        onToggle={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
      />
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-bold text-gray-900">Exam Management</h2>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                {isCalendarCollapsed ? 'Show Calendar' : 'Hide Calendar'}
              </Button>
              <Button
                data-testid="create-exam-btn"
                onClick={() => setShowModal(true)}
                className="bg-blue-600 hover:bg-blue-700 rounded-full"
              >
                <Plus className="h-4 w-4 mr-2" /> Create New Exam
              </Button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search exams by title or subjects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="existing">Existing Exams</TabsTrigger>
          <TabsTrigger value="drafts">Draft Exams</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="existing" className="space-y-4">
          <Card className="backdrop-blur-sm bg-white/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Existing Exams ({filteredExams.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredExams.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  {searchTerm || filterStatus !== 'all' ? 'No exams match your search criteria' : 'No exams created yet'}
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredExams.map((exam) => (
                    <div
                      key={exam.id}
                      data-testid={`exam-${exam.id}`}
                      className="p-4 border border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{exam.title}</h3>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><Clock className="h-4 w-4 inline mr-1" />Date: {exam.date} | Time: {exam.startTime} - {exam.endTime}</p>
                            <p>Subjects: {exam.subjects?.join(', ')}</p>
                            <p>Years: {exam.years?.join(', ')} | Branches: {exam.branches?.join(', ')}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant={exam.status === 'scheduled' ? 'default' : 'secondary'}>
                                {exam.status}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                Created: {new Date(exam.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadAllocation(exam.id, 'excel')}
                            className="hover:bg-green-50"
                          >
                            <Download className="h-4 w-4 mr-1" /> Excel
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadAllocation(exam.id, 'csv')}
                            className="hover:bg-green-50"
                          >
                            <Download className="h-4 w-4 mr-1" /> CSV
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditExam(exam.id, false)}
                            className="hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteExam(exam.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drafts" className="space-y-4">
          <Card className="backdrop-blur-sm bg-white/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Draft Exams ({filteredDrafts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredDrafts.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  {searchTerm ? 'No drafts match your search criteria' : 'No draft exams saved'}
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredDrafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="p-4 border border-yellow-200 rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{draft.title}</h3>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>Date: {draft.date} | Time: {draft.startTime} - {draft.endTime}</p>
                            <p>Subjects: {draft.subjects?.join(', ')}</p>
                            <p>Years: {draft.years?.join(', ')} | Branches: {draft.branches?.join(', ')}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                                Draft
                              </Badge>
                              <span className="text-xs text-gray-500">
                                Updated: {new Date(draft.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                            {draft.selectedRooms && draft.selectedRooms.length > 0 && (
                              <p className="text-xs text-blue-600">
                                {draft.selectedRooms.length} rooms selected
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditExam(draft.id, true)}
                            className="hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4 mr-1" /> Continue
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleFinalizeDraft(draft.id)}
                            className="hover:bg-green-50 text-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Finalize
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              if (!confirm('Delete this draft? This action cannot be undone.')) return;
                              try {
                                await axiosInstance.delete(`/draft_exam/${draft.id}`);
                                toast.success('Draft deleted successfully');
                                fetchData();
                              } catch (err) {
                                console.error('Failed to delete draft:', err);
                                toast.error('Failed to delete draft');
                              }
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card className="backdrop-blur-sm bg-white/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Download Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-500 py-8">Download allocation reports for existing exams</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showModal} onOpenChange={(open) => { if (!open) resetForm(); setShowModal(open); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Create Exam Arrangement - Step {currentStep} of 3</span>
              <div className="flex items-center gap-2">
                <Progress value={(currentStep / 3) * 100} className="w-32" />
                <span className="text-sm text-gray-500">{Math.round((currentStep / 3) * 100)}%</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Building2 className="h-5 w-5" />
                Step 1: Select Exam Details
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Exam Title *</Label>
                  <Input
                    data-testid="exam-title-input"
                    id="title"
                    value={examData.title}
                    onChange={(e) => setExamData({ ...examData, title: e.target.value })}
                    placeholder="e.g., B.Tech 3-1 Mid-Term I"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    data-testid="exam-date-input"
                    id="date"
                    type="date"
                    value={examData.date}
                    onChange={(e) => setExamData({ ...examData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    data-testid="exam-start-time-input"
                    id="startTime"
                    type="time"
                    value={examData.startTime}
                    onChange={(e) => setExamData({ ...examData, startTime: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time *</Label>
                  <Input
                    data-testid="exam-end-time-input"
                    id="endTime"
                    type="time"
                    value={examData.endTime}
                    onChange={(e) => setExamData({ ...examData, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Select Years *</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      data-testid={`year-${year}-toggle`}
                      type="button"
                      onClick={() => toggleYear(year)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        examData.years.includes(year) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      Year {year}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Select Branches *</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {branches.map((branch) => (
                    <button
                      key={branch}
                      data-testid={`branch-${branch}-toggle`}
                      type="button"
                      onClick={() => toggleBranch(branch)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        examData.branches.includes(branch) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {branch}
                    </button>
                  ))}
                </div>
              </div>

              {examData.branches.length > 0 && (
                <div>
                  <Label>Select Subjects</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {subjects.map((subject) => (
                      <button
                        key={subject}
                        data-testid={`subject-${subject}-toggle`}
                        type="button"
                        onClick={() => toggleSubject(subject)}
                        className={`px-3 py-1 rounded-lg border-2 text-sm transition-all ${
                          examData.subjects.includes(subject) ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {subject}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CSV Upload Notice */}
              {createdExamId && examData.branches.length === 0 && (
                <div className="p-3 border rounded-lg bg-blue-50 border-blue-200">
                  <p className="text-sm text-blue-800 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Select at least one branch above to enable CSV upload for attendance restrictions.
                  </p>
                </div>
              )}

              {/* CSV Upload for Attendance Restrictions (show after selecting subjects) */}
              {examData.subjects.length > 0 && (
                <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold text-yellow-900">
                      Attendance Restrictions (Optional)
                    </Label>
                    <div className="flex gap-2">
                      {csvUploaded && (
                        <Badge className="bg-green-600 text-white">
                          CSV Uploaded ✓
                        </Badge>
                      )}
                      <Button
                        onClick={downloadTemplate}
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download Template
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-yellow-800 mb-3">
                    Upload a CSV file with students who have &lt;65% attendance. These students will be excluded from automatic seat allocation unless you grant permission.
                  </p>
                  
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-yellow-400'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      Drag & drop CSV file here or
                    </p>
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="flex-1 mb-3"
                      disabled={csvUploaded || loading}
                      key={csvUploaded ? 'disabled' : 'enabled'}
                    />
                    {csvFile && !csvUploaded && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-700">Selected: {csvFile.name}</p>
                      </div>
                    )}
                  </div>
                  
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={handleUploadCsvToBackend}
                      disabled={!csvFile || csvUploaded || loading || !createdExamId}
                      className="bg-yellow-600 hover:bg-yellow-700 flex-1"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                          Uploading...
                        </>
                      ) : (
                        'Upload CSV'
                      )}
                    </Button>

                    {/* Show local preview (editable) even before upload */}
                    <Button
                      onClick={() => {
                        if (csvUploaded) {
                          setShowRestrictedModal(true);
                        } else {
                          // open a quick preview modal by toggling restricted modal but use csvPreview when not uploaded
                          setShowRestrictedModal(true);
                        }
                      }}
                      variant="outline"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View ({csvUploaded ? restrictedStudents.length : csvPreview.length})
                    </Button>
                  </div>
                  
                  {csvPreview.length > 0 && !csvUploaded && (
                    <div className="mt-3 max-h-48 overflow-y-auto border rounded bg-white p-2">
                      <div className="text-sm font-semibold p-1 border-b">Preview ({csvPreview.length} students)</div>
                      <div className="text-xs p-1">
                        {csvPreview.slice(0, 8).map((row, idx) => (
                          <div key={idx} className="flex items-center justify-between text-gray-700 py-1 border-b">
                            <div className="flex-1">{(row.studentName || row['Student Name'] || Object.values(row)[0])}</div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setEditingIndex(idx); setEditingStudent(row); setShowEditStudentModal(true); }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => {
                                if (confirm('Delete this row from preview?')) {
                                  setCsvPreview(prev => prev.filter((_, i) => i !== idx));
                                }
                              }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {csvParseErrors && csvParseErrors.length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      <div className="font-semibold">CSV Validation Issues ({csvParseErrors.length})</div>
                      <ul className="list-disc ml-5 mt-1">
                        {csvParseErrors.slice(0, 10).map((err, i) => (
                          <li key={i}>
                            Row {err.row ?? 'unknown'}: {err.message}
                            {err.row && csvPreview[err.row - 2] && (
                              <Button size="sm" variant="ghost" onClick={() => { setEditingIndex(err.row - 2); setEditingStudent(csvPreview[err.row - 2]); setShowEditStudentModal(true); }}>
                                Edit
                              </Button>
                            )}
                          </li>
                        ))}
                        {csvParseErrors.length > 10 && <li>And {csvParseErrors.length - 10} more...</li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSaveDraft}
                  variant="outline"
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Update Draft' : 'Save as Draft'}
                </Button>
                <Button
                  data-testid="exam-step1-next-btn"
                  onClick={handleCreateExam}
                  disabled={!examData.title || !examData.date || !examData.startTime || !examData.endTime || examData.years.length === 0 || examData.branches.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Next: Allocate Rooms <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Users className="h-5 w-5" />
                Step 2: Allocate Capacity & Rooms
              </div>

              {/* Capacity Overview */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-blue-900">Selected Capacity</span>
                    <span className="text-2xl font-bold text-blue-600">{capacityInfo.allocatedCapacity}</span>
                  </div>
                  <div className="text-sm text-blue-700">seats allocated</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-900">Total Students</span>
                    <span className="text-2xl font-bold text-green-600">{capacityInfo.totalStudents}</span>
                  </div>
                  <div className="text-sm text-green-700">students to allocate</div>
                </div>
              </div>

              {/* Capacity Status */}
              <div className={`p-4 rounded-lg ${capacityInfo.isComplete ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border-2`}>
                <div className="flex items-center gap-2">
                  {capacityInfo.isComplete ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-600" />
                  )}
                  <span className={`font-medium ${capacityInfo.isComplete ? 'text-green-800' : 'text-yellow-800'}`}>
                    {capacityInfo.isComplete ? 'Allocation Complete!' : 'Allocation Incomplete'}
                  </span>
                </div>
                <div className={`text-sm mt-1 ${capacityInfo.isComplete ? 'text-green-700' : 'text-yellow-700'}`}>
                  {capacityInfo.isComplete 
                    ? 'All students can be accommodated with current room selection.'
                    : `Need ${capacityInfo.totalStudents - capacityInfo.allocatedCapacity} more seats.`
                  }
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label>Students per Bench</Label>
                  <RadioGroup
                    value={String(examData.studentsPerBench)}
                    onValueChange={(v) => setExamData({ ...examData, studentsPerBench: parseInt(v) })}
                    className="flex space-x-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem data-testid="students-per-bench-1" value="1" id="r1" />
                      <Label htmlFor="r1">1 Student per Bench</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem data-testid="students-per-bench-2" value="2" id="r2" />
                      <Label htmlFor="r2">2 Students per Bench</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label>Allocation Strategy</Label>
                  <RadioGroup
                    value={examData.allocationType}
                    onValueChange={(v) => setExamData({ ...examData, allocationType: v })}
                    className="flex space-x-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem data-testid="allocation-serial" value="serial" id="serial" />
                      <Label htmlFor="serial">Serial (Order by roll number)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem data-testid="allocation-random" value="random" id="random" />
                      <Label htmlFor="random">Random</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div>
                <Label>Select Rooms & Assign Invigilators</Label>
                <div className="space-y-3 mt-2 max-h-64 overflow-y-auto">
                  {blocks.map((block) => (
                    <div key={block.id} className="border rounded-lg p-3">
                      <p className="font-semibold text-sm text-gray-700 mb-2">{block.name}</p>
                      <div className="grid md:grid-cols-2 gap-2">
                        {allRooms
                          .filter((r) => r.blockId === block.id)
                          .map((room) => (
                            <div
                              key={room.id}
                              className={`p-3 rounded-lg border-2 transition-all ${
                                selectedRooms.includes(room.id)
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-medium">{room.roomNumber}</div>
                                  <div className="text-xs text-gray-600">{room.benches} benches</div>
                                </div>
                                <Button
                                  size="sm"
                                  variant={selectedRooms.includes(room.id) ? "destructive" : "default"}
                                  onClick={() => selectedRooms.includes(room.id) ? handleRemoveRoom(room.id) : handleAllocateRoom(room.id)}
                                  disabled={loading}
                                >
                                  {loading ? 'Processing...' : selectedRooms.includes(room.id) ? 'Remove' : 'Add'}
                                </Button>
                              </div>
                              {selectedRooms.includes(room.id) && (
                                <div className="mt-2">
                                  <Label className="text-xs">Assign Invigilator (Optional)</Label>
                                  <Select
                                    value={selectedInvigilators[room.id] || ''}
                                    onValueChange={(value) => handleAssignInvigilator(room.id, value)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select invigilator" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {invigilators.map((inv) => (
                                        <SelectItem key={inv.id} value={inv.id}>
                                          {inv.profile?.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={() => setCurrentStep(1)} variant="outline" className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Button
                  onClick={handleSaveDraft}
                  variant="outline"
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Update Draft' : 'Save as Draft'}
                </Button>
                <Button
                  data-testid="allocate-seats-btn"
                  onClick={handleAllocateSeats}
                  disabled={loading || selectedRooms.length === 0 || !capacityInfo.isComplete}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {loading ? 'Allocating...' : 'Next: Review & Finalize'} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <CheckCircle className="h-5 w-5" />
                Step 3: Review & Finalize
              </div>

              <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Allocation Complete!</span>
                </div>
                <div className="text-sm text-green-700">
                  {allocations.length} students have been successfully allocated to {selectedRooms.length} rooms.
                </div>
              </div>

              {/* Allocation Summary */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <h4 className="font-semibold text-gray-900">Allocation Summary</h4>
                {Object.entries(groupAllocationsByRoom()).map(([roomId, data]) => (
                  <div key={roomId} data-testid={`room-allocation-${roomId}`} className="p-4 border rounded-lg bg-blue-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-blue-900">{data.block?.name} - Room {data.room?.roomNumber}</h4>
                        <p className="text-sm text-blue-700">{data.students.length} students allocated</p>
                        <div className="text-xs text-blue-600 mt-1">
                          Capacity: {data.room?.benches} benches × {examData.studentsPerBench} students = {data.room?.benches * examData.studentsPerBench} seats
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Select
                          value={selectedInvigilators[roomId] || ''}
                          onValueChange={(value) => handleAssignInvigilator(roomId, value)}
                        >
                          <SelectTrigger data-testid={`invigilator-select-${roomId}`} className="w-48">
                            <SelectValue placeholder="Assign invigilator" />
                          </SelectTrigger>
                          <SelectContent>
                            {invigilators.map((inv) => (
                              <SelectItem key={inv.id} value={inv.id}>
                                {inv.profile?.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadAllocation(createdExamId, 'excel')}
                          className="text-xs"
                        >
                          <Download className="h-3 w-3 mr-1" /> Download List
                        </Button>
                      </div>
                    </div>
                    
                    {/* Student List Preview */}
                    <div className="mt-3 max-h-32 overflow-y-auto">
                      <div className="text-xs text-gray-600 mb-2">Student Preview (showing first 5):</div>
                      <div className="grid grid-cols-1 gap-1">
                        {data.students.slice(0, 5).map((student, index) => (
                          <div key={index} className="text-xs bg-white p-2 rounded border">
                            <span className="font-medium">{student.student?.profile?.name}</span> - 
                            <span className="text-gray-600"> {student.student?.rollNumber}</span> - 
                            <span className="text-blue-600"> Bench {student.benchNumber}</span>
                            {student.seatPosition && <span className="text-green-600"> ({student.seatPosition})</span>}
                          </div>
                        ))}
                        {data.students.length > 5 && (
                          <div className="text-xs text-gray-500 italic">
                            ... and {data.students.length - 5} more students
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Final Actions */}
              <div className="flex space-x-2">
                <Button onClick={() => setCurrentStep(2)} variant="outline" className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to Rooms
                </Button>
                <Button
                  data-testid="finalize-exam-btn"
                  onClick={handleFinalize}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" /> Finalize & Send Notifications
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Edit Student Modal (for local preview or backend restricted student) */}
      <Dialog open={showEditStudentModal} onOpenChange={setShowEditStudentModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Student Details</DialogTitle>
            <DialogDescription>Update student information from the uploaded CSV or backend.</DialogDescription>
          </DialogHeader>

          {editingStudent && (
            <div className="space-y-3 py-2">
              <div>
                <Label>Name</Label>
                <Input value={editingStudent.studentName || editingStudent['Student Name'] || ''} onChange={(e) => setEditingStudent(prev => ({ ...prev, studentName: e.target.value }))} />
              </div>
              <div>
                <Label>Roll Number</Label>
                <Input value={editingStudent.rollNumber || ''} onChange={(e) => setEditingStudent(prev => ({ ...prev, rollNumber: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Branch</Label>
                  <Input value={editingStudent.branch || ''} onChange={(e) => setEditingStudent(prev => ({ ...prev, branch: e.target.value }))} />
                </div>
                <div>
                  <Label>Year</Label>
                  <Input value={editingStudent.year || ''} onChange={(e) => setEditingStudent(prev => ({ ...prev, year: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Attendance %</Label>
                <Input value={editingStudent.attendancePercentage || ''} onChange={(e) => setEditingStudent(prev => ({ ...prev, attendancePercentage: e.target.value }))} />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowEditStudentModal(false); setEditingStudent(null); setEditingIndex(null); }}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  // Determine local vs backend save
                  if (editingIndex != null) {
                    handleSaveLocalEdit(editingStudent);
                  } else {
                    handleSaveRestrictedEdit(editingStudent);
                  }
                }}>
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Restricted Students Modal */}
      <Dialog open={showRestrictedModal} onOpenChange={setShowRestrictedModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Restricted Students ({restrictedStudents.filter(s => !s.isAllowed).length} without permission)</span>
              <Button
                onClick={handleGrantAllPermissions}
                variant="default"
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                disabled={restrictedStudents.every(s => s.isAllowed)}
              >
                Grant All Permissions
              </Button>
            </DialogTitle>
            <DialogDescription>
              Students with &lt;65% attendance. Grant permission to allow them to take the exam.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, roll number, or branch..."
                  value={searchRestricted}
                  onChange={(e) => setSearchRestricted(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Roll Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendance %
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayedStudents.map((student, idx) => (
                    <tr
                      key={student.studentId || idx}
                      className={`transition-colors ${student.isAllowed ? 'bg-green-50' : 'bg-red-50 hover:bg-red-100'}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{student.studentName}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{student.rollNumber}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{student.branch}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{student.year}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{student.attendancePercentage}%</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className={student.isAllowed ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}>{student.isAllowed ? 'Allowed' : 'Restricted'}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => handleGrantPermission(student.studentId)} disabled={student.isAllowed || !student.studentId} className={student.isAllowed ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}>
                            {student.isAllowed ? (<><CheckCircle className="h-4 w-4 mr-1" />Granted</>) : ('Grant Permission')}
                          </Button>

                          <Button size="sm" variant="outline" onClick={() => {
                            if (csvUploaded) handleEditRestrictedStudent(student.raw);
                            else { setEditingIndex(student.raw && csvPreview.indexOf(student.raw) >= 0 ? csvPreview.indexOf(student.raw) : null); setEditingStudent(student.raw); setShowEditStudentModal(true); }
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button size="sm" variant="destructive" onClick={() => {
                            if (csvUploaded) handleDeleteRestrictedStudent(student.studentId);
                            else {
                              if (confirm('Delete this row from preview?')) {
                                setCsvPreview(prev => prev.filter(p => p !== student.raw));
                              }
                            }
                          }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {restrictedStudents.filter(student => 
              !searchRestricted || 
              student.studentName?.toLowerCase().includes(searchRestricted.toLowerCase()) ||
              student.rollNumber?.toLowerCase().includes(searchRestricted.toLowerCase()) ||
              student.branch?.toLowerCase().includes(searchRestricted.toLowerCase())
            ).length === 0 && (
              <div className="text-center text-gray-500 py-8">
                {restrictedStudents.length === 0 
                  ? 'No restricted students found' 
                  : 'No students match your search'}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
};

export default CreateExam;
