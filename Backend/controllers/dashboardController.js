const supabase = require("../config/supabase");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle,
} = require("docx");
const PDFDocument = require("pdfkit");

const isDev = process.env.NODE_ENV !== "production";

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      { count: total },
      { count: pending },
      { count: approved },
      { count: applied },
      { count: skipped },
    ] = await Promise.all([
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending_review"),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "approved"),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "applied"),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "skipped"),
    ]);

    return res.json({ success: true, data: { total, pending, approved, applied, skipped } });
  } catch (err) {
    console.error("getStats error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to fetch stats.", ...(isDev && { details: err.message }) });
  }
};

// ─── GET /api/dashboard/applications ─────────────────────────────────────────
const listApplications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // First get all matching listing IDs (with search filter applied at DB level)
    let listingQuery = supabase
      .from("job_listings")
      .select("id")
      .eq("user_id", userId);

    if (search) {
      // ilike is case-insensitive; use OR across title and company
      listingQuery = listingQuery.or(
        `title.ilike.%${search}%,company.ilike.%${search}%`
      );
    }

    const { data: matchingListings, error: listingError } = await listingQuery;
    if (listingError) throw new Error(listingError.message);
    const matchingListingIds = (matchingListings || []).map((l) => l.id);

    // If searching and no listings match, return empty immediately
    if (search && matchingListingIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, pages: 0 },
      });
    }

    let query = supabase
      .from("applications")
      .select(`
        id, status, notes, created_at, approved_at, applied_at, listing_id,
        job_listings ( id, title, company, location, source, url, posted_at )
      `, { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq("status", status);
    if (search && matchingListingIds.length > 0) {
      query = query.in("listing_id", matchingListingIds);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    let results = data || [];

    // Fetch match scores for these listings in one query
    if (results.length > 0) {
      const listingIds = results.map((a) => a.listing_id).filter(Boolean);
      const { data: matches } = await supabase
        .from("job_matches")
        .select("listing_id, match_score, decision, analysis")
        .eq("user_id", userId)
        .in("listing_id", listingIds);

      const matchMap = {};
      (matches || []).forEach((m) => { matchMap[m.listing_id] = m; });

      results = results.map((a) => ({
        ...a,
        job_matches: matchMap[a.listing_id] || null,
      }));
    }

    return res.json({
      success: true,
      data: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count ?? 0,
        pages: Math.ceil((count ?? 0) / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("listApplications error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to fetch applications.", ...(isDev && { details: err.message }) });
  }
};

// ─── GET /api/dashboard/applications/:id ─────────────────────────────────────
const getApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("applications")
      .select(`
        id, status, tailored_resume, cover_letter, notes, error_message,
        created_at, approved_at, applied_at, updated_at, listing_id,
        job_listings ( id, title, company, location, source, url, description, job_type, salary_range, posted_at )
      `)
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: "Application not found." });
    }

    // Fetch match separately
    const { data: match } = await supabase
      .from("job_matches")
      .select("match_score, decision, analysis, scored_at")
      .eq("user_id", userId)
      .eq("listing_id", data.listing_id)
      .single();

    return res.json({ success: true, data: { ...data, job_matches: match || null } });
  } catch (err) {
    console.error("getApplication error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to fetch application.", ...(isDev && { details: err.message }) });
  }
};

