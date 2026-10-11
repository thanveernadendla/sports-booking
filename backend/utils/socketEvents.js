function emitBookingCreated(io, booking) {
  if (!io) return;
  const bookingObj = booking.toObject ? booking.toObject() : booking;
  const timestamp = new Date().toISOString();

  // Send full booking payload to the authorized user's room
  if (bookingObj.userId) {
    io.to(`user_${bookingObj.userId}`).emit('my_booking_updated', {
      type: 'BOOKING_CREATED',
      bookingId: bookingObj.id,
      booking: bookingObj,
      timestamp
    });
  }

  // Send to authorized admin room
  io.to('admin_room').emit('admin_booking_updated', {
    type: 'BOOKING_CREATED',
    bookingId: bookingObj.id,
    booking: bookingObj,
    timestamp
  });

  // Public event (does not leak customer phone or private info) to refresh slots & public booking list
  io.emit('booking_updated', {
    type: 'BOOKING_CREATED',
    bookingId: bookingObj.id,
    venue: bookingObj.venue,
    time: bookingObj.time,
    date: bookingObj.date,
    status: bookingObj.status,
    timestamp
  });

  io.emit('app_state_changed', { timestamp });
}

function emitBookingStatusChanged(io, booking) {
  if (!io) return;
  const bookingObj = booking.toObject ? booking.toObject() : booking;
  const timestamp = new Date().toISOString();

  if (bookingObj.userId) {
    io.to(`user_${bookingObj.userId}`).emit('my_booking_updated', {
      type: 'BOOKING_STATUS_CHANGED',
      bookingId: bookingObj.id,
      status: bookingObj.status,
      booking: bookingObj,
      timestamp
    });
  }

  io.to('admin_room').emit('admin_booking_updated', {
    type: 'BOOKING_STATUS_CHANGED',
    bookingId: bookingObj.id,
    status: bookingObj.status,
    booking: bookingObj,
    timestamp
  });

  io.emit('booking_updated', {
    type: 'BOOKING_STATUS_CHANGED',
    bookingId: bookingObj.id,
    status: bookingObj.status,
    timestamp
  });

  io.emit('app_state_changed', { timestamp });
}

function emitBookingDeleted(io, { id, userId }) {
  if (!io) return;
  const timestamp = new Date().toISOString();

  if (userId) {
    io.to(`user_${userId}`).emit('my_booking_updated', {
      type: 'BOOKING_DELETED',
      bookingId: id,
      timestamp
    });
  }

  io.to('admin_room').emit('admin_booking_updated', {
    type: 'BOOKING_DELETED',
    bookingId: id,
    timestamp
  });

  io.emit('booking_updated', {
    type: 'BOOKING_DELETED',
    bookingId: id,
    timestamp
  });

  io.emit('app_state_changed', { timestamp });
}

function emitAppStateChanged(io) {
  if (!io) return;
  const timestamp = new Date().toISOString();
  io.emit('app_state_changed', { timestamp });
}

module.exports = {
  emitBookingCreated,
  emitBookingStatusChanged,
  emitBookingDeleted,
  emitAppStateChanged
};
