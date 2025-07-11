import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'

const app = express()
const port = process.env.PORT || 3000
const host = '0.0.0.0'

app.use(cors())
app.use(bodyParser.urlencoded({extended : true}))
app.use(bodyParser.json())
app.use(cookieParser())

const User = require('./models/user')

const url = "mongodb+srv://tlatamus0203:3PV3ZAuEL6MrXkfr@cluster23.cyyuqox.mongodb.net/?retryWrites=true&w=majority&appName=Cluster23"

mongoose.connect(url)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err))

app.get('/', (req, res) => {
  res.send('Server On')
})

app.post("/api/user/register", async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(200).json({ success: true });
  } catch (err) {
    res.json({ success: false, err });
  }
});

app.listen(port, () => {
  console.log(`listening on port ${port}`)
})