const User = require("../models/user")

const auth = async (req, res, next) => {
  try {
    const token = req.cookies.x_auth
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

module.exports = auth