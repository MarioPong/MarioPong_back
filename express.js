const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const webSocket = require('./socket')
const {Server} = require('socket.io')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const nodemailer = require('nodemailer')
require('dotenv').config()

const app = express()
const port = process.env.PORT || 3000
const host = '0.0.0.0'

const allowedOrigins = [
  'http://127.0.0.1:5500',
  'https://mario-pong.netlify.app'
]

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(bodyParser.urlencoded({extended : true}))
app.use(bodyParser.json())
app.use(cookieParser())
app.use(express.json())

const User = require('./models/user')
const Character = require('./models/character')
const auth = require('./middleware/auth')

const url = process.env.MONGODB_URL

mongoose.connect(url)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err))

app.get('/', async (req, res) => {
  res.send('Server On')
})

app.post("/api/user/register", async (req, res) => {
  try {
    const user = new User(req.body)
    await user.save()
    console.log(user)
    res.status(200).json({ success: true })
  } catch (err) {
    res.json({ success: false, err })
  }
})

app.post("/api/user/isduplicated", async (req, res) => {
  const isDuplicated = await User.isEmailDuplicated(req.body.id)
  res.json({duplicated: isDuplicated})
})

app.post("/api/user/login", async (req, res) => {
  try {
    const { id, password } = req.body
    if (!id || !password) {
      return res.status(400).json({
        loginSuccess: false,
        message: "아이디와 비밀번호를 모두 입력하세요.",
      })
    }

    const user = await User.findOne({ id });
    if (!user) {
      return res.status(401).json({
        loginSuccess: false,
        message: "아이디가 존재하지 않습니다.",
      })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({
        loginSuccess: false,
        message: "아이디 또는 비밀번호가 올바르지 않습니다.",
      })
    }

    await user.generateToken()
    res
      .cookie("x_auth", user.token, {
        httpOnly: true,
        sameSite: "none",
        secure: true
      })
      .status(200)
      .json({ loginSuccess: true, userId: user.id, username: user.name, gold: user.gold, score: user.score, characters: user.character_own, records: user.records, wins: user.wins, losses: user.losses })
  } catch (err) {
    res.status(500).json({
      loginSuccess: false,
      message: "서버 오류가 발생했습니다.",
      error: err.message,
    })
  }
})

app.post('/api/user/forgot-password', async (req, res) => {
  const { email } = req.body
  if (!email) {
    return res.status(400).json({ success: false, message: '이메일을 입력하세요.' })
  }

  try {
    const user = await User.findOne({ id: email })
    if (!user) {
      return res.status(404).json({ success: false, message: '등록된 이메일이 없습니다.' })
    }

    const tempPassword = Math.random().toString(36).slice(-8)

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS
      }
    })

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'MarioPong 임시 비밀번호 안내',
      text: `안녕하세요!\n\n임시 비밀번호는 ${tempPassword} 입니다.\n로그인 후 반드시 비밀번호를 변경해 주세요.`
    }

    transporter.sendMail(mailOptions, async (error, info) => {
      if (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: '이메일 전송에 실패했습니다.' })
      }
      user.password = tempPassword
      await user.save()
      return res.status(200).json({ success: true, message: '임시 비밀번호가 이메일로 전송되었습니다.' })
    })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' })
  }
})

app.post('/api/user/change-password', async (req, res) => {
  const email = req.body.id
  const password = req.body.password
  if (!email) {
    return res.status(400).json({ success: false, message: '이메일을 입력하세요.' })
  }
  if (!password) {
    return res.status(400).json({ success: false, message: '비밀번호를 입력하세요.' })
  }

  try {
    const user = await User.findOne({ id: email })
    if (!user) {
      return res.status(404).json({ success: false, message: '등록된 이메일이 없습니다.' })
    }

    user.password = password
    await user.save()
    res.status(200).json({ success: true })
  } catch (err) {
    res.json({ success: false, err })
  }
})

app.post('/api/user/update', auth, async (req, res) => {
  const email = req.body.id
  const gold = req.body.gold
  const score = req.body.score
  const character_own = req.body.character_own
  const records = req.body.records
  const wins = req.body.wins
  const losses = req.body.losses
  if (!email) {
    return res.status(400).json({ success: false, message: '이메일을 입력하세요.' })
  }
  if (gold === undefined || gold === null) {
    return res.status(400).json({ success: false, message: '골드를 입력하세요.' })
  }
  if (score === undefined || score === null) {
    return res.status(400).json({ success: false, message: '점수를 입력하세요.' })
  }
  if (!character_own) {
    return res.status(400).json({ success: false, message: '보유 캐릭터를 입력하세요.' })
  }
  if (!records) {
    return res.status(400).json({ success: false, message: '전적을 입력하세요.' })
  }
  if (wins === undefined || wins === null) {
    return res.status(400).json({ success: false, message: '승리횟수를 입력하세요.' })
  }
  if (losses === undefined || losses === null) {
    return res.status(400).json({ success: false, message: '패배횟수를 입력하세요.' })
  }

  try {
    const user = await User.findOne({ id: email })
    if (!user) {
      return res.status(404).json({ success: false, message: '등록된 이메일이 없습니다.' })
    }

    user.gold = gold
    user.score = score
    user.character_own = character_own
    user.records = records
    user.wins = wins
    user.losses = losses
    await user.save()
    console.log(user)
    res.status(200).json({ success: true })
  } catch (err) {
    res.json({ success: false, err })
  }
})

app.put('/api/user/update-gold', auth, async (req, res) => {
  console.log("user gold update start")
  const email = req.body.id
  const gold = req.body.gold
  if (!email) {
    return res.status(400).json({ success: false, message: '이메일을 입력하세요.' })
  }
  if (gold === undefined || gold === null) {
    return res.status(400).json({ success: false, message: '골드를 입력하세요.' })
  }

  try {
    const user = await User.findOne({ id: email })
    if (!user) {
      return res.status(404).json({ success: false, message: '등록된 이메일이 없습니다.' })
    }

    user.gold = gold
    await user.save()
    console.log(user)
    res.status(200).json({ success: true })
  } catch (err) {
    console.log(err)
    res.json({ success: false, err })
  }
})

app.get("/api/user/logout", auth, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.user._id },
      { token: "" },
      { new: true }
    )
    if (!user) {
      return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." })
    }
    res.clearCookie("x_auth", {
      httpOnly: true,
      sameSite: "none",
      secure: true
    })
    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

app.get("/api/user/auth", auth, (req, res) => {
  const {
    _id,
    id,
    name,
    img,
    gold,
    score,
    character_own,
    character_now,
    records,
    wins,
    losses,
    google_id
  } = req.user

  res.status(200).json({
    _id,
    id,
    name,
    img,
    gold,
    score,
    character_own,
    character_now,
    records,
    wins,
    losses,
    google_id,
    isAuth: true
  })
})

app.post("/api/character/register", async (req, res) => {
  try {
    const character = new Character(req.body)
    await character.save()
    console.log(character)
    res.status(200).json({ success: true })
  } catch (err) {
    res.json({ success: false, err })
  }
})


const httpServer = app.listen(port, () => {
  console.log(`listening on port ${port}`)
})

const io = new Server(httpServer, {
  cors : {
    origin: "https://mario-pong.netlify.app",
    methods: ["GET", "POST"],
    credentials: true
  }
})

webSocket.listen(io)