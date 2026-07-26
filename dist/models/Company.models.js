// backend/src/models/Company.model.ts
import mongoose, { Schema } from "mongoose";
import slugify from "slugify";
// ==================== Enums with Lowercase Values ====================
export var CompanySize;
(function (CompanySize) {
    CompanySize["MICRO"] = "micro";
    CompanySize["SMALL"] = "small";
    CompanySize["MEDIUM"] = "medium";
    CompanySize["LARGE"] = "large";
    CompanySize["ENTERPRISE"] = "enterprise";
})(CompanySize || (CompanySize = {}));
export var CompanyType;
(function (CompanyType) {
    CompanyType["STARTUP"] = "startup";
    CompanyType["PRIVATE"] = "private";
    CompanyType["PUBLIC_LISTED"] = "public-listed";
    CompanyType["GOVERNMENT"] = "government";
    CompanyType["NON_PROFIT"] = "non-profit";
    CompanyType["EDUCATIONAL"] = "educational";
    CompanyType["SELF_EMPLOYED"] = "self-employed";
})(CompanyType || (CompanyType = {}));
export var IndustryType;
(function (IndustryType) {
    IndustryType["TECHNOLOGY"] = "technology";
    IndustryType["FINANCE"] = "finance";
    IndustryType["BANKING"] = "banking";
    IndustryType["HEALTHCARE"] = "healthcare";
    IndustryType["EDUCATION"] = "education";
    IndustryType["MANUFACTURING"] = "manufacturing";
    IndustryType["RETAIL"] = "retail";
    IndustryType["E_COMMERCE"] = "e-commerce";
    IndustryType["HOSPITALITY"] = "hospitality";
    IndustryType["TOURISM"] = "tourism";
    IndustryType["REAL_ESTATE"] = "real-estate";
    IndustryType["MEDIA"] = "media";
    IndustryType["ENTERTAINMENT"] = "entertainment";
    IndustryType["TRANSPORTATION"] = "transportation";
    IndustryType["LOGISTICS"] = "logistics";
    IndustryType["CONSULTING"] = "consulting";
    IndustryType["AGRICULTURE"] = "agriculture";
    IndustryType["ENERGY"] = "energy";
    IndustryType["UTILITIES"] = "utilities";
    IndustryType["AUTOMOTIVE"] = "automotive";
    IndustryType["OTHER"] = "other";
})(IndustryType || (IndustryType = {}));
export var CompanyStatus;
(function (CompanyStatus) {
    CompanyStatus["PENDING"] = "pending";
    CompanyStatus["ACTIVE"] = "active";
    CompanyStatus["SUSPENDED"] = "suspended";
    CompanyStatus["REJECTED"] = "rejected";
})(CompanyStatus || (CompanyStatus = {}));
export var SocialPlatform;
(function (SocialPlatform) {
    SocialPlatform["LINKEDIN"] = "linkedin";
    SocialPlatform["TWITTER"] = "twitter";
    SocialPlatform["FACEBOOK"] = "facebook";
    SocialPlatform["INSTAGRAM"] = "instagram";
    SocialPlatform["YOUTUBE"] = "youtube";
    SocialPlatform["GITHUB"] = "github";
    SocialPlatform["WEBSITE"] = "website";
})(SocialPlatform || (SocialPlatform = {}));
// ==================== Schema ====================
const SocialLinkSchema = new Schema({
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
}, { _id: false });
const LocationSchema = new Schema({
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: "USA" },
    zipCode: { type: String, trim: true },
}, { _id: false });
const CompanySchema = new Schema({
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
}, {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
});
// ==================== Pre-save Middleware ====================
CompanySchema.pre("save", async function () {
    if (this.isModified("name") || !this.slug) {
        this.slug = slugify(this.name, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
        });
    }
    // Ensure enum values are lowercase
    if (this.companySize) {
        this.companySize = this.companySize.toLowerCase();
    }
    if (this.companyType) {
        this.companyType = this.companyType.toLowerCase();
    }
    if (this.industryType) {
        this.industryType = this.industryType.toLowerCase();
    }
    if (this.status) {
        this.status = this.status.toLowerCase();
    }
});
// ==================== Static Methods ====================
CompanySchema.statics.generateUniqueSlug = async function (baseSlug) {
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
export const Company = mongoose.model("Company", CompanySchema);
export default Company;
