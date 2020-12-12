const mongoose = require('mongoose');
// const validator = require('validator');

const model = mongoose.model('Tracking', {
  userId: {
    type: Number,
    required: false,
  },
  eventType: {
    type: Object,
    required: true,
  },
  payload: {
    type: Object,
    required: true,
  },
  createdAt: {
    type: Date,
    required: true,
  },
});

module.exports = model;
