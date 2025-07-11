const mongoose = require('mongoose')

const gameSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true 
  },
  p1: {
    type: String,
    required: true 
  },
  p2: {
    type: String,
    required: true 
  },
  win: {
    type: String,
    required: true 
  },
  lose: {
    type: String,
    required: true 
  },
  score: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now
  }
});

const Game = mongoose.model('game', gameSchema)

module.exports = Game