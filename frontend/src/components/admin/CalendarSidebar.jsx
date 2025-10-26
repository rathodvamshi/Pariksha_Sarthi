import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Users, Eye, Edit, Grid, List, Calendar as CalIcon, Filter, Search, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { axiosInstance } from '@/App';
import { toast } from 'sonner';

const CalendarSidebar = ({ user, onExamClick, isCollapsed, onToggle }) => {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day', 'list'
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState('all'); // 'all', 'exam', 'draft', 'completed'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCalendarEvents();
    
    // Refresh calendar every 30 seconds to get updates
    const interval = setInterval(fetchCalendarEvents, 30000);
    
    // Allow external components to request calendar refresh (e.g., after deleting an exam)
    const refreshHandler = () => fetchCalendarEvents();
    window.addEventListener('calendar:refresh', refreshHandler);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('calendar:refresh', refreshHandler);
    };
  }, [user.collegeId]);

  const fetchCalendarEvents = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/calendar_events/${user.collegeId}`);
      setEvents(response.data);
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  };

  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => event.date === dateStr);
  };

  const getEventsForWeek = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= startOfWeek && eventDate <= endOfWeek;
    });
  };

  const getFilteredEvents = () => {
    let filtered = events;

    // Filter by type/status
    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(event => {
        if (eventTypeFilter === 'exam') return event.type === 'exam' && event.status === 'scheduled';
        if (eventTypeFilter === 'draft') return event.status === 'draft';
        if (eventTypeFilter === 'completed') return event.status === 'completed';
        return true;
      });
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const getStatusColor = (status, type) => {
    if (status === 'draft') return 'bg-yellow-500';
    if (status === 'completed') return 'bg-gray-500';
    if (type === 'exam') return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'scheduled': return 'Scheduled';
      case 'draft': return 'Draft';
      case 'completed': return 'Completed';
      default: return 'Event';
    }
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  };

  const getEventsForTimeSlot = (date, time) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => {
      if (event.date !== dateStr) return false;
      const eventTime = event.time.substring(0, 5); // Get HH:MM
      return eventTime === time;
    });
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const isToday = (date) => {
    const today = new Date();
    return date && date.toDateString() === today.toDateString();
  };

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate);
    return (
      <div className="mb-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-xs font-medium text-gray-500 text-center p-1">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            if (!date) {
              return <div key={index} className="h-16" />;
            }
            
            const dayEvents = getEventsForDate(date);
            const isCurrentDay = isToday(date);
            
            return (
              <div
                key={index}
                className={`h-16 border rounded-md p-1 cursor-pointer hover:bg-blue-50 transition-colors ${
                  isCurrentDay ? 'bg-blue-100 border-blue-300' : 'border-gray-200'
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${isCurrentDay ? 'text-blue-700' : ''}`}>
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <TooltipProvider key={event.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`text-xs p-0.5 rounded truncate ${getStatusColor(event.status, event.type)} text-white cursor-pointer`}
                            onClick={() => handleEventClick(event)}
                          >
                            {event.title}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">{event.title}</p>
                          <p className="text-xs">{event.time}</p>
                          <p className="text-xs">{event.status}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-500 font-medium">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const days = getWeekDays();
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="text-xs font-medium text-gray-500"></div>
          {days.map((day, index) => (
            <div key={index} className="text-xs font-medium text-gray-500 text-center">
              {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-8 gap-1">
          {days.map((day, index) => {
            const dayEvents = getEventsForDate(day);
            const isCurrentDay = isToday(day);
            
            return (
              <div key={index} className="min-h-[400px] border rounded-md p-2">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`mb-2 p-2 rounded cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(event.status, event.type)} text-white text-xs`}
                    onClick={() => handleEventClick(event)}
                  >
                    <p className="font-semibold truncate">{event.title}</p>
                    <p className="text-xs opacity-90">{event.time}</p>
                    {event.room && <p className="text-xs opacity-75">{event.room}</p>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const timeSlots = getTimeSlots();
    return (
      <div className="space-y-1 max-h-[500px] overflow-y-auto">
        {timeSlots.map((time) => {
          const slotEvents = getEventsForTimeSlot(currentDate, time);
          return (
            <div key={time} className="flex gap-2 border-b border-gray-200 pb-1">
              <div className="w-16 text-xs text-gray-500 font-medium">{time}</div>
              <div className="flex-1 space-y-1">
                {slotEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`p-2 rounded cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(event.status, event.type)} text-white text-xs`}
                    onClick={() => handleEventClick(event)}
                  >
                    <p className="font-semibold">{event.title}</p>
                    {event.room && <p className="text-xs opacity-75">{event.room}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderListView = () => {
    const filteredEvents = getFilteredEvents();
    return (
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No events found</div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => handleEventClick(event)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">{event.title}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                    <Clock className="h-3 w-3" />
                    <span>{event.date}</span>
                    <span>{event.time}</span>
                  </div>
                  {event.room && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <MapPin className="h-3 w-3" />
                      <span>{event.room}</span>
                    </div>
                  )}
                </div>
                <Badge variant="outline" className={`text-xs ${getStatusColor(event.status, event.type).replace('bg-', 'bg-')}`}>
                  {getStatusText(event.status)}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <div className="w-16 bg-white/70 backdrop-blur-md border-r border-blue-100 p-2">
        <Button
          onClick={onToggle}
          variant="ghost"
          size="sm"
          className="w-full mb-4"
        >
          <Calendar className="h-4 w-4" />
        </Button>
        <div className="space-y-2">
          {getFilteredEvents().slice(0, 5).map((event) => (
            <TooltipProvider key={event.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`w-3 h-3 rounded-full ${getStatusColor(event.status, event.type)} cursor-pointer hover:scale-110 transition-transform`}
                    onClick={() => handleEventClick(event)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-semibold">{event.title}</p>
                  <p className="text-xs">{event.date} at {event.time}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[400px] bg-white/70 backdrop-blur-md border-r border-blue-100 p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <CalIcon className="h-5 w-5" />
          Calendar
        </h3>
        <Button onClick={onToggle} variant="ghost" size="sm">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* View Mode Selector */}
      <Tabs value={viewMode} onValueChange={setViewMode} className="w-full mb-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="month" className="text-xs">
            <Calendar className="h-3 w-3" />
          </TabsTrigger>
          <TabsTrigger value="week" className="text-xs">
            <Grid className="h-3 w-3" />
          </TabsTrigger>
          <TabsTrigger value="day" className="text-xs">
            <Clock className="h-3 w-3" />
          </TabsTrigger>
          <TabsTrigger value="list" className="text-xs">
            <List className="h-3 w-3" />
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search and Filters */}
      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9 text-sm"
          />
          {searchTerm && (
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="exam">Scheduled Exams</SelectItem>
            <SelectItem value="draft">Draft Exams</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Navigation */}
      {viewMode !== 'list' && (
        <div className="flex items-center justify-between mb-4">
          <Button onClick={() => navigateMonth(-1)} variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h4 className="font-medium text-gray-900 text-sm">
            {viewMode === 'month' 
              ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : viewMode === 'week'
              ? 'Week View'
              : currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
            }
          </h4>
          <Button onClick={() => navigateMonth(1)} variant="ghost" size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Calendar Views */}
      <div className="mb-4">
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'list' && renderListView()}
      </div>

      {/* Upcoming Events Summary (only for month/week/day views) */}
      {viewMode !== 'list' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Upcoming Events</span>
              <Badge variant="secondary">{getFilteredEvents().length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="text-center text-gray-500 py-4">Loading events...</div>
            ) : getFilteredEvents().length === 0 ? (
              <div className="text-center text-gray-500 py-4">No events scheduled</div>
            ) : (
              getFilteredEvents()
                .filter(event => new Date(event.date) >= new Date())
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(0, 5)
                .map(event => (
                  <div
                    key={event.id}
                    className="p-2 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {event.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                          <Clock className="h-3 w-3" />
                          <span>{event.date}</span>
                          <span>{event.time}</span>
                        </div>
                        {event.room && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <MapPin className="h-3 w-3" />
                            <span>{event.room}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getStatusColor(event.status, event.type).replace('bg-', 'text-').replace('-500', '-600')}`}
                        >
                          {getStatusText(event.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Event Details Modal */}
      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Event Details
            </DialogTitle>
            <DialogDescription>
              View and manage exam event information
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-lg text-gray-900 mb-2">{selectedEvent.title}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">Date: {selectedEvent.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">Time: {selectedEvent.time}</span>
                  </div>
                  {selectedEvent.room && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-600">Room: {selectedEvent.room}</span>
                    </div>
                  )}
                  {selectedEvent.branch && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-600">Branch: {selectedEvent.branch}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={getStatusColor(selectedEvent.status, selectedEvent.type)}
                    >
                      {getStatusText(selectedEvent.status)}
                    </Badge>
                    <Badge variant="secondary">{selectedEvent.type}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => {
                    if (selectedEvent.examId) {
                      onExamClick(selectedEvent.examId);
                    }
                    setShowEventModal(false);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Exam
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowEventModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarSidebar;
