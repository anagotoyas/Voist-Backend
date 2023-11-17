const Router = require("express");
const { isAuth } = require("../middlewares/auth.middleware");
const { validateSchema } = require("../middlewares/validate.middleware");
const {
  signin,
  signup,
  signout,
  profile,
  countUsers,
  countNewUsers,
  findAllUsers,
  findUser,
  findTimeByUserId
} = require("../controllers/auth.controller");
const { signinSchema, signupSchema } = require("../schemas/auth.schema");

const router = Router();

// // Middleware para configurar encabezados CORS
// router.use((req, res, next) => {
//     // Configura los encabezados CORS
//     res.setHeader('Access-Control-Allow-Origin', '*');
//     res.setHeader('Access-Control-Allow-Credentials', true);

//     // Continúa con el flujo de la solicitud
//     next();
//   });

router.post("/signin", validateSchema(signinSchema), signin);

router.post("/signup", validateSchema(signupSchema), signup);

router.post("/signout", signout);

router.get("/profile", isAuth, profile);

router.get("/users-count", countUsers);

router.get("/users-new", countNewUsers);

router.get("/users", findAllUsers);

router.get("/users/:id", findUser);

router.get("/users/:id/time", findTimeByUserId);

module.exports = router;
