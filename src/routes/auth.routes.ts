// src/routes/auth.routes.ts
import express, { Request, Response, Router } from "express";

import {
  validateRegistration,
  validateLogin,
} from "../middleware/validation.middleware";
import authService from "../services/auth.service";
import { protect } from "../middleware/authMiddleware";
import { getUserId } from "../utils/routeHelpers";
import googleAuthController from "../controllers/googleAuth.controller";
const router: Router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *                 example: "johndoe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: "password123"
 *               role:
 *                 type: string
 *                 enum: [job-seeker, employer]
 *                 example: "job-seeker"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                 token:
 *                   type: string
 *       400:
 *         description: Validation error or user already exists
 *       500:
 *         description: Server error
 */
router.post(
  "/register",
  validateRegistration,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { user, token } = await authService.register(req.body);

      res.status(201).json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        token,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Registration failed";
      res.status(400).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post(
  "/login",
  validateLogin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { user, token } = await authService.login(req.body);


      res.json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        token,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Login failed";
      res.status(400).json({ error: errorMessage });
    }
  },
);

router.get(
  "/me",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const user = await authService.getUserById(userId);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to get profile";
      res.status(500).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Google OAuth login/signup
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google ID token from frontend
 *               role:
 *                 type: string
 *                 enum: [job-seeker, employer]
 *                 default: job-seeker
 *     responses:
 *       200:
 *         description: Authentication successful
 *       400:
 *         description: Invalid token or missing idToken
 *       500:
 *         description: Server error
 */
router.post("/google", googleAuthController.googleAuth);

/**
 * @swagger
 * /api/auth/google/link:
 *   post:
 *     summary: Link Google account to existing user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Google account linked
 *       401:
 *         description: Not authenticated
 */
router.post("/google/link", protect, googleAuthController.linkGoogleAccount);

/**
 * @swagger
 * /api/auth/google/unlink:
 *   post:
 *     summary: Unlink Google account from user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Google account unlinked
 *       401:
 *         description: Not authenticated
 */
router.post(
  "/google/unlink",
  protect,
  googleAuthController.unlinkGoogleAccount,
);

export default router;
