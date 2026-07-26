import express from "express";
import { validateRegistration, validateLogin, } from "../middleware/validation.middleware";
import authService from "../services/auth.service";
import { protect } from "../middleware/authMiddleware";
import { getUserId } from "../utils/routeHelpers";
const router = express.Router();
router.post("/register", validateRegistration, async (req, res) => {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Registration failed";
        res.status(400).json({ error: errorMessage });
    }
});
router.post("/login", validateLogin, async (req, res) => {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Login failed";
        res.status(401).json({ error: errorMessage });
    }
});
router.get("/me", protect, async (req, res) => {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get profile";
        res.status(500).json({ error: errorMessage });
    }
});
export default router;
