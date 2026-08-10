import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
export var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["JOB_SEEKER"] = "job-seeker";
    UserRole["EMPLOYER"] = "employer";
})(UserRole || (UserRole = {}));
const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
        type: String,
        required: false, // Not required for OAuth users
        select: false,
        minlength: 8,
    },
    role: {
        type: String,
        enum: Object.values(UserRole),
        required: true,
        default: UserRole.JOB_SEEKER,
    },
    // Google OAuth fields
    googleId: {
        type: String,
        unique: true,
        sparse: true, // Allow null values but unique when present
        select: false,
    },
    authProvider: {
        type: String,
        enum: ["local", "google"],
        default: "local",
    },
    profile: {
        firstName: String,
        lastName: String,
        headline: String,
        location: String,
        skills: {
            type: [String],
            default: [],
        },
        experience: Number,
        education: String,
        bio: String,
        phone: String,
        profileImage: String,
        website: String,
        linkedin: String,
        github: String,
        twitter: String,
    },
    resumeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Resume",
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    lastLogin: {
        type: Date,
    },
}, {
    timestamps: true,
    toJSON: { versionKey: false },
    toObject: { versionKey: false },
});
userSchema.pre("save", async function () {
    if (!this.isModified("password") || !this.password) {
        return;
    }
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password)
        return false;
    return bcrypt.compare(candidatePassword, this.password);
};
userSchema.methods.toPublicJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.__v;
    return obj;
};
const User = mongoose.model("User", userSchema);
export default User;
