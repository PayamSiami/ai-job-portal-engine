export interface ResumeData {
  id?: string;
  title: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    location?: string;
    website?: string;
    linkedin?: string;
    github?: string;
    summary?: string;
    title?: string;
  };
  experience: Array<{
    company: string;
    position: string;
    location?: string;
    startDate: Date | string;
    endDate?: Date | string;
    current: boolean;
    description?: string;
    achievements?: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    location?: string;
    startDate: Date | string;
    endDate?: Date | string;
    current: boolean;
    description?: string;
    gpa?: number;
  }>;
  skills: Array<{
    name: string;
    level?: "beginner" | "intermediate" | "advanced" | "expert";
    category?: string;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    date: Date | string;
    expiryDate?: Date | string;
    credentialId?: string;
    url?: string;
  }>;
  languages: Array<{
    name: string;
    proficiency: "basic" | "conversational" | "professional" | "native";
  }>;
  projects: Array<{
    name: string;
    description?: string;
    url?: string;
    technologies?: string[];
    startDate?: Date | string;
    endDate?: Date | string;
  }>;
  template: "modern" | "classic" | "minimal" | "creative";
  visibility?: string;
  status?: string;
  isDefault?: boolean;
}
