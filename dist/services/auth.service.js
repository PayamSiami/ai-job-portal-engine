import { config } from "../config/index";
import User, { UserRole } from "../models/User.models";
import jwt from "jsonwebtoken";
class AuthService {
    async register(registerData) {
        const { username, email, password, role, profile } = registerData;
        const existingUser = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { username }],
        });
        if (existingUser) {
            if (existingUser.email === email.toLowerCase()) {
                throw new Error("Email already registered");
            }
            if (existingUser.username === username) {
                throw new Error("Username already taken");
            }
        }
        const user = new User({
            username,
            email: email.toLowerCase(),
            password,
            role: role || UserRole.JOB_SEEKER,
            profile: profile || { skills: [] },
            isActive: true,
        });
        await user.save();
        const token = this.generateToken(user._id);
        return {
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
            token,
        };
    }
    async login(loginData) {
        const { email, password } = loginData;
        const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
        if (!user) {
            throw new Error("Invalid email or password");
        }
        if (!user.isActive) {
            throw new Error("Account has been deactivated");
        }
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new Error("Invalid email or password");
        }
        user.lastLogin = new Date();
        await user.save();
        const token = this.generateToken(user._id);
        return {
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
            token,
        };
    }
    async getUserById(userId) {
        return User.findById(userId).select("-password -__v").exec();
    }
    async verifyToken(token) {
        try {
            const jwtSecret = config.JWT_SECRET;
            if (!jwtSecret) {
                throw new Error("JWT_SECRET is not defined");
            }
            const decoded = jwt.verify(token, jwtSecret);
            return decoded;
        }
        catch (error) {
            throw new Error("Invalid or expired token");
        }
    }
    generateToken(userId) {
        const jwtSecret = config.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error("JWT_SECRET is not defined");
        }
        const jwtExpire = config.JWT_EXPIRE || "30d";
        return jwt.sign({ id: userId.toString() }, jwtSecret, {
            expiresIn: jwtExpire,
        });
    }
    async changePassword(userId, oldPassword, newPassword) {
        const user = await User.findById(userId).select("+password");
        if (!user) {
            throw new Error("User not found");
        }
        const isPasswordValid = await user.comparePassword(oldPassword);
        if (!isPasswordValid) {
            throw new Error("Current password is incorrect");
        }
        user.password = newPassword;
        await user.save();
        return {
            success: true,
            message: "Password updated successfully",
        };
    }
    async resetPassword(email, newPassword) {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            throw new Error("User not found");
        }
        user.password = newPassword;
        await user.save();
        return {
            success: true,
            message: "Password reset successfully",
        };
    }
    async logout(userId) {
        return {
            success: true,
            message: "Logged out successfully",
        };
    }
    async refreshToken(refreshToken) {
        try {
            const decoded = await this.verifyToken(refreshToken);
            const user = await this.getUserById(decoded.id);
            if (!user) {
                throw new Error("User not found");
            }
            const newToken = this.generateToken(user._id);
            return { token: newToken };
        }
        catch (error) {
            throw new Error("Invalid refresh token");
        }
    }
}
export default new AuthService();
