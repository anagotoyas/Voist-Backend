const Router = require("express");
const {
  getContactList,
  addContact,
  deleteContact,
  getUsersWithContactStatus
} = require("../controllers/contact.controller");



const router = Router();

router.get("/contacts/:userId", getContactList);
router.post("/add", addContact);
router.delete("/contacts/:contact_id/:owner_id",deleteContact);
router.get('/usersWithContactStatus/:userId', getUsersWithContactStatus);


module.exports = router;
