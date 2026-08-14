import mongoose from 'mongoose';

const STATE_LABELS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export function getHealth() {
  const readyState = mongoose.connection.readyState;
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      state: STATE_LABELS[readyState] || 'unknown',
      connected: readyState === 1,
    },
  };
}
