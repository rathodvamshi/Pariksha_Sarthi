import React, { useEffect, useState } from 'react';
import { Plus, CheckCircle, Calendar as CalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { axiosInstance } from '@/App';
import { toast } from 'sonner';

const CreateExam = ({ user }) => {
  const [exams, setExams] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [invigilators, setInvigilators] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [examData, setExamData] = useState({
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    subjects: '',
    years: [],
    branches: [],
    allocationType: 'random',
    studentsPerBench: 1,
  });
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createdExamId, setCreatedExamId] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [selectedInvigilators, setSelectedInvigilators] = useState({});

  const branches = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'];
  const years = [1, 2, 3, 4];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [examsRes, blocksRes, invigilatorsRes] = await Promise.all([
        axiosInstance.get(`/exams/${user.collegeId}`),
        axiosInstance.get(`/blocks/${user.collegeId}`),
        axiosInstance.get(`/staff/${user.collegeId}?role=invigilator`),
      ]);
      setExams(examsRes.data);
      setBlocks(blocksRes.data);
      setInvigilators(invigilatorsRes.data);

      const roomsPromises = blocksRes.data.map((block) => axiosInstance.get(`/rooms/${block.id}`));
      const roomsResults = await Promise.all(roomsPromises);
      const rooms = roomsResults.flatMap((res) => res.data);
      setAllRooms(rooms);
    } catch (error) {
      toast.error('Failed to load data');
    }
  };

  const handleCreateExam = async () => {
    try {
      const response = await axiosInstance.post('/exams', {
        collegeId: user.collegeId,
        ...examData,
        subjects: examData.subjects.split(',').map((s) => s.trim()),
      });
      toast.success('Exam created successfully');
      setCreatedExamId(response.data.id);
      setCurrentStep(2);
    } catch (error) {
      toast.error('Failed to create exam');
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

  const handleFinalize = () => {
    toast.success('Exam arrangement finalized successfully!');
    setShowModal(false);
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setCurrentStep(1);
    setExamData({
      title: '',
      date: '',
      startTime: '',
      endTime: '',
      subjects: '',
      years: [],
      branches: [],
      allocationType: 'random',
      studentsPerBench: 1,
    });
    setSelectedRooms([]);
    setCreatedExamId(null);
    setAllocations([]);
    setSelectedInvigilators({});
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

  return (
    <div  data-testid="create-exam\"  className="space-y-6>
      <div  className="flex justify-between items-center>
        <h2  className="text-3xl font-bold text-gray-900>Manage Exams</h2>
        <Button
           data-testid="create-exam-btn\"
          onClick={() => setShowModal(true)}
           className="bg-blue-600 hover:bg-blue-700 rounded-full\"
        >
          <Plus  className="h-4 w-4 mr-2\" /> Create Exam
        </Button>
      </div>

      <Card  className="backdrop-blur-sm bg-white/70>
        <CardHeader>
          <CardTitle>Existing Exams</CardTitle>
        </CardHeader>
        <CardContent>
          {exams.length === 0 ? (
            <p  className="text-center text-gray-500 py-8>No exams created yet</p>
          ) : (
            <div  className="space-y-4>
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  data-testid={`exam-${exam.id}`}
                   className="p-4 border border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50\"
                >
                  <h3  className="text-lg font-semibold text-gray-900 mb-2>{exam.title}</h3>
                  <div  className="text-sm text-gray-600 space-y-1>
                    <p>Date: {exam.date} | Time: {exam.startTime} - {exam.endTime}</p>
                    <p>Subjects: {exam.subjects?.join(', ')}</p>
                    <p>Years: {exam.years?.join(', ')} | Branches: {exam.branches?.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={(open) => { if (!open) resetForm(); setShowModal(open); }}>
        <DialogContent  className="max-w-4xl max-h-[90vh] overflow-y-auto>
          <DialogHeader>
            <DialogTitle>Create Exam Arrangement - Step {currentStep} of 3</DialogTitle>
          </DialogHeader>

          {currentStep === 1 && (
            <div  className="space-y-4>
              <h3  className="text-lg font-semibold>Exam Details</h3>
              <div  className="grid md:grid-cols-2 gap-4>
                <div>
                  <Label htmlFor=\"title>Exam Title</Label>
                  <Input
                     data-testid="exam-title-input\"
                    id=\"title\"
                    value={examData.title}
                    onChange={(e) => setExamData({ ...examData, title: e.target.value })}
                    placeholder=\"e.g., B.Tech 3-1 Mid-Term I\"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor=\"date>Date</Label>
                  <Input
                     data-testid="exam-date-input\"
                    id=\"date\"
                    type=\"date\"
                    value={examData.date}
                    onChange={(e) => setExamData({ ...examData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor=\"startTime>Start Time</Label>
                  <Input
                     data-testid="exam-start-time-input\"
                    id=\"startTime\"
                    type=\"time\"
                    value={examData.startTime}
                    onChange={(e) => setExamData({ ...examData, startTime: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor=\"endTime>End Time</Label>
                  <Input
                     data-testid="exam-end-time-input\"
                    id=\"endTime\"
                    type=\"time\"
                    value={examData.endTime}
                    onChange={(e) => setExamData({ ...examData, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor=\"subjects>Subjects (comma-separated)</Label>
                <Input
                   data-testid="exam-subjects-input\"
                  id=\"subjects\"
                  value={examData.subjects}
                  onChange={(e) => setExamData({ ...examData, subjects: e.target.value })}
                  placeholder=\"e.g., DBMS, Operating Systems\"
                  required
                />
              </div>
              <div>
                <Label>Select Years</Label>
                <div  className="flex flex-wrap gap-2 mt-2>
                  {years.map((year) => (
                    <button
                      key={year}
                      data-testid={`year-${year}-toggle`}
                      type=\"button\"
                      onClick={() => toggleYear(year)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        examData.years.includes(year) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      Year {year}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Select Branches</Label>
                <div  className="flex flex-wrap gap-2 mt-2>
                  {branches.map((branch) => (
                    <button
                      key={branch}
                      data-testid={`branch-${branch}-toggle`}
                      type=\"button\"
                      onClick={() => toggleBranch(branch)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        examData.branches.includes(branch) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      {branch}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                 data-testid="exam-step1-next-btn\"
                onClick={handleCreateExam}
                disabled={!examData.title || !examData.date || examData.years.length === 0 || examData.branches.length === 0}
                 className="w-full bg-blue-600 hover:bg-blue-700\"
              >
                Next: Select Rooms
              </Button>
            </div>
          )}

          {currentStep === 2 && (
            <div  className="space-y-4>
              <h3  className="text-lg font-semibold>Select Rooms & Allocation Settings</h3>
              <div  className="p-4 bg-blue-50 rounded-lg>
                <p  className="text-sm font-medium>Selected Capacity: {getSelectedCapacity()} seats</p>
              </div>
              <div>
                <Label>Students per Bench</Label>
                <RadioGroup
                  value={String(examData.studentsPerBench)}
                  onValueChange={(v) => setExamData({ ...examData, studentsPerBench: parseInt(v) })}
                   className="flex space-x-4 mt-2\"
                >
                  <div  className="flex items-center space-x-2>
                    <RadioGroupItem  data-testid="students-per-bench-1\" value=\"1\" id=\"r1\" />
                    <Label htmlFor=\"r1>1 Student per Bench</Label>
                  </div>
                  <div  className="flex items-center space-x-2>
                    <RadioGroupItem  data-testid="students-per-bench-2\" value=\"2\" id=\"r2\" />
                    <Label htmlFor=\"r2>2 Students per Bench</Label>
                  </div>
                </RadioGroup>
              </div>
              <div>
                <Label>Allocation Strategy</Label>
                <RadioGroup
                  value={examData.allocationType}
                  onValueChange={(v) => setExamData({ ...examData, allocationType: v })}
                   className="flex space-x-4 mt-2\"
                >
                  <div  className="flex items-center space-x-2>
                    <RadioGroupItem  data-testid="allocation-random\" value=\"random\" id=\"random\" />
                    <Label htmlFor=\"random>Random</Label>
                  </div>
                  <div  className="flex items-center space-x-2>
                    <RadioGroupItem  data-testid="allocation-jumbled\" value=\"jumbled\" id=\"jumbled\" />
                    <Label htmlFor=\"jumbled>Jumbled (Mix branches)</Label>
                  </div>
                </RadioGroup>
              </div>
              <div>
                <Label>Select Rooms</Label>
                <div  className="space-y-3 mt-2 max-h-64 overflow-y-auto>
                  {blocks.map((block) => (
                    <div key={block.id}>
                      <p  className="font-semibold text-sm text-gray-700 mb-2>{block.name}</p>
                      <div  className="grid md:grid-cols-3 gap-2 ml-4>
                        {allRooms
                          .filter((r) => r.blockId === block.id)
                          .map((room) => (
                            <button
                              key={room.id}
                              data-testid={`room-select-${room.id}`}
                              type=\"button\"
                              onClick={() => toggleRoom(room.id)}
                              className={`p-3 rounded-lg border-2 text-sm transition-all ${
                                selectedRooms.includes(room.id)
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div  className="font-medium>{room.roomNumber}</div>
                              <div  className="text-xs text-gray-600>{room.benches} benches</div>
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div  className="flex space-x-2>
                <Button onClick={() => setCurrentStep(1)} variant=\"outline\"  className="flex-1>
                  Back
                </Button>
                <Button
                   data-testid="allocate-seats-btn\"
                  onClick={handleAllocateSeats}
                  disabled={loading || selectedRooms.length === 0}
                   className="flex-1 bg-green-600 hover:bg-green-700\"
                >
                  {loading ? 'Allocating...' : 'Allocate Seats'}
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div  className="space-y-4>
              <h3  className="text-lg font-semibold>Review & Assign Invigilators</h3>
              <div  className="p-4 bg-green-50 rounded-lg flex items-center>
                <CheckCircle  className="h-5 w-5 text-green-600 mr-2\" />
                <span  className="font-medium>{allocations.length} students allocated successfully!</span>
              </div>
              <div  className="space-y-4 max-h-96 overflow-y-auto>
                {Object.entries(groupAllocationsByRoom()).map(([roomId, data]) => (
                  <div key={roomId} data-testid={`room-allocation-${roomId}`}  className="p-4 border rounded-lg bg-blue-50>
                    <div  className="flex justify-between items-start mb-3>
                      <div>
                        <h4  className="font-semibold>{data.block?.name} - Room {data.room?.roomNumber}</h4>
                        <p  className="text-sm text-gray-600>{data.students.length} students allocated</p>
                      </div>
                      <Select
                        value={selectedInvigilators[roomId] || ''}
                        onValueChange={(value) => handleAssignInvigilator(roomId, value)}
                      >
                        <SelectTrigger data-testid={`invigilator-select-${roomId}`}  className="w-48>
                          <SelectValue placeholder=\"Assign invigilator\" />
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
                  </div>
                ))}
              </div>
              <Button
                 data-testid="finalize-exam-btn\"
                onClick={handleFinalize}
                 className="w-full bg-blue-600 hover:bg-blue-700\"
              >
                Finalize & Send Notifications
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateExam;
