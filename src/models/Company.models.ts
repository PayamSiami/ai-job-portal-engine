// src/models/Company.models.ts
import mongoose, { Schema, Document } from "mongoose";

// ============ Type Definitions ============

export enum CompanySize {
  STARTUP = "startup",           // 1-10 employees
  SMALL = "small",               // 11-50 employees
  MEDIUM = "medium",             // 51-200 employees
  LARGE = "large",               // 201-1000 employees
  ENTERPRISE = "enterprise",     // 1000+ employees
}

export enum CompanyIndustry {
  TECHNOLOGY = "technology",
  FINANCE = "finance",
  HEALTHCARE = "healthcare",
  EDUCATION = "education",
  RETAIL = "retail",
  MANUFACTURING = "manufacturing",
  CONSULTING = "consulting",
  MEDIA = "media",
  REAL_ESTATE = "real_estate",
  TRANSPORTATION = "transportation",
  ENERGY = "energy",
  GOVERNMENT = "government",
  NON_PROFIT = "non_profit",
  OTHER = "other",
}

export interface ICompany extends Document {
  name: string;
  slug: string;
  description?: string;
  website?: string;
  logo?: string;
  coverImage?: string;
  size?: CompanySize;
  industry?: CompanyIndustry;
  foundedYear?: number;
  headquarters?: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  locations?: Array<{
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    isHeadquarters: boolean;
  }>;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    github?: string;
    youtube?: string;
    website?: string;
  };
  culture?: {
    mission?: string;
    vision?: string;
    values?: string[];
    benefits?: string[];
    perks?: string[];
    workCulture?: string;
  };
  owner: mongoose.Types.ObjectId; // User with employer role
  members?: Array<{
    user: mongoose.Types.ObjectId;
    role: "owner" | "admin" | "member" | "recruiter";
    joinedAt: Date;
  }>;
  isVerified: boolean;
  isActive: boolean;
  verificationDocuments?: Array<{
    type: "business_license" | "tax_id" | "incorporation" | "other";
    url: string;
    verifiedAt?: Date;
    status: "pending" | "verified" | "rejected";
  }>;
  stats?: {
    totalJobsPosted: number;
    activeJobs: number;
    totalApplications: number;
    totalHires: number;
    averageRating: number;
    totalReviews: number;
  };
  createdAt: Date;
  updatedAt: Date;

  // Methods
  toPublicJSON(): Partial<ICompany>;
  addMember(userId: mongoose.Types.ObjectId, role?: string): Promise<ICompany>;
  removeMember(userId: mongoose.Types.ObjectId): Promise<ICompany>;
  updateStats(stats: Partial<ICompany["stats"]>): Promise<ICompany>;
}

// ============ Schema Definition ============

const companySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      maxlength: [100, "Company name cannot exceed 100 characters"],
      index: true,
    },
    slug: {
      type: String,
      required: [true, "Company slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"],
      maxlength: [100, "Slug cannot exceed 100 characters"],
      index: true,
    },
    description: {
      type: String,
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },
    website: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Please provide a valid URL starting with http:// or https://"],
    },
    logo: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Please provide a valid URL for the logo"],
    },
    coverImage: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Please provide a valid URL for the cover image"],
    },
    size: {
      type: String,
      enum: Object.values(CompanySize),
      index: true,
    },
    industry: {
      type: String,
      enum: Object.values(CompanyIndustry),
      index: true,
    },
    foundedYear: {
      type: Number,
      min: [1800, "Founded year must be after 1800"],
      max: [new Date().getFullYear(), `Founded year cannot be in the future`],
    },
    headquarters: {
      address: { type: String, trim: true },
      city: { type: String, trim: true, index: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true, default: "United States" },
      postalCode: { type: String, trim: true },
      coordinates: {
        lat: { type: Number, min: -90, max: 90 },
        lng: { type: Number, min: -180, max: 180 },
      },
    },
    locations: [
      {
        address: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        country: { type: String, trim: true },
        isHeadquarters: { type: Boolean, default: false },
      },
    ],
    socialLinks: {
      linkedin: { type: String, trim: true, match: [/^https?:\/\/(www\.)?linkedin\.com\/.+/, "Invalid LinkedIn URL"] },
      twitter: { type: String, trim: true, match: [/^https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+/, "Invalid Twitter/X URL"] },
      facebook: { type: String, trim: true, match: [/^https?:\/\/(www\.)?facebook\.com\/.+/, "Invalid Facebook URL"] },
      instagram: { type: String, trim: true, match: [/^https?:\/\/(www\.)?instagram\.com\/.+/, "Invalid Instagram URL"] },
      github: { type: String, trim: true, match: [/^https?:\/\/(www\.)?github\.com\/.+/, "Invalid GitHub URL"] },
      youtube: { type: String, trim: true, match: [/^https?:\/\/(www\.)?youtube\.com\/.+/, "Invalid YouTube URL"] },
      website: { type: String, trim: true, match: [/^https?:\/\/.+/, "Invalid website URL"] },
    },
    culture: {
      mission: { type: String, maxlength: [1000, "Mission statement cannot exceed 1000 characters"] },
      vision: { type: String, maxlength: [1000, "Vision statement cannot exceed 1000 characters"] },
      values: [{ type: String, trim: true, maxlength: [100, "Value cannot exceed 100 characters"] }],
      benefits: [{ type: String, trim: true, maxlength: [200, "Benefit cannot exceed 200 characters"] }],
      perks: [{ type: String, trim: true, maxlength: [200, "Perk cannot exceed 200 characters"] }],
      workCulture: { type: String, maxlength: [2000, "Work culture description cannot exceed 2000 characters"] },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["owner", "admin", "member", "recruiter"],
          default: "member",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    verificationDocuments: [
      {
        type: {
          type: String,
          enum: ["business_license", "tax_id", "incorporation", "other"],
          required: true,
        },
        url: {
          type: String,
          required: true,
          trim: true,
          match: [/^https?:\/\/.+/, "Please provide a valid document URL"],
        },
        verifiedAt: { type: Date },
        status: {
          type: String,
          enum: ["pending", "verified", "rejected"],
          default: "pending",
        },
      },
    ],
    stats: {
      totalJobsPosted: { type: Number, default: 0 },
      activeJobs: { type: Number, default: 0 },
      totalApplications: { type: Number, default: 0 },
      totalHires: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      totalReviews: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============ Indexes ============

companySchema.index({ name: "text", description: "text" });
companySchema.index({ owner: 1, isActive: 1 });
companySchema.index({ "members.user": 1 });
companySchema.index({ industry: 1, size: 1, isActive: 1 });
companySchema.index({ "headquarters.city": 1, "headquarters.country": 1, isActive: 1 });
companySchema.index({ isVerified: 1, isActive: 1 });
companySchema.index({ "stats.averageRating": -1 });

// ============ Virtuals ============

companySchema.virtual("jobs", {
  ref: "Job",
  localField: "_id",
  foreignField: "company",
  justOne: false,
});

companySchema.virtual("ownerDetails", {
  ref: "User",
  localField: "owner",
  foreignField: "_id",
  justOne: true,
});

companySchema.virtual("memberDetails", {
  ref: "User",
  localField: "members.user",
  foreignField: "_id",
  justOne: false,
});

// ============ Methods ============

companySchema.methods.toPublicJSON = function (): Partial<ICompany> {
  const obj = this.toObject();
  delete (obj as any).__v;
  return obj;
};

companySchema.methods.addMember = async function (
  this: any,
  userId: mongoose.Types.ObjectId,
  role: "owner" | "admin" | "member" | "recruiter" = "member"
): Promise<any> {
  const existingMember = this.members.find(
    (m: any) => m.user.toString() === userId.toString()
  );
  if (!existingMember) {
    this.members.push({ user: userId, role, joinedAt: new Date() });
    await this.save();
  }
  return this;
};

companySchema.methods.removeMember = async function (
  this: any,
  userId: mongoose.Types.ObjectId
): Promise<any> {
  this.members = this.members.filter(
    (m: any) => m.user.toString() !== userId.toString()
  );
  await this.save();
  return this;
};

companySchema.methods.updateStats = async function (
  this: any,
  stats: Partial<ICompany["stats"]>
): Promise<any> {
  Object.assign(this.stats, stats);
  await this.save();
  return this;
};

// ============ Statics Interface ============

interface ICompanyModel extends mongoose.Model<ICompany> {
  findBySlug(slug: string): mongoose.Query<ICompany | null, ICompany>;
  findByOwner(ownerId: mongoose.Types.ObjectId): mongoose.Query<ICompany[], ICompany>;
  findByMember(userId: mongoose.Types.ObjectId): mongoose.Query<ICompany[], ICompany>;
  search(
    query: string,
    filters: {
      industry?: CompanyIndustry;
      size?: CompanySize;
      location?: string;
      isVerified?: boolean;
    }
  ): mongoose.Query<ICompany[], ICompany>;
}

// ============ Statics ============

companySchema.statics.findBySlug = function (slug: string) {
  return this.findOne({ slug: slug.toLowerCase(), isActive: true });
};

companySchema.statics.findByOwner = function (ownerId: mongoose.Types.ObjectId) {
  return this.find({ owner: ownerId, isActive: true }).sort({ createdAt: -1 });
};

companySchema.statics.findByMember = function (userId: mongoose.Types.ObjectId) {
  return this.find({ "members.user": userId, isActive: true }).sort({ createdAt: -1 });
};

companySchema.statics.search = function (
  query: string,
  filters: {
    industry?: CompanyIndustry;
    size?: CompanySize;
    location?: string;
    isVerified?: boolean;
  } = {}
) {
  const searchQuery: any = {
    isActive: true,
    $text: { $search: query },
  };

  if (filters.industry) searchQuery.industry = filters.industry;
  if (filters.size) searchQuery.size = filters.size;
  if (filters.isVerified !== undefined) searchQuery.isVerified = filters.isVerified;
  if (filters.location) {
    searchQuery.$or = [
      { "headquarters.city": { $regex: filters.location, $options: "i" } },
      { "headquarters.state": { $regex: filters.location, $options: "i" } },
      { "headquarters.country": { $regex: filters.location, $options: "i" } },
      { "locations.city": { $regex: filters.location, $options: "i" } },
    ];
  }

  return this.find(searchQuery).sort({ score: { $meta: "textScore" } });
};

// ============ Create and Export Model ============

const Company = mongoose.model<ICompany, ICompanyModel>("Company", companySchema);

export default Company;