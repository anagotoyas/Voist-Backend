const Router = require("express");
const {
  createConversation,
  getConversationByFile,
} = require("../controllers/conversation.controller");

const { isAuth } =  require('../middlewares/auth.middleware')

const router = Router();

router.post("/conversation", isAuth, createConversation);
router.get("/conversation/:file_id", isAuth, getConversationByFile);


module.exports = router;
