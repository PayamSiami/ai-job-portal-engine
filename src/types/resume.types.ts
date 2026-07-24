export interface CreateResumeDTO {
  title: string;
  template?: "modern" | "classic" | "minimal" | "creative";
  visibility?: "private" | "public" | "shared";
  isDefault?: boolean;
  generatePDF?: boolean;
  status?: "draft" | "active" | "archived";
  personalInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    location?: string;
    website?: string;
    linkedin?: string;
    github?: string;
    summary?: string;
    title?: string;
  };
  experience?: Array<{
    company: string;
    position: string;
    location?: string;
    startDate: Date | string;
    endDate?: Date | string;
    current?: boolean;
    description?: string;
    achievements?: string[];
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    location?: string;
    startDate: Date | string;
    endDate?: Date | string;
    current?: boolean;
    description?: string;
    gpa?: number;
  }>;
  skills?: Array<{
    name: string;
    level?: "beginner" | "intermediate" | "advanced" | "expert";
    category?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    date: Date | string;
    expiryDate?: Date | string;
    credentialId?: string;
    url?: string;
  }>;
  languages?: Array<{
    name: string;
    proficiency: "basic" | "conversational" | "professional" | "native";
  }>;
  projects?: Array<{
    name: string;
    description?: string;
    url?: string;
    technologies?: string[];
    startDate?: Date | string;
    endDate?: Date | string;
  }>;
  customSections?: Array<{
    title: string;
    content: string;
    order: number;
  }>;
}

export interface UpdateResumeDTO extends Partial<CreateResumeDTO> {
  status?: "draft" | "active" | "archived";
}

export interface ResumeQueryParams {
  status?: "all" | "draft" | "active" | "archived";
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  portfolio?: string;
  summary?: string;
  title?: string;
}

export interface Experience {
  id?: string;
  company: string;
  title: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description: string;
  achievements?: string[];
}

export interface Education {
  id?: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  gpa?: number;
  description?: string;
}

export interface Skill {
  id?: string;
  name: string;
  level?: "beginner" | "intermediate" | "advanced" | "expert";
  category?: string;
}

export interface Certification {
  id?: string;
  name: string;
  issuingOrganization: string;
  issueDate?: string;
  expirationDate?: string;
  credentialId?: string;
}

export interface Language {
  id?: string;
  name: string;
  proficiency: "elementary" | "limited" | "professional" | "native";
}

export interface Project {
  id?: string;
  name: string;
  description: string;
  technologies?: string[];
  startDate?: string;
  endDate?: string;
  url?: string;
  achievements?: string[];
}

export interface CustomSection {
  id?: string;
  title: string;
  content: string;
  order: number;
}
