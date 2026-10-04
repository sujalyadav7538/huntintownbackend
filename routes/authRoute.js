import express from 'express';
import { Signup, Signin, GoogleSignin } from '../controllers/authController.js';

const router = express.Router();

router.post("/signup", Signup);
router.post("/signin", Signin);
router.post("/google", GoogleSignin);

export default router;