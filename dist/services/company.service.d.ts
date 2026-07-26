import { ICompany, CompanyStatus } from "../models/Company.models.js";
export interface CreateCompanyDto {
    name: string;
    tagline?: string;
    description?: string;
    logoUrl?: string;
    coverImageUrl?: string;
    website?: string;
    email?: string;
    phone?: string;
    foundedYear?: number;
    companySize: string;
    companyType: string;
    industryType: string;
    registrationNumber?: string;
    location?: {
        address?: string;
        city?: string;
        state?: string;
        country?: string;
        zipCode?: string;
    };
    socialLinks?: {
        platform: string;
        url: string;
    }[];
}
export interface UpdateCompanyDto extends Partial<CreateCompanyDto> {
    status?: CompanyStatus;
    isActive?: boolean;
    isVerified?: boolean;
}
declare class CompanyService {
    /**
     * Create a new company
     */
    createCompany(userId: string, data: CreateCompanyDto): Promise<ICompany>;
    /**
     * Get company by ID
     */
    getCompanyById(companyId: string): Promise<ICompany | null>;
    /**
     * Get company by owner ID
     */
    getCompanyByOwnerId(userId: string): Promise<ICompany | null>;
    /**
     * Get company with statistics
     */
    getCompanyWithStats(userId: string): Promise<any>;
    /**
     * Update company
     */
    updateCompany(userId: string, companyId: string, data: UpdateCompanyDto): Promise<ICompany | null>;
    /**
     * Upload company logo
     */
    uploadLogo(userId: string, file: Express.Multer.File): Promise<string>;
    /**
     * Verify company (Admin only)
     */
    verifyCompany(companyId: string): Promise<ICompany | null>;
    /**
     * Suspend company
     */
    suspendCompany(companyId: string): Promise<ICompany | null>;
    /**
     * Check if user has a company
     */
    hasCompany(userId: string): Promise<boolean>;
    /**
     * Get all companies with pagination and filters
     */
    getAllCompanies(filters: {
        companyType?: string;
        industryType?: string;
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        companies: ICompany[];
        total: number;
    }>;
    /**
     * ✅ ADD THIS METHOD: Delete company (soft delete)
     */
    deleteCompany(userId: string, companyId: string): Promise<any>;
    /**
     * Get company jobs with pagination (using companyId)
     */
    getCompanyJobs(userId: string, page: number, limit: number, status?: string): Promise<{
        jobs: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    /**
     * ✅ ADD THIS METHOD: Get company statistics only
     */
    getCompanyStats(userId: string): Promise<any>;
    /**
     * Get top skills from applications
     */
    private getTopSkills;
}
declare const _default: CompanyService;
export default _default;
//# sourceMappingURL=company.service.d.ts.map