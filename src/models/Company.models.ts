// backend/src/models/Company.model.ts
import mongoose, { Schema, Document, Model } from "mongoose";
import slugify from "slugify";

// ==================== Enums with Lowercase Values ====================

export enum CompanySize {
  MICRO = "micro",
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
  ENTERPRISE = "enterprise",
}

export enum CompanyType {
  STARTUP = "startup",
  PRIVATE = "private",
  PUBLIC_LISTED = "public-listed",
  GOVERNMENT = "government",
  NON_PROFIT = "non-profit",
  EDUCATIONAL = "educational",
  SELF_EMPLOYED = "self-employed",
}

export enum IndustryType {
  TECHNOLOGY = "technology",
  FINANCE = "finance",
  BANKING = "banking",
  HEALTHCARE = "healthcare",
  EDUCATION = "education",
  MANUFACTURING = "manufacturing",
  RETAIL = "retail",
  E_COMMERCE = "e-commerce",
  HOSPITALITY = "hospitality",
  TOURISM = "tourism",
  REAL_ESTATE = "real-estate",
  MEDIA = "media",
  ENTERTAINMENT = "entertainment",
  TRANSPORTATION = "transportation",
  LOGISTICS = "logistics",
  CONSULTING = "consulting",
  AGRICULTURE = "agriculture",
  ENERGY = "energy",
  UTILITIES = "utilities",
  AUTOMOTIVE = "automotive",
  OTHER = "other",
}

export enum CompanyStatus {
  PENDING = "pending",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  REJECTED = "rejected",
}

export enum SocialPlatform {
  LINKEDIN = "linkedin",
  TWITTER = "twitter",
  FACEBOOK = "facebook",
  INSTAGRAM = "instagram",
  YOUTUBE = "youtube",
  GITHUB = "github",
  WEBSITE = "website",
}

// ==================== Interfaces ====================

export interface ISocialLink {
  platform: SocialPlatform;
  url: string;
}

export interface ILocation {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface ICompany extends Document {
  name: string;
  slug?: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  website?: string;
  email?: string;
  phone?: string;
  foundedYear?: number;
  companySize: CompanySize;
  companyType: CompanyType;
  industryType: IndustryType;
  registrationNumber?: string;
  location?: ILocation;
  socialLinks: ISocialLink[];
  ownerId: mongoose.Types.ObjectId;
  status: CompanyStatus;
  isActive: boolean;
  isVerified: boolean;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date;
}

// ==================== Schema ====================

const SocialLinkSchema = new Schema<ISocialLink>(
  {
    platform: {
      type: String,
      enum: Object.values(SocialPlatform),
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const LocationSchema = new Schema<ILocation>(
  {
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: "USA" },
    zipCode: { type: String, trim: true },
  },
  { _id: false },
);

const CompanySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    coverImageUrl: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    foundedYear: {
      type: Number,
      min: 1800,
      max: new Date().getFullYear(),
    },
    companySize: {
      type: String,
      enum: Object.values(CompanySize),
      required: true,
    },
    companyType: {
      type: String,
      enum: Object.values(CompanyType),
      required: true,
    },
    industryType: {
      type: String,
      enum: Object.values(IndustryType),
      required: true,
    },
    registrationNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    location: {
      type: LocationSchema,
      default: {},
    },
    socialLinks: {
      type: [SocialLinkSchema],
      default: [],
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(CompanyStatus),
      default: CompanyStatus.PENDING,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// ==================== Pre-save Middleware ====================

CompanySchema.pre("save", async function (this: ICompany) {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });
  }

  // Ensure enum values are lowercase
  if (this.companySize) {
    this.companySize = this.companySize.toLowerCase() as CompanySize;
  }
  if (this.companyType) {
    this.companyType = this.companyType.toLowerCase() as CompanyType;
  }
  if (this.industryType) {
    this.industryType = this.industryType.toLowerCase() as IndustryType;
  }
  if (this.status) {
    this.status = this.status.toLowerCase() as CompanyStatus;
  }
});

// ==================== Static Methods ====================

CompanySchema.statics.generateUniqueSlug = async function (
  this: Model<ICompany>,
  baseSlug: string,
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (await this.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

// ==================== Indexes ====================

CompanySchema.index({ name: "text", description: "text", tagline: "text" });
CompanySchema.index({ ownerId: 1, status: 1 });
CompanySchema.index({ isActive: 1, isVerified: 1 });
CompanySchema.index({ companyType: 1, industryType: 1 });
CompanySchema.index({ "location.city": 1, "location.country": 1 });

// ==================== Virtuals ====================

CompanySchema.virtual("totalJobs", {
  ref: "Job",
  localField: "_id",
  foreignField: "company",
  count: true,
});

CompanySchema.virtual("activeJobs", {
  ref: "Job",
  localField: "_id",
  foreignField: "company",
  count: true,
  match: { isActive: true },
});

// ==================== Model ====================

export const Company = mongoose.model<ICompany>("Company", CompanySchema);
export default Company;
