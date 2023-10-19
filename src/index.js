const serverless = require("serverless-http");
const express = require("express");
const cookieParser = require('cookie-parser');
const authRoutes = require("./routes/auth.routes")
const fileRoutes = require("./routes/file.routes")
const folderRoutes = require("./routes/folder.routes")
const cors = require("cors");
const bodyParser = require('body-parser');

const corsOptions = {
  origin:["https://voist.netlify.app","http://localhost:5173","https://voist.me"],
  credentials:true
}


const app = express();

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '100mb' }))
app.use(bodyParser.raw({type:'audio/wav', limit: '100mb'}))
app.use(express.urlencoded({ extended: false }))




app.get("/", (req, res, next) => {
  return res.status(200).json({
    message: "Hello from root!",
  });
});
 
app.get("/path", (req, res, next) => {
  return res.status(200).json({
    message: "Hello from path!",
  });
});

app.use('/api', authRoutes)
app.use('/api', fileRoutes)
app.use('/api', folderRoutes)



app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

app.listen(3000)

module.exports.handler = serverless(app);
