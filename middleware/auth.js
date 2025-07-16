const User = require("../models/user")
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const jwt = require('jsonwebtoken')
require('dotenv').config()

const auth = async (req, res, next) => {
  try {
    const token = req.cookies.token
    if (!token) {
      return res.status(401).json({ isAuth: false, error: "토큰이 없습니다." })
    }

    const user = await User.findByToken(token)
    if (!user) {
      return res.status(401).json({ isAuth: false, error: "인증된 유저가 아닙니다." })
    }

    req.token = token
    req.user = user
    next()
  } catch (err) {
    return res.status(500).json({ isAuth: false, error: "서버 오류" })
  }
}

async function registerOrLoginGoogleUser(profile) {
  const { id: google_id, displayName, emails, photos } = profile
  const email = emails?.[0]?.value || null

  try {
    let user = await User.findOne({ google_id })

    if (!user) {
      user = new User({
        id: email,
        password: Math.random().toString(36).slice(-8), // 더미 비밀번호 -> 실제 유저는 안씀
        name: displayName,
        google_id
      })

      await user.save()
    }

    return user
  } catch (err) {
    console.error('Google 로그인 처리 오류:', err)
    throw err
  }
}

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://mariopong-back-4cre.onrender.com/auth/google/callback",
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await registerOrLoginGoogleUser(profile)
    return done(null, user)
  } catch (err) {
    return done(err, null)
  }
}))

passport.serializeUser((user, done) => {
  done(null, user._id) // 세션 또는 쿠키 저장용
})

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id)
    done(null, user)
  } catch (err) {
    done(err, null)
  }
})

module.exports = auth
module.exports = passport
module.exports = async function (req, res, next) {
  const token = req.cookies.token
  if (!token) return res.status(401).json({ isAuth: false, error: "Access Denied" })

  try {
    const verified = jwt.verify(token, 'secretToken')
    const user = await User.findOne({ _id: verified, token })
    if (!user) return res.status(401).json({ isAuth: false, error: "Unauthenticated" })

    req.user = user
    next()
  } catch (err) {
    return res.status(403).json({ isAuth: false, error: "Invalid Token" })
  }
}