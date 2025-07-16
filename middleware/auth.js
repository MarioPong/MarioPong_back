const User = require("../models/user");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
require("dotenv").config();

const authMiddleware = async function (req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ isAuth: false, error: "Access Denied" });
  }

  try {
    const decoded = jwt.verify(token, 'secretToken'); // 🔁 보안을 위해 process.env.JWT_SECRET 사용 권장
    const user = await User.findOne({ _id: decoded._id, token });

    if (!user) {
      return res.status(401).json({ isAuth: false, error: "User not found or logged out" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ isAuth: false, error: "Invalid Token" });
  }
};


async function registerOrLoginGoogleUser(profile) {
  const { id: google_id, displayName, emails } = profile;
  const email = emails?.[0]?.value || null;

  try {
    let user = await User.findOne({ google_id });

    if (!user) {
      user = new User({
        id: email,
        password: Math.random().toString(36).slice(-8), // 더미 비밀번호
        name: displayName,
        google_id,
      });
      await user.save();
    }

    return user;
  } catch (err) {
    console.error("Google 로그인 처리 오류:", err);
    throw err;
  }
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://mariopong-back-4cre.onrender.com/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await registerOrLoginGoogleUser(profile);
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = {
  authMiddleware,
  passport,
};
