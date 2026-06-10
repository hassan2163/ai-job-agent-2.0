const { generateContent } = require("./aiService");

const cleanAndParseJSON = (result) => {
  let cleaned = result.trim();

  cleaned = cleaned
    .replace(/```json\s*/g, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start !== -1 && end !== -1) {
    cleaned = cleaned.substring(start, end + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Failed to parse Gemini JSON:", error.message);
    throw new Error("AI returned an unexpected format. Please try again.");
  }
};

const analyzeCV = async (jobDescription, resume) => {
  const prompt = `
You are a senior recruiter, hiring manager, and ATS resume expert.

Analyze the candidate resume against the job description.

Job Description:
${jobDescription}

Candidate Resume:
${resume}

Rules:
- Return valid JSON only.
- Do not include markdown.
- Do not generate a resume.
- Do not generate a cover letter.
- Do not generate interview questions.
- Evaluate only evidence from the resume.
- Do not invent experience, fake tools, certifications, or metrics.
- Be honest about gaps.
- Use the job description requirements to evaluate fit.
- This is an estimated match score, not a real ATS system score.
- Score conservatively. Do not inflate the score to encourage applying.
- Separate direct evidence, transferable evidence, true gaps, and claims the candidate should not make.
- A direct match means the resume explicitly supports the requirement.
- A transferable match means the resume shows related experience, but not direct experience with the exact requirement.
- A true gap means the resume does not provide enough support.
- doNotClaim must list job requirements, tools, domains, certifications, or metrics the candidate should not claim in applications or interviews.
- claimsToVerifyBeforeApplying must list any claim that may be useful but needs the candidate to personally confirm before using.

Scoring Method:
Start from 50%.
Then apply:
- Strong alignment with critical requirement: +20%
- Partial alignment with requirement: +10%
- Missing critical requirement: -15%
- Missing optional requirement: -5%
- Transferable experience: +5%
- Strong project/implementation experience: +10%
- Strong domain mismatch: -10%

Decision:
- 80% or higher = APPLY
- 60% to 79% = APPLY_WITH_CAUTION
- Below 60% = SKIP

Return only this JSON:

{
  "decision": "APPLY | APPLY_WITH_CAUTION | SKIP",
  "matchScore": "estimated percentage",
  "fitSummary": "Two-line recruiter evaluation.",
  "targetRole": "",
  "targetIndustry": "",
  "strengths": [],
  "gaps": [],
  "directMatches": [],
  "transferableMatches": [],
  "trueGaps": [],
  "doNotClaim": [],
  "claimsToVerifyBeforeApplying": [],
  "matchedKeywords": [],
  "missingKeywords": [],
  "strategy": {
    "positioning": "",
    "whatToSay": "",
    "riskLevel": "LOW | MEDIUM | HIGH"
  }
}
`;

  const result = await generateContent(prompt);
  return cleanAndParseJSON(result);
};

const generateTailoredResume = async (jobDescription, resume, analysis) => {

  const prompt = `
You are an ATS resume writer, senior recruiter, and resume data-structuring expert.

Generate a tailored resume based on the job description, candidate resume, and CV analysis.

Job Description:
${jobDescription}

Candidate Resume:
${resume}

CV Analysis:
${JSON.stringify(analysis, null, 2)}

Critical Rules:
- Return valid JSON only.
- Do not include markdown.
- Do not include explanations outside JSON.
- Generate only the tailored resume JSON.
- Do not generate a cover letter.
- Do not generate interview questions.
- Do not invent experience, employers, job titles, dates, locations, education, certifications, tools, phone numbers, emails, LinkedIn URLs, or fake metrics.
- Use only evidence from the candidate resume.
- Preserve the candidate's original employers, job titles, dates, locations, education dates, certifications, contact details, and degree details whenever present.
- If a field is missing from the candidate resume, return the placeholder tag for that field.
- Use placeholder tags exactly like: "[Phone]", "[Email]", "[LinkedIn]", "[Dates]", "[Location]", "[Company]", "[Job Title]", "[Institution]", "[Degree]", "[Field of Study]".
- Do not remove fields just because they are missing.
- Do not guess missing dates or locations.
- Do not collapse professional experience into plain text.
- Do not collapse education into plain text.
- Always return professionalExperience as an array of objects.
- Always return education as an array of objects.
- Use job description keywords naturally, but only when they are supported by the candidate resume or clearly transferable.
- Use job description keywords only when directly supported by the resume.
- If a keyword is only transferable, mention the transferable experience without claiming direct experience with that keyword.
- Do not convert transferable experience into direct experience.
- Prefer rewriting existing responsibilities over creating new responsibilities.
- Do not add a new responsibility just because it appears in the job description.
- Keep the candidate truthful and ATS-friendly.
- Tailor the headline, summary, skills, and bullets to the target job.
- Resume bullets must be impact-driven.
- Every resume bullet must pass this test: could the candidate confidently explain this in an interview using only their real experience?
- If a bullet does not pass that test, rewrite it more conservatively or omit it.
- If exact metrics are not provided, write strong impact statements without fake numbers.
- Use 3-6 bullets per role depending on available resume evidence and job relevance.
- Do not force extra bullets if the resume does not provide enough evidence.
- Prioritize fewer, defensible bullets over more impressive but weaker bullets.
- Avoid repeated bullet wording.
- If the job requires domain experience the candidate does not have, position related transferable experience honestly in the summary or bullets, but do not add unsupported tools as skills.
- If the CV analysis includes doNotClaim or trueGaps, do not include those items as skills, direct experience, tools, certifications, achievements, or metrics.
- If the CV analysis includes claimsToVerifyBeforeApplying, only include those claims if they are clearly present in the original candidate resume.

Contact Rules:
- Extract contact details from the candidate resume only.
- If full name is present, return it.
- If city/state/country is present, return it.
- If phone is missing, return "[Phone]".
- If email is missing, return "[Email]".
- If LinkedIn is missing, return "[LinkedIn]".
- Do not create fake phone numbers, emails, or LinkedIn URLs.

Headline Rules:
- Keep headline concise and recruiter-friendly.
- Maximum 85 characters.
- Use this style:
  "Target Role | Key Strength | Relevant Domain"
- Do not use more than 3 parts separated by pipes.
- Do not include exaggerated titles.
- Do not include unsupported tools.
- Do not use phrases like "expert" unless strongly supported by the resume.

Summary Rules:
- Write one strong professional summary paragraph.
- Keep it natural, direct, and recruiter-friendly.
- Avoid generic AI-sounding phrases.
- Mention years of experience only if present in the candidate resume.
- Mention measurable achievements only if present in the candidate resume.
- Do not overfit the summary to tools or platforms that are not in the candidate resume.
- If the job has tools the candidate has not used, describe transferable experience instead of claiming tool experience.
- Do not use phrases like "proven track record", "dynamic", "passionate", "synergy", "results-oriented", or "leverage" unless they sound natural and are clearly supported.

Skills Rules:
- Return 14–20 skills maximum.
- Skills must be short skill names only.
- Do not include explanations, notes, markdown, asterisks, or comments.
- Do not include phrases like "eager to learn", "eager to leverage", "transferable skills", or "familiar with".
- Do not include unsupported tools, platforms, or software unless they appear in the candidate resume.
- If a job tool is not in the candidate resume, do not add it as a skill.
- If a skill is only transferable, use the broader supported skill instead of the exact unsupported job keyword.
- Skills should be clean noun phrases such as:
  "Business Analysis", "Requirements Gathering", "SDLC", "UAT", "Stakeholder Management".
- Avoid duplicate skills or near-duplicates.
- Do not include long skills that exceed 45 characters unless necessary.

Experience Rules:
For each role:
- Preserve company name from the candidate resume.
- Preserve job title from the candidate resume.
- Preserve dates from the candidate resume.
- Preserve location from the candidate resume.
- If company is missing, return "[Company]".
- If title is missing, return "[Job Title]".
- If dates are missing, return "[Dates]".
- If location is missing, return "[Location]".
- Tailor only the bullets to the target job while staying truthful.
- Do not create fake experience.
- Do not create fake dates.
- Do not create fake locations.
- Do not create fake job titles.
- Preserve the meaning of the candidate's original responsibilities.
- Do not imply ownership, leadership, implementation, management, or hands-on tool experience unless the resume supports it.
- If the candidate only supported, assisted, coordinated, documented, or participated in something, keep that level of ownership.
- Keep role order the same as the candidate resume, most recent first.
- Do not remove older roles unless the candidate resume has too many roles and the role is irrelevant.
- Preserve important technical and business achievements from the original resume.

Education Rules:
- Preserve institution name.
- Preserve degree.
- Preserve field of study.
- Preserve full education date range if present, for example "February 2016 - January 2020".
- If only graduation year is present, return that year.
- If education dates are missing, return "[Dates]".
- If institution is missing, return "[Institution]".
- If degree is missing, return "[Degree]".
- If field of study is missing, return "[Field of Study]".
- Do not invent graduation dates, institution names, or degree details.
- Put the full date range in "dates".
- Use "year" only if only a single year is available.

Certification Rules:
- Return certifications only if present in the candidate resume.
- Do not invent certifications.
- If no certifications are present, return an empty array.

Return only this JSON structure:

{
  "contact": {
    "fullName": "",
    "location": "",
    "phone": "[Phone]",
    "email": "[Email]",
    "linkedin": "[LinkedIn]"
  },
  "headline": "",
  "professionalSummary": "",
  "coreSkills": [],
  "professionalExperience": [
    {
      "company": "",
      "title": "",
      "dates": "",
      "location": "",
      "bullets": []
    }
  ],
  "education": [
    {
      "institution": "",
      "degree": "",
      "field": "",
      "dates": "",
      "year": "",
      "location": ""
    }
  ],
  "certifications": []
}
`;

  const result = await generateContent(prompt);
  return cleanAndParseJSON(result);
};

const generateCoverLetter = async (
  jobDescription,
  resume,
  analysis,
  tailoredResume
) => {

const prompt = `
You are a professional cover letter writer and recruiter.

Generate a tailored cover letter using the job description, candidate resume, CV analysis, and tailored resume.

Job Description:
${jobDescription}

Candidate Resume:
${resume}

CV Analysis:
${JSON.stringify(analysis, null, 2)}

Tailored Resume:
${JSON.stringify(tailoredResume, null, 2)}

Rules:
- Return valid JSON only.
- Do not include markdown.
- Generate only the cover letter.
- Cover letter must be first person.
- Cover letter should be between 100 and 160 words.
- Count the words before responding.
- If the cover letter is under 100 words, expand it only with supported evidence.
- If the cover letter is over 160 words, shorten it.
- Do not mention the word count in the response.
- Cover letter must NOT start with "I am writing", "I am excited to apply", "I am writing to express", or "I am excited to express".
- Start with a strong, direct sentence about the candidate's value.
- Good opening example style: "My experience leading enterprise system transformations aligns strongly with this role."
- Do not invent experience, fake tools, fake certifications, or fake metrics.
- Use only evidence from the candidate resume and tailored resume.
- Make it confident, natural, and recruiter-friendly.
- Align the candidate’s background with the target role.
- Do not sound generic.
- Do not overuse buzzwords.
- If the candidate does not have direct domain experience, position transferable experience honestly.
- Do not oversell. Sound confident but grounded.
- Do not claim direct experience with any tool, platform, domain, or responsibility unless it is clearly present in the candidate resume.
- If experience is transferable, phrase it as transferable experience instead of direct experience.
- Avoid phrases like "proven track record", "dynamic", "passionate", "synergy", "results-oriented", and "leverage".
- The letter should sound like a real candidate, not a generic corporate template.
- Do not include greeting, date, address block, sign-off, or signature. Return only the body text; the frontend formats the letter.

Final check before responding:
- The response must be valid JSON.
- The cover letter must be 100-160 words.
- The cover letter must be written in first person.
- The cover letter must not invent experience.
- The first sentence must not start with "I am writing", "I am excited", "I am writing to express", or "I am excited to express".
- Before responding, check the first 5 words of the cover letter. If they include "I am writing" or "I am excited", rewrite the opening.
- Before responding, check every claim and remove anything the candidate could not defend in an interview.

Return only this JSON:

{
  "coverLetter": ""
}
`;

  const result = await generateContent(prompt);
  return cleanAndParseJSON(result);
};

module.exports = { analyzeCV, generateTailoredResume, generateCoverLetter };
