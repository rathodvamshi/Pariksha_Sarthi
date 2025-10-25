import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Building, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { axiosInstance } from '@/App';
import { toast } from 'sonner';

const ManageInfrastructure = ({ user }) => {
  const [blocks, setBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [blockName, setBlockName] = useState('');
  const [roomData, setRoomData] = useState({ roomNumber: '', capacity: 40, benches: 20 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlocks();
  }, []);

  const fetchBlocks = async () => {
    try {
      const response = await axiosInstance.get(`/blocks/${user.collegeId}`);
      setBlocks(response.data);
    } catch (error) {
      toast.error('Failed to load blocks');
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async (blockId) => {
    try {
      const response = await axiosInstance.get(`/rooms/${blockId}`);
      setRooms(response.data);
    } catch (error) {
      toast.error('Failed to load rooms');
    }
  };

  const handleCreateBlock = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/blocks', {
        collegeId: user.collegeId,
        name: blockName,
      });
      toast.success('Block created successfully');
      setShowBlockModal(false);
      setBlockName('');
      fetchBlocks();
    } catch (error) {
      toast.error('Failed to create block');
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/rooms', {
        blockId: selectedBlock.id,
        ...roomData,
      });
      toast.success('Room created successfully');
      setShowRoomModal(false);
      setRoomData({ roomNumber: '', capacity: 40, benches: 20 });
      fetchRooms(selectedBlock.id);
    } catch (error) {
      toast.error('Failed to create room');
    }
  };

  const handleDeleteBlock = async (blockId) => {
    if (!window.confirm('Are you sure? This will delete all rooms in this block.')) return;
    try {
      await axiosInstance.delete(`/blocks/${blockId}`);
      toast.success('Block deleted');
      fetchBlocks();
      if (selectedBlock?.id === blockId) {
        setSelectedBlock(null);
        setRooms([]);
      }
    } catch (error) {
      toast.error('Failed to delete block');
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    try {
      await axiosInstance.delete(`/rooms/${roomId}`);
      toast.success('Room deleted');
      fetchRooms(selectedBlock.id);
    } catch (error) {
      toast.error('Failed to delete room');
    }
  };

  const handleSelectBlock = (block) => {
    setSelectedBlock(block);
    fetchRooms(block.id);
  };

  return (
    <div data-testid="manage-infrastructure" className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Manage Infrastructure</h2>
        <Button data-testid="add-block-btn" onClick={() => setShowBlockModal(true)} className="bg-blue-600 hover:bg-blue-700 rounded-full">
          <Plus className="h-4 w-4 mr-2" /> Add Block
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="backdrop-blur-sm bg-white/70">
            <CardHeader>
              <CardTitle>Blocks</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : blocks.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No blocks added</p>
              ) : (
                <div className="space-y-2">
                  {blocks.map((block) => (
                    <div
                      key={block.id}
                      data-testid={`block-${block.id}`}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedBlock?.id === block.id ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleSelectBlock(block)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Building className="h-5 w-5 text-blue-600 mr-2" />
                          <span className="font-medium">{block.name}</span>
                        </div>
                        <Button
                          data-testid={`delete-block-${block.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBlock(block.id);
                          }}
                          size="sm"
                          variant="ghost"
                          className="hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="backdrop-blur-sm bg-white/70">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>
                  {selectedBlock ? `Rooms in ${selectedBlock.name}` : 'Select a block to view rooms'}
                </CardTitle>
                {selectedBlock && (
                  <Button
                    data-testid="add-room-btn"
                    onClick={() => setShowRoomModal(true)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 rounded-full"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Room
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedBlock ? (
                <p className="text-center text-gray-500 py-16">Please select a block from the left panel</p>
              ) : rooms.length === 0 ? (
                <p className="text-center text-gray-500 py-16">No rooms in this block</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      data-testid={`room-${room.id}`}
                      className="p-4 border border-green-200 rounded-lg bg-green-50 hover:shadow-md transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-lg font-semibold text-gray-900">Room {room.roomNumber}</h4>
                        <Button
                          data-testid={`delete-room-${room.id}`}
                          onClick={() => handleDeleteRoom(room.id)}
                          size="sm"
                          variant="ghost"
                          className="hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>Capacity: {room.capacity} students</p>
                        <p>Benches: {room.benches}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showBlockModal} onOpenChange={setShowBlockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Block</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBlock} className="space-y-4">
            <div>
              <Label htmlFor="blockName">Block Name</Label>
              <Input
                data-testid="block-name-input"
                id="blockName"
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
                placeholder="e.g., A-Block, Main Building"
                required
              />
            </div>
            <Button data-testid="create-block-btn" type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Create Block
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showRoomModal} onOpenChange={setShowRoomModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Room to {selectedBlock?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <Label htmlFor="roomNumber">Room Number</Label>
              <Input
                data-testid="room-number-input"
                id="roomNumber"
                value={roomData.roomNumber}
                onChange={(e) => setRoomData({ ...roomData, roomNumber: e.target.value })}
                placeholder="e.g., A-101"
                required
              />
            </div>
            <div>
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                data-testid="room-capacity-input"
                id="capacity"
                type="number"
                value={roomData.capacity}
                onChange={(e) => setRoomData({ ...roomData, capacity: parseInt(e.target.value) })}
                required
              />
            </div>
            <div>
              <Label htmlFor="benches">Number of Benches</Label>
              <Input
                data-testid="room-benches-input"
                id="benches"
                type="number"
                value={roomData.benches}
                onChange={(e) => setRoomData({ ...roomData, benches: parseInt(e.target.value) })}
                required
              />
            </div>
            <Button data-testid="create-room-btn" type="submit" className="w-full bg-green-600 hover:bg-green-700">
              Create Room
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageInfrastructure;