const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

const app = express()
const port = process.env.PORT || 3000
const host = '0.0.0.0'

app.use(cors())
app.use(bodyParser.urlencoded({extended : true}))
app.use(bodyParser.json())
app.use(cookieParser())

const User = require('./models/user');

const url = "mongodb+srv://tlatamus0203:3PV3ZAuEL6MrXkfr@cluster23.cyyuqox.mongodb.net/?retryWrites=true&w=majority&appName=Cluster23"

mongoose.connect(url)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err))

app.get('/', (req, res) => {
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
        message: "아이디 또는 비밀번호가 올바르지 않습니다.",
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
      .cookie("x_auth", user.token)
      .status(200)
      .json({ loginSuccess: true, userId: user._id })
  } catch (err) {
    res.status(500).json({
      loginSuccess: false,
      message: "서버 오류가 발생했습니다.",
      error: err.message,
    })
  }
})

app.listen(port, () => {
  console.log(`listening on port ${port}`)
})