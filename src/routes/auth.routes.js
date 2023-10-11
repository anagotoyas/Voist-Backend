const Router = require('express');
const { isAuth } =  require('../middlewares/auth.middleware')
const { validateSchema } = require('../middlewares/validate.middleware')
const { signin,signup,signout,profile } = require('../controllers/auth.controller')
const { signinSchema, signupSchema } = require('../schemas/auth.schema')

const router = Router();

// // Middleware para configurar encabezados CORS
// router.use((req, res, next) => {
//     // Configura los encabezados CORS
//     res.setHeader('Access-Control-Allow-Origin', '*');
//     res.setHeader('Access-Control-Allow-Credentials', true);
  
//     // Continúa con el flujo de la solicitud
//     next();
//   });
  



router.post('/signin', validateSchema(signinSchema),signin);

router.post('/signup',validateSchema(signupSchema), signup );

router.post('/signout',signout );

router.get('/profile', isAuth, profile);

module.exports = router;

