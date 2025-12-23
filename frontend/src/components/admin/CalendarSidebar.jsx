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
    const dateStr = formatDate(date);
    return events.filter(event => event.date === dateStr);
  };

  const getEventsForWeek = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return events.filter(event => {
      const [y, m, d] = (event.date || '').split('-').map(Number);
      if (!y || !m || !d) return false;
      const eventDate = new Date(y, m - 1, d);
      eventDate.setHours(12, 0, 0, 0);
      return eventDate >= startOfWeek && eventDate <= endOfWeek;
    });
  };

  const getWeekRangeLabel = () => {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const monthStart = start.toLocaleString('en-US', { month: 'short' });
    const monthEnd = end.toLocaleString('en-US', { month: 'short' });
    const year = start.getFullYear();
    return sameMonth
      ? `${monthStart} ${start.getDate()}–${end.getDate()}, ${year}`
      : `${monthStart} ${start.getDate()} – ${monthEnd} ${end.getDate()}, ${year}`;
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

  const isScheduledExam = (ev) => (ev?.status === 'scheduled') && ((ev?.type || 'exam') === 'exam');

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
    const dateStr = formatDate(date);
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
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const isToday = (date) => {
    const today = new Date();
    return date && date.toDateString() === today.toDateString();
  };

  const isPastDate = (date) => {
    const today = new Date();
    const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return d1 < d0;
  };

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate);
    return (
      <div className="mb-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-[10px] md:text-xs font-medium text-gray-500 text-center p-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            if (!date) {
              return <div key={index} className="aspect-square" />;
            }

            const isCurrentDay = isToday(date);
            const dayEvents = getEventsForDate(date);
            const hasEvents = Array.isArray(dayEvents) && dayEvents.length > 0;

            return (
              <div key={index} className="aspect-square flex items-center justify-center">
                <button
                  type="button"
                  aria-label={date.toDateString()}
                  className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[11px] md:text-xs font-medium transition-colors border
                    ${isPastDate(date)
                      ? 'bg-gray-100 text-gray-400 border-gray-200 pointer-events-none'
                      : hasEvents
                        ? 'bg-green-500 text-white border-green-600'
                        : isCurrentDay
                          ? 'bg-blue-600 text-white border-blue-700'
                          : 'bg-white text-gray-700 border-black/20 hover:bg-blue-50'}`}
                >
                  {date.getDate()}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const days = getWeekDays();
    // Only show days that have at least one exam
    const examDays = days.filter((day) => {
      const dayEvents = getEventsForDate(day);
      return dayEvents.some(ev => (ev?.type || 'exam') === 'exam');
    });
    return (
      <div className="space-y-2">
        {/* Header row with weekdays + dates */}
        <div
          className="grid gap-2 mb-2 items-center"
          style={{ gridTemplateColumns: `repeat(${Math.max(examDays.length, 1)}, minmax(0, 1fr))` }}
        >
          {examDays.map((day, index) => {
            const today = isToday(day);
            const past = isPastDate(day);
            const dayEvents = getEventsForDate(day);
            const hasExams = dayEvents.some(ev => (ev?.type || 'exam') === 'exam');
            return (
              <div key={index} className="text-center">
                <div className="text-[11px] md:text-xs font-medium text-gray-600 uppercase tracking-wide">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="mt-1 flex items-center justify-center">
                  <span
                    className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[11px] md:text-xs border
                      ${past
                        ? 'bg-gray-100 text-gray-400 border-gray-200'
                        : today && hasExams
                          ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-green-400'
                          : hasExams
                            ? 'bg-green-500 text-white border-green-600'
                            : today
                              ? 'bg-blue-600 text-white border-blue-700'
                              : 'bg-white text-gray-800 border-gray-200'}`}
                  >
                    {day.getDate()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Columns for each day */}
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(examDays.length, 1)}, minmax(0, 1fr))` }}
        >
          {examDays.map((day, index) => {
            const dayEvents = getEventsForDate(day).filter(ev => (ev?.type || 'exam') === 'exam');
            const isCurrentDay = isToday(day);
            const past = isPastDate(day);

            return (
              <div
                key={index}
                className={`rounded-lg p-2 border ${isCurrentDay ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'} ${past ? 'opacity-60' : ''}`}
              >
                <div className="max-h-[320px] md:max-h-[360px] overflow-y-auto no-scrollbar space-y-2 pr-1">
                  {dayEvents.map((event) => (
                    <TooltipProvider key={event.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            aria-label={`${event.title} at ${event.time}`}
                            className={`rounded-md p-2 pl-3 transition-colors text-xs border ${past ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}
                              ${isScheduledExam(event)
                                ? `${past ? '' : 'hover:bg-blue-500/30'} bg-blue-500/20 border-blue-200 backdrop-blur-md`
                                : `bg-white border-gray-200 ${past ? '' : 'hover:bg-blue-50'}`}
                              ${event.status === 'draft' ? 'border-l-2 border-l-yellow-400' : event.status === 'completed' ? 'border-l-2 border-l-gray-400' : (event.type === 'exam' ? 'border-l-2 border-l-blue-500' : 'border-l-2 border-l-green-500')}`}
                            onClick={past ? undefined : () => handleEventClick(event)}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="font-semibold truncate text-gray-900">{event.title}</p>
                              <span className={`shrink-0 ${getStatusColor(event.status, event.type)} text-white rounded-full px-2 py-0.5 text-[10px]`}
                              >
                                {event.date}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                              {event.room && <span>{event.room}</span>}
                              <span className="inline-block rounded px-1.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-200">{getStatusText(event.status)}</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">{event.title}</p>
                          <p className="text-xs">{event.date}</p>
                          {event.room && <p className="text-xs">Room: {event.room}</p>}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
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
      <div className="space-y-1 max-h-[500px] overflow-y-auto no-scrollbar">
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
      <div className="space-y-2 max-h-[500px] overflow-y-auto no-scrollbar">
        {filteredEvents.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No events found</div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${isScheduledExam(event) ? 'bg-blue-500/20 border-blue-200 backdrop-blur-md hover:bg-blue-500/30' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
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
    <div className="w-64 sm:w-72 md:w-80 lg:w-96 bg-white/70 backdrop-blur-md border-r border-blue-100 p-3 md:p-4 h-[68vh] md:h-[72vh] lg:h-[76vh] overflow-hidden flex flex-col rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2">
          <CalIcon className="h-4 w-4 md:h-5 md:w-5" />
          Calendar
        </h3>
        <Button onClick={onToggle} variant="ghost" size="sm" className="h-8 px-2 text-xs">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* View Mode Selector */}
      <Tabs value={viewMode} onValueChange={setViewMode} className="w-full mb-3">
        <TabsList className="grid grid-cols-4 w-full h-8">
          <TabsTrigger value="month" className="text-xs h-7">
            <Calendar className="h-3 w-3" />
          </TabsTrigger>
          <TabsTrigger value="week" className="text-xs h-7">
            <Grid className="h-3 w-3" />
          </TabsTrigger>
          <TabsTrigger value="day" className="text-xs h-7">
            <Clock className="h-3 w-3" />
          </TabsTrigger>
          <TabsTrigger value="list" className="text-xs h-7">
            <List className="h-3 w-3" />
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pr-1">
      {/* Search and Filters */}
      <div className="space-y-2 mb-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
          {searchTerm && (
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
          <SelectTrigger className="h-8 text-xs">
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
        <div className="flex items-center justify-between mb-3">
          <Button onClick={() => navigateMonth(-1)} variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h4 className={`font-semibold text-gray-900 ${viewMode === 'day' ? 'text-base md:text-lg' : 'text-xs md:text-sm'}`}>
            {viewMode === 'month' 
              ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : viewMode === 'week'
              ? getWeekRangeLabel()
              : currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h4>
          <Button onClick={() => navigateMonth(1)} variant="ghost" size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Calendar Views */}
      <div className="mb-3">
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'list' && renderListView()}
      </div>
      </div>

      {/* Upcoming Events Summary removed as requested */}

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
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Exam
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
