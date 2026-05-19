const RoomDefs = {
  office: {
    name: 'Office',
    color: 'rgba(74, 144, 196, 0.05)',
    border: '#4a90c4',
    minW: 3, minH: 3,
    requires: [
      { type: 'work_pc', count: 1 },
      { type: 'chair', count: 1 },
    ],
  },
  server_room: {
    name: 'Server Room',
    color: 'rgba(92, 184, 92, 0.05)',
    border: '#5cb85c',
    minW: 2, minH: 2,
    requires: [
      { type: 'server', count: 1 },
      { type: 'network_switch', count: 1 },
      { type: 'work_pc', count: 1 },
      { type: 'network_storage', count: 1 },
    ],
  },
  bathroom: {
    name: 'Bathroom',
    color: 'rgba(0, 188, 212, 0.05)',
    border: '#00bcd4',
    minW: 3, minH: 3,
    requires: [
      { type: 'toilet', count: 1 },
      { type: 'bathroom_sink', count: 1 },
    ],
  },
  break_room: {
    name: 'Break Room',
    color: 'rgba(232, 130, 26, 0.05)',
    border: '#e8821a',
    minW: 3, minH: 3,
    requires: [
      { type: 'sofa_single', count: 1 },
      { type: 'tv', count: 1 },
    ],
  },
};
