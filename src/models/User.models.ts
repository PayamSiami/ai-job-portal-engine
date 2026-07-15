// src/models/User.model.ts
import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export enum UserRole {
  ADMIN = "admin",
  JOB_SEEKER = "job-seeker",
  EMPLOYER = "employer",
}


export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  profile: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    profileImage?: string;
    bio?: string;
    headline?: string;
    location?: string;
    skills: string[];
    experience?: number;
    education?: string;
    website?: string;
    linkedin?: string;
    github?: string;
    twitter?: string;
  };
  resumeId?: mongoose.Types.ObjectId;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  toPublicJSON(): Partial<IUser>;
}

const userSchema = new Schema<IUser>(
  {
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
      required: true,
      select: false,
      minlength: 8,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      default: UserRole.JOB_SEEKER,
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
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function (this: IUser) {
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (
  this: IUser,
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function (this: IUser): Partial<IUser> {
  const obj = this.toObject();
  delete (obj as any).password;
  delete (obj as any).__v;
  return obj;
};

const User = mongoose.model<IUser>("User", userSchema);

export default User;
