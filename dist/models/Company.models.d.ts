import mongoose, { Document, Model } from "mongoose";
export declare enum CompanySize {
    MICRO = "micro",
    SMALL = "small",
    MEDIUM = "medium",
    LARGE = "large",
    ENTERPRISE = "enterprise"
}
export declare enum CompanyType {
    STARTUP = "startup",
    PRIVATE = "private",
    PUBLIC_LISTED = "public-listed",
    GOVERNMENT = "government",
    NON_PROFIT = "non-profit",
    EDUCATIONAL = "educational",
    SELF_EMPLOYED = "self-employed"
}
export declare enum IndustryType {
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
    OTHER = "other"
}
export declare enum CompanyStatus {
    PENDING = "pending",
    ACTIVE = "active",
    SUSPENDED = "suspended",
    REJECTED = "rejected"
}
export declare enum SocialPlatform {
    LINKEDIN = "linkedin",
    TWITTER = "twitter",
    FACEBOOK = "facebook",
    INSTAGRAM = "instagram",
    YOUTUBE = "youtube",
    GITHUB = "github",
    WEBSITE = "website"
}
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
export declare const Company: Model<ICompany, {}, {}, {}, Document<unknown, {}, ICompany, {}, mongoose.DefaultSchemaOptions> & ICompany & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ICompany>;
export default Company;
//# sourceMappingURL=Company.models.d.ts.map