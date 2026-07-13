# ai-job-portal-engine┌─────────────────────────────────────────────────────────────────────────────┐
│                           JOB PORTAL SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│  │   React Frontend │───▶│  API Gateway    │───▶│   Microservices        │ │
│  │   (Company UI)   │    │  (Spring Cloud) │    │   (Spring Boot)        │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘ │
│                                                     │                       │
│                                                     ▼                       │
│                              ┌─────────────────────────────────────────┐   │
│                              │  Kafka (Event-Driven Communication)    │   │
│                              │  - Application Status Updates          │   │
│                              │  - AI Screening Events                 │   │
│                              │  - Email Notifications                 │   │
│                              └─────────────────────────────────────────┘   │
│                                                     │                       │
│                              ┌─────────────────────────────────────────┐   │
│                              │  Redis (Caching)                       │   │
│                              │  - AI Job Matching Cache               │   │
│                              │  - Session Management                  │   │
│                              └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER REGISTRATION FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User visits /register                                                   │
│     │                                                                       │
│     ▼                                                                       │
│  2. User fills registration form                                            │
│     - Email                                                                 │
│     - Password                                                              │
│     - Full Name                                                             │
│     - Phone                                                                 │
│     - Role (CANDIDATE / EMPLOYER)                                          │
│     │                                                                       │
│     ▼                                                                       │
│  3. Frontend calls POST /api/auth/register                                 │
│     │                                                                       │
│     ▼                                                                       │
│  4. User Service:                                                           │
│     - Validates email uniqueness                                           │
│     - Encrypts password (bcrypt)                                           │
│     - Creates User in database                                             │
│     - Generates JWT token                                                  │
│     │                                                                       │
│     ▼                                                                       │
│  5. Returns JWT token to frontend                                          │
│     │                                                                       │
│     ▼                                                                       │
│  6. User redirected to:                                                    │
│     - CANDIDATE → /dashboard (candidate view)                              │
│     - EMPLOYER → /company/profile (if no company)                         │
│                  → /dashboard (if company exists)                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPANY CREATION FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Employer logs in → Redirected to /company/profile                      │
│     │                                                                       │
│     ▼                                                                       │
│  2. Frontend calls GET /api/employer/company/check                         │
│     │                                                                       │
│     ▼                                                                       │
│  3. If NO company exists:                                                  │
│     │                                                                       │
│     ▼                                                                       │
│  4. Show company creation form                                             │
│     - Company Name                                                         │
│     - Industry                                                             │
│     - Website                                                              │
│     - Company Size                                                         │
│     - Description                                                          │
│     - Location                                                             │
│     - Social Links                                                         │
│     │                                                                       │
│     ▼                                                                       │
│  5. Frontend calls POST /api/employer/company                              │
│     │                                                                       │
│     ▼                                                                       │
│  6. Company Service:                                                       │
│     - Validates company name uniqueness                                   │
│     - Generates slug from name                                            │
│     - Creates Company document                                            │
│     - Updates User with companyId                                         │
│     - Sets role to EMPLOYER                                               │
│     │                                                                       │
│     ▼                                                                       │
│  7. Employer redirected to /dashboard                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JOB POSTING FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Employer clicks "Post a Job" → /jobs/create                            │
│     │                                                                       │
│     ▼                                                                       │
│  2. Employer fills job form:                                               │
│     - Job Title                                                            │
│     - Description                                                          │
│     - Requirements (AI generate)                                          │
│     - Responsibilities (AI generate)                                      │
│     - Benefits (AI generate)                                              │
│     - Skills (AI suggest)                                                 │
│     - Salary Range                                                         │
│     - Location                                                             │
│     - Job Type (Full-time, Part-time, etc.)                               │
│     - Work Mode (Remote, Hybrid, On-site)                                 │
│     │                                                                       │
│     ▼                                                                       │
│  3. Optional: AI generates content                                         │
│     - Click "Generate with AI"                                            │
│     - Gemini API generates description, requirements, etc.                │
│     │                                                                       │
│     ▼                                                                       │
│  4. Frontend calls POST /api/employer/jobs                                │
│     │                                                                       │
│     ▼                                                                       │
│  5. Job Service:                                                           │
│     - Validates employer has company                                      │
│     - Creates Job document                                                │
│     - Status: DRAFT                                                       │
│     - Stores in database                                                  │
│     │                                                                       │
│     ▼                                                                       │
│  6. Employer publishes job                                                 │
│     - PATCH /api/employer/jobs/{id}/publish                               │
│     - Status changes: DRAFT → OPEN                                        │
│     - Job becomes visible to candidates                                   │
│     │                                                                       │
│     ▼                                                                       │
│  7. Kafka Event Published: "job-postings"                                 │
│     - Triggers notifications to matching candidates                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CANDIDATE APPLICATION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Candidate searches for jobs                                            │
│     - Browse jobs on home page                                            │
│     - Filter by location, type, salary                                    │
│     - AI Search with natural language                                     │
│     │                                                                       │
│     ▼                                                                       │
│  2. Candidate views job details                                            │
│     - Click on a job → /jobs/{id}                                         │
│     │                                                                       │
│     ▼                                                                       │
│  3. Candidate clicks "Apply Now"                                           │
│     │                                                                       │
│     ▼                                                                       │
│  4. AI Skill Analyzer analyzes resume                                      │
│     - Matches resume skills vs job requirements                           │
│     - Shows skill gaps                                                    │
│     - Suggests improvements                                               │
│     │                                                                       │
│     ▼                                                                       │
│  5. Candidate selects resume                                               │
│     - Choose from existing resumes                                        │
│     │                                                                       │
│     ▼                                                                       │
│  6. AI Cover Letter Generator (optional)                                  │
│     - Generates personalized cover letter                                 │
│     - Based on job description + resume                                   │
│     │                                                                       │
│     ▼                                                                       │
│  7. Candidate fills application details                                   │
│     - Expected Salary                                                     │
│     - Available From Date                                                 │
│     │                                                                       │
│     ▼                                                                       │
│  8. Candidate reviews application                                         │
│     - Job Title                                                           │
│     - Company                                                             │
│     - Resume                                                              │
│     - Cover Letter                                                        │
│     - Expected Salary                                                     │
│     │                                                                       │
│     ▼                                                                       │
│  9. Candidate submits application                                          │
│     - POST /api/candidate/applications                                    │
│     │                                                                       │
│     ▼                                                                       │
│  10. Application Service:                                                 │
│      - Creates Application document                                       │
│      - Status: PENDING                                                    │
│      - Triggers AI Screening (async)                                      │
│      │                                                                       │
│      ▼                                                                       │
│  11. AI Screening (Async via Kafka)                                       │
│      - Analyzes candidate skills vs job                                   │
│      - Generates AI Score (0-100)                                         │
│      - Provides recommendations                                           │
│      - Updates application with AI score                                  │
│      │                                                                       │
│      ▼                                                                       │
│  12. Candidate sees application status                                    │
│      - PENDING → REVIEWING → SHORTLISTED → etc.                          │
│      - Shows AI score                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EMPLOYER REVIEW & STATUS FLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Employer views dashboard                                               │
│     - Shows stats: Total Jobs, Active Jobs, Applications                  │
│     - AI Screening Dashboard                                               │
│     - Recent Applications                                                 │
│     │                                                                       │
│     ▼                                                                       │
│  2. Employer reviews applications                                          │
│     - Click on application → /applications/{id}                           │
│     - View candidate details                                               │
│     - View AI score and analysis                                          │
│     - View resume and cover letter                                        │
│     │                                                                       │
│     ▼                                                                       │
│  3. Employer updates application status                                    │
│     - Click "Update Status"                                               │
│     - Choose new status:                                                  │
│       • PENDING → REVIEWING                                               │
│       • REVIEWING → SHORTLISTED                                           │
│       • SHORTLISTED → INTERVIEW_SCHEDULED                                 │
│       • INTERVIEW_SCHEDULED → HIRED                                       │
│       • Any → REJECTED                                                    │
│     - Add notes (optional)                                                │
│     │                                                                       │
│     ▼                                                                       │
│  4. Application Service:                                                   │
│     - Validates status transition                                         │
│     - Updates status in database                                          │
│     │                                                                       │
│     ▼                                                                       │
│  5. Kafka Event Published: "application-status-updates"                   │
│     │                                                                       │
│     ▼                                                                       │
│  6. Notification Service (Kafka Consumer):                                │
│     - Sends email to candidate                                            │
│     - Creates in-app notification                                         │
│     │                                                                       │
│     ▼                                                                       │
│  7. Candidate sees status update in real-time                             │
│     - Dashboard updates automatically                                     │
│     - Receives email notification                                         │
│     │                                                                       │
│     ▼                                                                       │
│  8. If INTERVIEW_SCHEDULED:                                               │
│     - Employer adds interview details                                     │
│     - Candidate receives interview invitation                             │
│     - Calendar event created                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI FEATURES FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. AI Job Matching (Candidate)                                            │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │  - Candidate views "AI Match" on dashboard                     │    │
│     │  - AI analyzes resume vs all jobs                              │    │
│     │  - Returns jobs with match percentage                          │    │
│     │  - Shows High/Medium/Low match                                 │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  2. AI Skill Analyzer (Candidate)                                          │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │  - Before applying, candidate selects resume                   │    │
│     │  - AI analyzes resume skills vs job requirements               │    │
│     │  - Shows skill gaps                                            │    │
│     │  - Suggests improvements                                       │    │
│     │  - Returns match percentage                                    │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  3. AI Cover Letter Generator (Candidate)                                 │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │  - Candidate clicks "Generate with AI"                        │    │
│     │  - Uses Gemini API to generate personalized cover letter      │    │
│     │  - Based on job description + resume                          │    │
│     │  - Professional tone                                          │    │
│     │  - Candidate can edit before submitting                       │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  4. AI Screening (Employer)                                                │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │  - Application submitted → Triggers AI screening              │    │
│     │  - Asynchronous process via Kafka                             │    │
│     │  - Analyzes candidate vs job requirements                     │    │
│     │  - Generates score (0-100)                                    │    │
│     │  - Provides detailed analysis:                                │    │
│     │    • Skills match                                             │    │
│     │    • Experience match                                         │    │
│     │    • Education match                                          │    │
│     │    • Overall match                                            │    │
│     │    • Suggestions                                              │    │
│     │  - Updates application with AI score                          │    │
│     │  - Low score (<20) → Auto-rejected                            │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  5. AI Job Description Generator (Employer)                               │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │  - Employer enters job title                                  │    │
│     │  - Clicks "Generate with AI"                                  │    │
│     │  - Gemini generates:                                          │    │
│     │    • Description                                              │    │
│     │    • Requirements                                             │    │
│     │    • Responsibilities                                         │    │
│     │    • Benefits                                                 │    │
│     │    • Suggested skills                                         │    │
│     │    • Salary range suggestions                                 │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  6. AI Career Feedback (Candidate)                                         │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │  - Candidate clicks "AI Career Feedback"                      │    │
│     │  - AI analyzes resume                                         │    │
│     │  - Provides feedback:                                         │    │
│     │    • Why not shortlisted                                      │    │
│     │    • What to improve                                          │    │
│     │    • Missing skills                                           │    │
│     │    • Target job suggestions                                   │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KAFKA EVENT FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      PRODUCERS                                      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Application Service ──▶ Topic: application-status-updates         │   │
│  │  Job Service          ──▶ Topic: job-postings                     │   │
│  │  AI Screening Service ──▶ Topic: ai-screening-requests            │   │
│  │  AI Screening Service ──▶ Topic: ai-screening-completed           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      KAFKA BROKERS                                  │   │
│  │  - Partitioned Topics                                              │   │
│  │  - Replicated for HA                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      CONSUMERS                                      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Notification Service                                               │   │
│  │    └── Sends email/SMS notifications to candidate                   │   │
│  │                                                                     │   │
│  │  Email Service                                                      │   │
│  │    └── Sends application status emails                              │   │
│  │                                                                     │   │
│  │  AI Screening Worker                                                │   │
│  │    └── Processes AI screening requests                              │   │
│  │                                                                     │   │
│  │  Analytics Service                                                  │   │
│  │    └── Updates dashboard analytics                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE END-TO-END FLOW EXAMPLE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CANDIDATE                                                                  │
│     │                                                                       │
│     ▼                                                                       │
│  1. Searches for "Senior React Developer"                                   │
│     │                                                                       │
│     ▼                                                                       │
│  2. Clicks "Apply" on job                                                  │
│     │                                                                       │
│     ▼                                                                       │
│  3. AI Skill Analyzer runs → Shows match: 72%                              │
│     │                                                                       │
│     ▼                                                                       │
│  4. Selects resume → Generates cover letter with AI                        │
│     │                                                                       │
│     ▼                                                                       │
│  5. Submits application → Application Created                             │
│     │                                                                       │
│     ▼                                                                       │
│  6. AI Screening triggers (async)                                         │
│     │                                                                       │
│     ▼                                                                       │
│  7. AI Score: 85/100 → Application status: PENDING                        │
│     │                                                                       │
│     ▼                                                                       │
│  EMPLOYER                                                                   │
│     │                                                                       │
│     ▼                                                                       │
│  8. Employer sees application in dashboard with AI score                  │
│     │                                                                       │
│     ▼                                                                       │
│  9. Employer reviews application → Status: REVIEWING                      │
│     │                                                                       │
│     ▼                                                                       │
│  10. Kafka event triggers email to candidate                               │
│      │                                                                      │
│      ▼                                                                      │
│  CANDIDATE                                                                  │
│     │                                                                       │
│     ▼                                                                       │
│  11. Receives email: "Your application is being reviewed"                 │
│      │                                                                      │
│      ▼                                                                      │
│  EMPLOYER                                                                   │
│     │                                                                       │
│     ▼                                                                       │
│  12. Employer decides to shortlist → Status: SHORTLISTED                  │
│      │                                                                      │
│      ▼                                                                      │
│  13. Kafka event triggers another email                                    │
│      │                                                                      │
│      ▼                                                                      │
│  CANDIDATE                                                                  │
│     │                                                                       │
│     ▼                                                                       │
│  14. Receives email: "You have been shortlisted"                          │
│      │                                                                      │
│      ▼                                                                      │
│  15. Employer schedules interview → Status: INTERVIEW_SCHEDULED           │
│      │                                                                      │
│      ▼                                                                      │
│  16. Candidate receives interview invitation with details                 │
│      │                                                                      │
│      ▼                                                                      │
│  17. Interview conducted → Employer updates status: HIRED                 │
│      │                                                                      │
│      ▼                                                                      │
│  18. Candidate receives offer letter email                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
// Key Models:

User {
  _id, email, password, fullName, role, companyId, status
}

Company {
  _id, name, slug, description, logoUrl, ownerId, status
}

Job {
  _id, title, description, requirements[], companyId, employerId,
  salaryRange, jobType, workMode, experienceLevel, status
}

Application {
  _id, jobId, candidateId, resumeId, coverLetter,
  status, aiScore, aiScreeningData, statusHistory[]
}

Resume {
  _id, candidateId, title, template, personalInfo,
  workExperience[], education[], skills[]
}