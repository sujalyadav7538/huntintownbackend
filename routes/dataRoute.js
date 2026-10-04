import Router from "express";

import { getLivePosts } from "../controllers/dataController.js";

const router = Router();

// Define your routes here
router.get("/livePosts",getLivePosts);


export default router;
