const mongoose = require('mongoose')

const characterSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  skill: {
    type: String,
    required: true 
  },
  price: {
    type: Number,
    required: true 
  },
  lvl: {
    type: Number,
    default: 1 
  }
});

const Character = mongoose.model('Character', characterSchema)

module.exports = Character