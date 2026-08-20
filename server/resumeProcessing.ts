import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export type AcceptedResume = {
  contentType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  extension: "pdf" | "docx";
};

function extensionFromName(filename: string) {
  return filename.split(".").pop()?.toLocaleLowerCase() ?? "";
}

export function validateResumeUpload(
  filename: string,
  contentType: string,
  bytes: Buffer,
): AcceptedResume {
  if (!filename || filename.length > 180) throw new Error("A valid resume filename is required.");
  if (bytes.length === 0) throw new Error("The uploaded file is empty.");
  if (bytes.length > MAX_RESUME_BYTES) throw new Error("Resume files must be 5 MB or smaller.");

  const extension = extensionFromName(filename);
  const isPdf = extension === "pdf" && bytes.subarray(0, 5).toString() === "%PDF-";
  const isDocx = extension === "docx" && bytes.subarray(0, 2).toString() === "PK";

  if (isPdf && (contentType === "application/pdf" || contentType === "application/octet-stream")) {
    return { extension: "pdf", contentType: "application/pdf" };
  }
  if (
    isDocx &&
    (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      contentType === "application/octet-stream")
  ) {
    return {
      extension: "docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  throw new Error("Only valid PDF or DOCX resume files are accepted.");
}

export async function extractResumeText(file: Buffer, format: AcceptedResume): Promise<string> {
  let text = "";

  if (format.extension === "pdf") {
    const parser = new PDFParse({ data: file });
    try {
      text = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  } else {
    text = (await mammoth.extractRawText({ buffer: file })).value;
  }

  const normalized = text.replace(/\u0000/g, "").replace(/\r/g, "").trim();
  if (normalized.length < 40) {
    throw new Error("The resume could not be read. Please upload a text-based PDF or DOCX file.");
  }

  return normalized.slice(0, 120_000);
}
