const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const jwt = require("jsonwebtoken")

const saltRounds = 10

const characterSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  img: {
    type: String,
    required: true
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

const userSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 50
  },
  img: {
    type: String
  },
  gold: {
    type: Number,
    default: 0
  },
  score: {
    type: Number,
    default: 0
  },
  character_own: {
    type: [characterSchema],
    default: []
  },
  character_now: {
    type: characterSchema, 
    default: null
  },
  records: {
    type: [gameSchema], 
    default: []
  },
  wins: {
    type: Number,
    default: 0
  },
  losses: {
    type: Number,
    default: 0
  },
  google_id: {
    type: String,
    default: null // 구글 로그인 연동 ID
  },
  token: {
    type: String,
  },
  tokenExp: {
    type: Number,
  },
})


userSchema.pre("save", async function (next) {
  try {
    if (this.isModified("password")) {
      this.password = await bcrypt.hash(this.password, saltRounds)
    }
    next()
  } catch (err) {
    next(err)
  }
})

userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password)
}

userSchema.methods.generateToken = async function () {
  const user = this
  try {
    const token = jwt.sign(user._id.toHexString(), "secretToken")
    user.token = token
    await user.save()
    return user
  } catch (err) {
    throw err
  }
}

userSchema.statics.findByToken = async function(token) {
  try {
    const decoded = jwt.verify(token, "secretToken")
    if (!decoded ) {
      return null
    }
    return await this.findOne({ _id: decoded, token })
  } catch (err) {
    return null
  }
}

userSchema.statics.isEmailDuplicated = async function(id) {
  console.log(id)
  const user = await this.findOne({ id })
  return !!user
}

const User = mongoose.model('User', userSchema)

module.exports = User