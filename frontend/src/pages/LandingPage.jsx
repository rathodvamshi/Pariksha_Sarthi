import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Users, Building2, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { axiosInstance } from '@/App';
import { toast } from 'sonner';

const LandingPage = ({ setUser }) => {
  const [showAuth, setShowAuth] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    collegeId: '',
    email: '',
    rollNumber: '',
    password: '',
  });
  const [signupData, setSignupData] = useState({
    collegeName: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchColleges();
  }, []);

  const fetchColleges = async () => {
    try {
      const response = await axiosInstance.get('/colleges');
      setColleges(response.data);
    } catch (error) {
      console.error('Error fetching colleges:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axiosInstance.post('/auth/login', {
        ...formData,
        role: selectedRole,
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setUser(response.data.user);
      toast.success('Login successful!');

      if (selectedRole === 'student') {
        navigate('/student');
      } else if (selectedRole === 'admin') {
        navigate('/admin');
      } else if (selectedRole === 'invigilator') {
        navigate('/invigilator');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (signupData.password !== signupData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (signupData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await axiosInstance.post('/auth/signup', {
        collegeName: signupData.collegeName,
        email: signupData.email,
        password: signupData.password,
        name: signupData.name,
      });

      toast.success('Signup successful! Please login with your credentials.');
      
      // Switch to login mode and pre-fill email
      setAuthMode('login');
      setFormData({
        ...formData,
        email: signupData.email,
        collegeId: response.data.collegeId,
      });
      
      // Refresh colleges list
      await fetchColleges();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Building2, title: 'Smart Infrastructure', desc: 'Manage blocks, rooms, and seating capacity efficiently' },
    { icon: Users, title: 'Role-Based Access', desc: 'Separate portals for admins, invigilators, and students' },
    { icon: FileText, title: 'Automated Allocation', desc: 'AI-powered seating with random or jumbled arrangements' },
    { icon: CheckCircle2, title: 'Real-time Updates', desc: 'Instant notifications and attendance tracking' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100">
      <motion.nav 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50"
      >
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <GraduationCap className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Pariksha Sarthi</h1>
          </div>
          <Button data-testid="get-started-btn" onClick={() => setShowAuth(true)} className="bg-blue-600 hover:bg-blue-700 rounded-full px-6">
            Get Started <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.nav>

      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="text-center max-w-4xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6"
          >
            Intelligent Exam Seating Arrangement System
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto"
          >
            Streamline your examination process with automated seating allocation, real-time tracking, and comprehensive management tools.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button 
              data-testid="hero-get-started-btn"
              onClick={() => setShowAuth(true)} 
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 rounded-full px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
            >
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-20 grid md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-blue-100 hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-600">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <Dialog open={showAuth} onOpenChange={setShowAuth}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your Role</DialogTitle>
          </DialogHeader>

          {!selectedRole ? (
            <div className="grid grid-cols-3 gap-4 py-4">
              <button
                data-testid="select-admin-role-btn"
                onClick={() => setSelectedRole('admin')}
                className="flex flex-col items-center p-6 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <Users className="h-10 w-10 text-blue-600 mb-2" />
                <span className="font-semibold text-gray-900">Admin</span>
              </button>
              <button
                data-testid="select-invigilator-role-btn"
                onClick={() => setSelectedRole('invigilator')}
                className="flex flex-col items-center p-6 border-2 border-green-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"
              >
                <FileText className="h-10 w-10 text-green-600 mb-2" />
                <span className="font-semibold text-gray-900">Invigilator</span>
              </button>
              <button
                data-testid="select-student-role-btn"
                onClick={() => setSelectedRole('student')}
                className="flex flex-col items-center p-6 border-2 border-purple-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all"
              >
                <GraduationCap className="h-10 w-10 text-purple-600 mb-2" />
                <span className="font-semibold text-gray-900">Student</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="college">Select College</Label>
                <Select
                  value={formData.collegeId}
                  onValueChange={(value) => setFormData({ ...formData, collegeId: value })}
                >
                  <SelectTrigger data-testid="college-select">
                    <SelectValue placeholder="Choose college" />
                  </SelectTrigger>
                  <SelectContent>
                    {colleges.map((college) => (
                      <SelectItem key={college.id} value={college.id}>
                        {college.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRole === 'student' ? (
                <div>
                  <Label htmlFor="rollNumber">Roll Number</Label>
                  <Input
                    data-testid="roll-number-input"
                    id="rollNumber"
                    type="text"
                    value={formData.rollNumber}
                    onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                    placeholder="Enter your roll number"
                    required
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    data-testid="email-input"
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter your email"
                    required
                  />
                </div>
              )}

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  data-testid="password-input"
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedRole(null)}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  data-testid="login-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingPage;