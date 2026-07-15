// utils/resumeContentBuilder.ts

export function buildResumeContent(resume: any): string {
  const parts: string[] = [];
  
  // 1. Personal Information
  if (resume.personalInfo) {
    const { personalInfo } = resume;
    parts.push('=== PERSONAL INFORMATION ===');
    
    if (personalInfo.firstName || personalInfo.lastName) {
      parts.push(`Name: ${personalInfo.firstName || ''} ${personalInfo.lastName || ''}`);
    }
    if (personalInfo.title) {
      parts.push(`Title: ${personalInfo.title}`);
    }
    if (personalInfo.email) {
      parts.push(`Email: ${personalInfo.email}`);
    }
    if (personalInfo.phone) {
      parts.push(`Phone: ${personalInfo.phone}`);
    }
    if (personalInfo.location) {
      parts.push(`Location: ${personalInfo.location}`);
    }
    if (personalInfo.linkedin) {
      parts.push(`LinkedIn: ${personalInfo.linkedin}`);
    }
    if (personalInfo.github) {
      parts.push(`GitHub: ${personalInfo.github}`);
    }
    if (personalInfo.website) {
      parts.push(`Website: ${personalInfo.website}`);
    }
    if (personalInfo.summary) {
      parts.push(`\nProfessional Summary: ${personalInfo.summary}`);
    }
    parts.push('');
  }

  // 2. Skills (CRITICAL - Your resume has this!)
  if (resume.skills && resume.skills.length > 0) {
    parts.push('=== SKILLS ===');
    
    // Group skills by category if available
    const skillsByCategory = resume.skills.reduce((acc: any, skill: any) => {
      const category = skill.category || 'General';
      if (!acc[category]) acc[category] = [];
      acc[category].push(skill);
      return acc;
    }, {});
    
    Object.entries(skillsByCategory).forEach(([category, skills]: [string, any]) => {
      if (category !== 'General') {
        parts.push(`\n${category}:`);
      }
      skills.forEach((skill: any) => {
        const levelText = skill.level ? ` (${skill.level.toUpperCase()})` : '';
        parts.push(`  • ${skill.name}${levelText}`);
      });
    });
    
    // Also add as a comma-separated list for better AI parsing
    const skillNames = resume.skills.map((s: any) => s.name).join(', ');
    parts.push(`\nAll Skills: ${skillNames}`);
    parts.push('');
  }

  // 3. Work Experience
  if (resume.experience && resume.experience.length > 0) {
    parts.push('=== WORK EXPERIENCE ===');
    resume.experience.forEach((exp: any) => {
      parts.push(`\n${exp.position} at ${exp.company}`);
      if (exp.location) parts.push(`Location: ${exp.location}`);
      
      const startDate = exp.startDate ? formatDate(exp.startDate) : '';
      const endDate = exp.current ? 'Present' : (exp.endDate ? formatDate(exp.endDate) : '');
      parts.push(`Dates: ${startDate} - ${endDate}`);
      
      if (exp.description) {
        parts.push(`Description: ${exp.description}`);
      }
      
      if (exp.achievements && exp.achievements.length > 0) {
        parts.push('Achievements:');
        exp.achievements.forEach((achievement: string) => {
          parts.push(`  • ${achievement}`);
        });
      }
    });
    parts.push('');
  }

  // 4. Education
  if (resume.education && resume.education.length > 0) {
    parts.push('=== EDUCATION ===');
    resume.education.forEach((edu: any) => {
      parts.push(`\n${edu.degree} - ${edu.institution}`);
      if (edu.fieldOfStudy) parts.push(`Field: ${edu.fieldOfStudy}`);
      if (edu.location) parts.push(`Location: ${edu.location}`);
      
      const startDate = edu.startDate ? formatDate(edu.startDate) : '';
      const endDate = edu.current ? 'Present' : (edu.endDate ? formatDate(edu.endDate) : '');
      parts.push(`Dates: ${startDate} - ${endDate}`);
      
      if (edu.gpa) parts.push(`GPA: ${edu.gpa}`);
      if (edu.description) parts.push(`Description: ${edu.description}`);
    });
    parts.push('');
  }

  // 5. Certifications
  if (resume.certifications && resume.certifications.length > 0) {
    parts.push('=== CERTIFICATIONS ===');
    resume.certifications.forEach((cert: any) => {
      parts.push(`\n${cert.name}`);
      if (cert.issuer) parts.push(`Issuer: ${cert.issuer}`);
      if (cert.date) parts.push(`Date: ${formatDate(cert.date)}`);
      if (cert.credentialId) parts.push(`ID: ${cert.credentialId}`);
      if (cert.url) parts.push(`URL: ${cert.url}`);
    });
    parts.push('');
  }

  // 6. Languages
  if (resume.languages && resume.languages.length > 0) {
    parts.push('=== LANGUAGES ===');
    resume.languages.forEach((lang: any) => {
      parts.push(`  • ${lang.name}: ${lang.proficiency || 'Professional'}`);
    });
    parts.push('');
  }

  // 7. Projects
  if (resume.projects && resume.projects.length > 0) {
    parts.push('=== PROJECTS ===');
    resume.projects.forEach((project: any) => {
      parts.push(`\n${project.name}`);
      if (project.description) parts.push(`Description: ${project.description}`);
      if (project.technologies && project.technologies.length > 0) {
        parts.push(`Technologies: ${project.technologies.join(', ')}`);
      }
      if (project.url) parts.push(`URL: ${project.url}`);
      if (project.startDate) {
        const endDate = project.endDate ? formatDate(project.endDate) : 'Present';
        parts.push(`Period: ${formatDate(project.startDate)} - ${endDate}`);
      }
    });
    parts.push('');
  }

  // 8. Custom Sections
  if (resume.customSections && resume.customSections.length > 0) {
    parts.push('=== ADDITIONAL INFORMATION ===');
    resume.customSections.forEach((section: any) => {
      parts.push(`\n${section.title}:`);
      parts.push(section.content);
    });
    parts.push('');
  }

  // 9. Summary Section - Create a comprehensive summary
  parts.push('=== RESUME SUMMARY ===');
  
  // Build a summary sentence
  const name = resume.personalInfo?.firstName && resume.personalInfo?.lastName 
    ? `${resume.personalInfo.firstName} ${resume.personalInfo.lastName}` 
    : 'Candidate';
  const title = resume.personalInfo?.title || 'Professional';
  const skillCount = resume.skills?.length || 0;
  const expCount = resume.experience?.length || 0;
  
  parts.push(`${name} - ${title}`);
  parts.push(`Total Skills: ${skillCount}`);
  parts.push(`Total Experience Entries: ${expCount}`);
  
  if (resume.skills && resume.skills.length > 0) {
    const topSkills = resume.skills
      .filter((s: any) => s.level === 'expert' || s.level === 'advanced')
      .map((s: any) => s.name)
      .slice(0, 5);
    if (topSkills.length > 0) {
      parts.push(`Top Skills: ${topSkills.join(', ')}`);
    }
  }

  return parts.join('\n');
}

function formatDate(date: any): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}