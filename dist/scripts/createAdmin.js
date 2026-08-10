// src/scripts/createAdmin.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User, { UserRole } from '../models/User.models.js';
import logger from '../utils/logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });
const createAdmin = async () => {
    try {
        // Connect to MongoDB
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jobportal';
        await mongoose.connect(MONGODB_URI);
        logger.debug('Connected to MongoDB');
        const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (existingAdmin) {
            logger.warn('Admin already exists:', existingAdmin.email);
            process.exit(0);
        }
        // Create admin
        const admin = new User({
            username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
            email: adminEmail,
            password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123456',
            role: UserRole.ADMIN,
            profile: {
                firstName: 'System',
                lastName: 'Administrator',
                headline: 'Platform Administrator',
                skills: ['Management', 'Leadership', 'System Administration'],
                experience: 10,
                bio: 'System administrator for AI Job Portal',
            },
            isActive: true,
        });
        await admin.save();
        logger.debug('\n✅ Admin user created successfully!');
        logger.debug('📧 Email:', admin.email);
        logger.debug('🔑 Password:', process.env.DEFAULT_ADMIN_PASSWORD || 'admin123456');
        logger.debug('⚠️  Please change the password immediately after first login!\n');
        process.exit(0);
    }
    catch (error) {
        logger.error('❌ Error creating admin:', { error });
        process.exit(1);
    }
};
createAdmin();