// ─── PATCH /api/dashboard/applications/:id ────────────────────────────────────
const updateApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { status, notes } = req.body;

    const ALLOWED = ["pending_review", "approved", "skipped", "applied", "failed"];
    if (!status || !ALLOWED.includes(status)) {
      return res.status(400).json({ success: false, error: `status must be one of: ${ALLOWED.join(", ")}` });
    }

    // Fetch current status to validate transition
    const { data: current, error: fetchError } = await supabase
      .from("applications")
      .select("status")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !current) {
      return res.status(404).json({ success: false, error: "Application not found." });
    }

    // Valid transitions
    const TRANSITIONS = {
      pending_review: ["approved", "skipped"],
      approved:       ["applied", "skipped", "pending_review"],
      skipped:        ["pending_review"],
      applied:        [],   // terminal — cannot move back
      failed:         ["pending_review"],
    };

    const allowed = TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot transition from "${current.status}" to "${status}".`,
      });
    }

    const patch = { status };
    if (notes !== undefined) patch.notes = notes;
    // Set timestamps on forward transitions; clear them on backward transitions
    if (status === "approved") patch.approved_at = new Date().toISOString();
    if (status === "applied") patch.applied_at = new Date().toISOString();
    if (status === "pending_review") { patch.approved_at = null; patch.applied_at = null; }
    if (status === "skipped") { patch.approved_at = null; patch.applied_at = null; }

    const { data, error } = await supabase
      .from("applications")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, status, approved_at, applied_at, notes")
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: "Application not found." });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error("updateApplication error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to update application.", ...(isDev && { details: err.message }) });
  }
};

// ─── Helpers: build DOCX ─────────────────────────────────────────────────────

function buildResumeDocx(resume, jobTitle, company) {
  const r = resume || {};
  const c = r.contact || {};

  const sections = [];

  // Name + contact block
  if (c.fullName) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: c.fullName, bold: true, size: 36 })],
      alignment: AlignmentType.CENTER,
    }));
  }
  const contactLine = [c.location, c.email, c.phone, c.linkedin].filter(Boolean).join("  |  ");
  if (contactLine) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: contactLine, size: 20, color: "666666" })],
      alignment: AlignmentType.CENTER,
    }));
  }
  sections.push(new Paragraph({ text: "" }));

  // Targeted for
  if (jobTitle && company) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: `Tailored for: ${jobTitle} at ${company}`, italics: true, size: 20, color: "888888" })],
      alignment: AlignmentType.CENTER,
    }));
    sections.push(new Paragraph({ text: "" }));
  }

  const sectionHeader = (text) => new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22 })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" } },
    spacing: { before: 200, after: 100 },
  });

  // Headline
  if (r.headline) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: r.headline, bold: true, size: 24, color: "2563EB" })],
      spacing: { after: 100 },
    }));
  }

  // Summary
  if (r.professionalSummary) {
    sections.push(sectionHeader("Professional Summary"));
    sections.push(new Paragraph({ children: [new TextRun({ text: r.professionalSummary, size: 22 })], spacing: { after: 100 } }));
  }

  // Skills
  if (r.coreSkills?.length) {
    sections.push(sectionHeader("Core Skills"));
    sections.push(new Paragraph({ children: [new TextRun({ text: r.coreSkills.join("  ·  "), size: 22 })], spacing: { after: 100 } }));
  }

  // Experience
  if (r.professionalExperience?.length) {
    sections.push(sectionHeader("Professional Experience"));
    for (const role of r.professionalExperience) {
      sections.push(new Paragraph({
        children: [
          new TextRun({ text: role.title, bold: true, size: 22 }),
          new TextRun({ text: `  —  ${role.company}`, size: 22, color: "444444" }),
          new TextRun({ text: `   ${role.dates}`, size: 20, color: "888888" }),
        ],
        spacing: { before: 120, after: 40 },
      }));
      if (role.location) {
        sections.push(new Paragraph({ children: [new TextRun({ text: role.location, size: 20, color: "888888", italics: true })], spacing: { after: 60 } }));
      }
      for (const bullet of (role.bullets || [])) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: bullet, size: 21 })],
          bullet: { level: 0 },
          spacing: { after: 40 },
        }));
      }
    }
  }

  // Education
  if (r.education?.length) {
    sections.push(sectionHeader("Education"));
    for (const edu of r.education) {
      sections.push(new Paragraph({
        children: [
          new TextRun({ text: `${edu.degree} in ${edu.field}`, bold: true, size: 22 }),
          new TextRun({ text: `  —  ${edu.institution}`, size: 22, color: "444444" }),
          new TextRun({ text: `   ${edu.dates || edu.year || ""}`, size: 20, color: "888888" }),
        ],
        spacing: { before: 100, after: 60 },
      }));
    }
  }

  // Certifications
  if (r.certifications?.length) {
    sections.push(sectionHeader("Certifications"));
    for (const cert of r.certifications) {
      sections.push(new Paragraph({ children: [new TextRun({ text: cert, size: 22 })], bullet: { level: 0 }, spacing: { after: 40 } }));
    }
  }

  return new Document({
    sections: [{ properties: {}, children: sections }],
  });
}

// ─── Helpers: build PDF ───────────────────────────────────────────────────────

function buildResumePdf(resume, jobTitle, company, res) {
  const r = resume || {};
  const c = r.contact || {};
  const doc = new PDFDocument({ margin: 50, size: "LETTER" });
  doc.pipe(res);

  const LINE_COLOR = "#CCCCCC";
  const PRIMARY = "#2563EB";
  const MUTED = "#666666";

  // Name
  if (c.fullName) {
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#111111").text(c.fullName, { align: "center" });
  }
  const contactLine = [c.location, c.email, c.phone, c.linkedin].filter(Boolean).join("  |  ");
  if (contactLine) doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(contactLine, { align: "center" });
  if (jobTitle && company) {
    doc.moveDown(0.3).font("Helvetica-Oblique").fontSize(10).fillColor("#888888")
      .text(`Tailored for: ${jobTitle} at ${company}`, { align: "center" });
  }
  doc.moveDown(0.5);

  const sectionHeader = (title) => {
    doc.moveDown(0.6)
      .font("Helvetica-Bold").fontSize(11).fillColor("#222222").text(title.toUpperCase());
    const y = doc.y + 3;
    doc.moveTo(50, y).lineTo(562, y).strokeColor(LINE_COLOR).lineWidth(1).stroke();
    doc.moveDown(0.4);
  };

  // Headline
  if (r.headline) {
    doc.font("Helvetica-Bold").fontSize(12).fillColor(PRIMARY).text(r.headline);
    doc.moveDown(0.4);
  }

  // Summary
  if (r.professionalSummary) {
    sectionHeader("Professional Summary");
    doc.font("Helvetica").fontSize(10).fillColor("#333333").text(r.professionalSummary, { align: "justify" });
  }

  // Skills
  if (r.coreSkills?.length) {
    sectionHeader("Core Skills");
    doc.font("Helvetica").fontSize(10).fillColor("#333333").text(r.coreSkills.join("  ·  "));
  }

  // Experience
  if (r.professionalExperience?.length) {
    sectionHeader("Professional Experience");
    for (const role of r.professionalExperience) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text(role.title, { continued: true });
      doc.font("Helvetica").fillColor(MUTED).text(`   ${role.company}  ·  ${role.location || ""}  ·  ${role.dates}`, { align: "right" });
      for (const bullet of (role.bullets || [])) {
        doc.font("Helvetica").fontSize(10).fillColor("#333333")
          .text(`• ${bullet}`, { indent: 10, align: "justify" });
      }
      doc.moveDown(0.4);
    }
  }

  // Education
  if (r.education?.length) {
    sectionHeader("Education");
    for (const edu of r.education) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111")
        .text(`${edu.degree} in ${edu.field}`, { continued: true });
      doc.font("Helvetica").fillColor(MUTED)
        .text(`   ${edu.institution}  ·  ${edu.dates || edu.year || ""}`, { align: "right" });
    }
  }

  // Certifications
  if (r.certifications?.length) {
    sectionHeader("Certifications");
    for (const cert of r.certifications) {
      doc.font("Helvetica").fontSize(10).fillColor("#333333").text(`• ${cert}`, { indent: 10 });
    }
  }

  doc.end();
}

function buildCoverPdf(coverLetter, jobTitle, company, res) {
  const doc = new PDFDocument({ margin: 72, size: "LETTER" });
  doc.pipe(res);
  if (jobTitle && company) {
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#111111").text(`Cover Letter`);
    doc.font("Helvetica").fontSize(11).fillColor("#666666").text(`${jobTitle} at ${company}`);
    doc.moveDown(1);
  }
  doc.font("Helvetica").fontSize(11).fillColor("#222222")
    .text(coverLetter || "", { align: "justify", lineGap: 4 });
  doc.end();
}

// ─── GET /api/dashboard/applications/:id/download ────────────────────────────
const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // resume-docx | resume-pdf | cover-docx | cover-pdf
    const userId = req.user.id;

    const VALID = ["resume-docx", "resume-pdf", "cover-docx", "cover-pdf"];
    if (!VALID.includes(type)) {
      return res.status(400).json({ success: false, error: `type must be one of: ${VALID.join(", ")}` });
    }

    const { data, error } = await supabase
      .from("applications")
      .select("tailored_resume, cover_letter, job_listings(title, company)")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: "Application not found." });
    }

    const jobTitle = data.job_listings?.title || "Position";
    const company = data.job_listings?.company || "Company";
    const safeName = `${jobTitle.replace(/[^a-z0-9]/gi, "_")}_${company.replace(/[^a-z0-9]/gi, "_")}`;

    // Guard: ensure the requested content exists
    if ((type === "resume-docx" || type === "resume-pdf") && !data.tailored_resume) {
      return res.status(400).json({ success: false, error: "Tailored resume has not been generated for this application yet." });
    }
    if ((type === "cover-docx" || type === "cover-pdf") && !data.cover_letter) {
      return res.status(400).json({ success: false, error: "Cover letter has not been generated for this application yet." });
    }

    if (type === "resume-docx") {
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}_Resume.docx"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      const doc = buildResumeDocx(data.tailored_resume, jobTitle, company);
      const buffer = await Packer.toBuffer(doc);
      return res.send(buffer);
    }

    if (type === "resume-pdf") {
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}_Resume.pdf"`);
      res.setHeader("Content-Type", "application/pdf");
      buildResumePdf(data.tailored_resume, jobTitle, company, res);
      return;
    }

    if (type === "cover-docx") {
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}_CoverLetter.docx"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      const coverText = data.cover_letter || "";
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({ children: [new TextRun({ text: "Cover Letter", bold: true, size: 32 })], spacing: { after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: `${jobTitle} at ${company}`, size: 24, color: "666666", italics: true })], spacing: { after: 300 } }),
            ...coverText.split("\n").map((line) =>
              new Paragraph({ children: [new TextRun({ text: line, size: 24 })], spacing: { after: 120 } })
            ),
          ],
        }],
      });
      const buffer = await Packer.toBuffer(doc);
      return res.send(buffer);
    }

    if (type === "cover-pdf") {
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}_CoverLetter.pdf"`);
      res.setHeader("Content-Type", "application/pdf");
      buildCoverPdf(data.cover_letter, jobTitle, company, res);
      return;
    }
  } catch (err) {
    console.error("downloadDocument error:", err.message);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: "Failed to generate document.", ...(isDev && { details: err.message }) });
    }
  }
};

module.exports = { getStats, listApplications, getApplication, updateApplication, downloadDocument };
