// backend/src/validations/company.validation.ts
import { z } from "zod";

export const createCompanySchema = z.object({
  body: z.object({
    name: z.string().min(1, "Company name is required").max(100),
    tagline: z.string().max(200).optional(),
    description: z.string().optional(),
    logoUrl: z.string().url("Invalid logo URL").optional(),
    coverImageUrl: z.string().url("Invalid cover image URL").optional(),
    website: z.string().url("Invalid website URL").optional(),
    email: z.string().email("Invalid email").optional(),
    phone: z.string().optional(),
    foundedYear: z.number().min(1800).max(new Date().getFullYear()).optional(),
    companySize: z.enum(["MICRO", "SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]),
    companyType: z.enum([
      "STARTUP",
      "PRIVATE",
      "PUBLIC_LISTED",
      "GOVERNMENT",
      "NON_PROFIT",
      "EDUCATIONAL",
      "SELF_EMPLOYED",
    ]),
    industryType: z.enum([
      "TECHNOLOGY",
      "FINANCE",
      "BANKING",
      "HEALTHCARE",
      "EDUCATION",
      "MANUFACTURING",
      "RETAIL",
      "E_COMMERCE",
      "HOSPITALITY",
      "TOURISM",
      "REAL_ESTATE",
      "MEDIA",
      "ENTERTAINMENT",
      "TRANSPORTATION",
      "LOGISTICS",
      "CONSULTING",
      "AGRICULTURE",
      "ENERGY",
      "UTILITIES",
      "AUTOMOTIVE",
      "OTHER",
    ]),
    registrationNumber: z.string().optional(),
    location: z
      .object({
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        zipCode: z.string().optional(),
      })
      .optional(),
    socialLinks: z
      .array(
        z.object({
          platform: z.enum([
            "LINKEDIN",
            "TWITTER",
            "FACEBOOK",
            "INSTAGRAM",
            "YOUTUBE",
            "GITHUB",
            "WEBSITE",
          ]),
          url: z.string().url("Invalid social media URL"),
        }),
      )
      .optional(),
  }),
});

export const updateCompanySchema = z.object({
  body: createCompanySchema.shape.body.partial(),
});
