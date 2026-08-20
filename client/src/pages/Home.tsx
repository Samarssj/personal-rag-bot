import { AIChatBox, type Message as ChatMessage } from "@/components/AIChatBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Bot,
  ClipboardCheck,
  CheckCircle2,
  FileText,
  Loader2,
  LockKeyhole,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Scope = "samar" | "uploaded";
type SessionDetails = {
  shareToken: string;
  originalFilename: string;
  status: "ready";
  expiresAt: string;
  deleteToken?: string;
};

type JobMatchResponse = {
  markdown: string;
  evidenceLabels: string[];
};

function newAssistantMessage(): ChatMessage {
  return { role: "assistant", content: "", sources: [] };
}

function parseSseEvents(buffer: string) {
  const fragments = buffer.split(/\r?\n\r?\n/);
  return { complete: fragments.slice(0, -1), rest: fragments[fragments.length - 1] ?? "" };
}

function looksLikeJobDescription(value: string) {
  const normalized = value.trim();
  return normalized.length >= 180 && (/\b(job description|responsibilities|requirements|qualifications|must have|what you.ll do|what you will do|we are looking|role overview|preferred skills|minimum qualifications)\b/i.test(normalized) || normalized.length > 1_200);
}

export default function Home() {
  const [scope, setScope] = useState<Scope>("samar");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isJobMatching, setIsJobMatching] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [session, setSession] = useState<SessionDetails | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTitle = scope === "samar" ? "Ask about Samar" : "Ask about an uploaded resume";
  const isBusy = isStreaming || isJobMatching;
  const suggestedPrompts = useMemo(
    () =>
      scope === "samar"
        ? ["How old are you and when is your birthday?", "Which GitHub projects have you built?", "Where did you study?"]
        : ["Summarize this candidate's experience", "What are this candidate's strongest skills?", "Which projects are most relevant to an AI role?"],
    [scope],
  );

  const resetConversation = () => {
    if (isBusy) return;
    setMessages([]);
  };

  const switchScope = (nextScope: Scope) => {
    if (isBusy) return;
    if (nextScope === "uploaded" && !session) {
      fileInputRef.current?.click();
      return;
    }
    setScope(nextScope);
    setMessages([]);
    setJobDescription("");
  };

  const uploadResume = (file: File) => {
    const supported = file.name.toLocaleLowerCase().endsWith(".pdf") || file.name.toLocaleLowerCase().endsWith(".docx");
    if (!supported) return toast.error("Please select a PDF or DOCX resume.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Resume files must be 5 MB or smaller.");

    setIsProcessing(true);
    setUploadProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/resume/upload");
    xhr.setRequestHeader("x-file-name", file.name);
    xhr.setRequestHeader("x-file-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => {
      setIsProcessing(false);
      setUploadProgress(null);
      toast.error("The upload could not be completed. Please try again.");
    };
    xhr.onload = () => {
      setIsProcessing(false);
      setUploadProgress(null);
      try {
        const payload = JSON.parse(xhr.responseText) as SessionDetails & { error?: string; sharePath?: string };
        if (xhr.status < 200 || xhr.status >= 300) throw new Error(payload.error ?? "The resume could not be processed.");
        setSession(payload);
        if (payload.deleteToken) window.sessionStorage.setItem(`resume-delete:${payload.shareToken}`, payload.deleteToken);
        setScope("uploaded");
        setMessages([]);
        toast.success("Resume indexed for this temporary browser session.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "The resume could not be processed.");
      }
    };
    xhr.send(file);
  };

  const deleteSession = async () => {
    if (!session || isStreaming) return;
    try {
      const response = await fetch(`/api/resume/session/${encodeURIComponent(session.shareToken)}`, {
        method: "DELETE",
        headers: { "x-resume-delete-token": session.deleteToken ?? "" },
      });
      if (!response.ok) throw new Error("The session could not be deleted.");
      setSession(null);
      window.sessionStorage.removeItem(`resume-delete:${session.shareToken}`);
      setScope("samar");
      setMessages([]);
      toast.success("The uploaded resume session has been deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete the session.");
    }
  };

  const analyzeJobDescription = async (rawJobDescription: string) => {
    const submittedDescription = rawJobDescription.trim();
    if (isBusy || (scope === "uploaded" && !session)) return;
    if (submittedDescription.length < 80) {
      toast.error("Please paste a fuller job description before requesting a match estimate.");
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: "Please compare the active resume with the job description I submitted and give me an ATS-style match estimate." };
    setMessages(current => [...current, userMessage, newAssistantMessage()]);
    setIsJobMatching(true);

    try {
      const response = await fetch("/api/job-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, shareToken: session?.shareToken, jobDescription: submittedDescription }),
      });
      const payload = (await response.json().catch(() => null)) as (JobMatchResponse & { error?: string }) | null;
      if (!response.ok || !payload?.markdown) throw new Error(payload?.error ?? "Unable to compare this resume with the job description.");
      setMessages(current => {
        const next = [...current];
        const finalIndex = next.length - 1;
        if (next[finalIndex]?.role === "assistant") next[finalIndex] = { ...next[finalIndex], content: payload.markdown, sources: payload.evidenceLabels };
        return next;
      });
      setJobDescription("");
    } catch (error) {
      setMessages(current => {
        const next = [...current];
        const finalIndex = next.length - 1;
        if (next[finalIndex]?.role === "assistant") next[finalIndex] = { ...next[finalIndex], content: "I couldn't complete the job-match estimate. Please try again." };
        return next;
      });
      toast.error(error instanceof Error ? error.message : "Unable to compare the resume with this job description.");
    } finally {
      setIsJobMatching(false);
    }
  };

  const sendMessage = async (question: string) => {
    if (isBusy || (scope === "uploaded" && !session)) return;
    if (looksLikeJobDescription(question)) {
      await analyzeJobDescription(question);
      return;
    }
    const history = messages.filter(message => message.content.trim()).slice(-8);
    const userMessage: ChatMessage = { role: "user", content: question };
    setMessages(current => [...current, userMessage, newAssistantMessage()]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, shareToken: session?.shareToken, question, history }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Unable to start a response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const processEvent = (event: string) => {
        const type = event.split(/\r?\n/).find(line => line.startsWith("event:"))?.replace("event:", "").trim();
        const raw = event.split(/\r?\n/).find(line => line.startsWith("data:"))?.replace(/^data:\s*/, "");
        if (!type || !raw) return;
        const payload = JSON.parse(raw) as { delta?: string; labels?: string[]; message?: string };
        if (type === "token" && payload.delta) {
          setMessages(current => {
            const next = [...current];
            const finalIndex = next.length - 1;
            if (next[finalIndex]?.role === "assistant") next[finalIndex] = { ...next[finalIndex], content: `${next[finalIndex].content}${payload.delta}` };
            return next;
          });
        }
        if (type === "sources" && payload.labels) {
          setMessages(current => {
            const next = [...current];
            const finalIndex = next.length - 1;
            if (next[finalIndex]?.role === "assistant") next[finalIndex] = { ...next[finalIndex], sources: payload.labels };
            return next;
          });
        }
        if (type === "error") throw new Error(payload.message ?? "The response stream was interrupted.");
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseEvents(buffer);
        buffer = parsed.rest;
        parsed.complete.forEach(processEvent);
      }
      if (buffer.trim()) processEvent(buffer);
    } catch (error) {
      setMessages(current => {
        const next = [...current];
        const finalIndex = next.length - 1;
        if (next[finalIndex]?.role === "assistant" && !next[finalIndex].content) {
          next[finalIndex] = { ...next[finalIndex], content: "I couldn't complete that response. Please try again." };
        }
        return next;
      });
      toast.error(error instanceof Error ? error.message : "Unable to generate a response.");
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#12090a] text-[#f7e9df]">
      <main className="container py-5 sm:py-8 lg:py-10">
        <header className="mb-6 flex flex-col gap-5 border-b border-[#b84a40]/30 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#f1a073]">
              <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-lg bg-[#b72632] font-serif text-sm font-bold text-[#fff5eb] shadow-[0_0_22px_rgba(217,54,54,0.38)]">S</span>
              Samar / Portfolio AI
            </div>
            <h1 className="max-w-3xl font-serif text-3xl font-semibold tracking-[-0.05em] text-[#fff3ea] sm:text-5xl">A conversation, grounded in my work.</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#d8a99d]"><LockKeyhole className="size-4 text-[#ff8068]" /> Gemini runs server-side. Sources stay scoped.</div>
        </header>

        <section className="mb-7 grid overflow-hidden rounded-[2rem] border border-[#9f3b36]/55 bg-[#1a0b0c] shadow-[0_30px_80px_-38px_rgba(225,42,35,0.76)] sm:grid-cols-[1fr_auto]">
          <div className="order-2 flex flex-col justify-end p-6 sm:order-1 sm:p-10 lg:p-12">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-[#f5a072]">Build. Learn. Evolve.</p>
            <p className="max-w-xl font-serif text-2xl leading-tight text-[#fff2e8] sm:text-3xl">A portfolio AI shaped around the work I do, the problems I solve, and the stories behind them.</p>
            <div className="mt-6 h-px w-20 bg-[#c84b42]" />
            <p className="mt-4 max-w-md text-sm leading-6 text-[#cba399]">Ask about my background, explore projects from my GitHub, or use the job match to understand how my experience aligns with a role.</p>
          </div>
          <figure className="order-1 mx-auto aspect-[3/4] w-full max-w-[375px] bg-[#0b0607] sm:order-2 sm:mx-0">
            <div className="relative h-full overflow-hidden rounded-[1.4rem] border border-[#7f302d]/55 bg-[#17090a]">
              <img src="https://raw.githubusercontent.com/Samarssj/samar-portfolio1/main/client/public/samar-profile.webp" alt="Samar standing beneath warm red architectural lighting" className="h-full w-full object-contain object-center brightness-105 contrast-95 saturate-100" />
            </div>
          </figure>
        </section>

        <div className="grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card className="overflow-hidden border-[#943933]/45 bg-[#1a0d0e]/90 shadow-[0_18px_55px_-32px_rgba(0,0,0,0.9)] backdrop-blur">
              <CardContent className="p-3">
                <p className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#b98b82]">Knowledge source</p>
                <button
                  onClick={() => switchScope("samar")}
                  disabled={isBusy}
                  className={`mb-1 w-full rounded-xl p-3 text-left transition-all ${scope === "samar" ? "bg-[#b72632] text-[#fff7ee] shadow-[0_12px_25px_-14px_rgba(235,58,53,0.9)]" : "text-[#e8c9bd] hover:bg-[#351416]"}`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold"><Bot className="size-4" /> Ask about Samar</span>
                  <span className={`mt-1 block text-xs ${scope === "samar" ? "text-[#ffe0cf]" : "text-[#ae817a]"}`}>My experience, projects, skills and story.</span>
                </button>
                <button
                  onClick={() => switchScope("uploaded")}
                  disabled={isBusy || isProcessing}
                  className={`w-full rounded-xl p-3 text-left transition-all ${scope === "uploaded" ? "bg-[#b72632] text-[#fff7ee] shadow-[0_12px_25px_-14px_rgba(235,58,53,0.9)]" : "text-[#e8c9bd] hover:bg-[#351416]"}`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold"><FileText className="size-4" /> Ask about a resume</span>
                  <span className={`mt-1 block text-xs ${scope === "uploaded" ? "text-[#ffe0cf]" : "text-[#ae817a]"}`}>An isolated, temporary document session.</span>
                </button>
              </CardContent>
            </Card>

            <Card className="border-[#77302f]/60 bg-[#0c0708] text-white shadow-[0_18px_55px_-32px_rgba(0,0,0,0.9)]">
              <CardContent className="p-5">
                <Badge className="mb-3 border-[#e85d52]/35 bg-[#7a1f26]/35 text-[#ffd1bc] hover:bg-[#7a1f26]/35">Privacy by design</Badge>
                <p className="text-sm font-medium leading-6 text-[#f7e5dd]">Each conversation retrieves from exactly one knowledge base—never both.</p>
                <div className="mt-4 space-y-3 text-xs text-[#caa69e]">
                  <p className="flex gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#ff7865]" />Source labels are shown with every answer.</p>
                  <p className="flex gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#ff7865]" />Uploaded resume text is treated as data, never instructions.</p>
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="min-w-0">
            <Card className="overflow-hidden border-[#903732]/45 bg-[#160b0c]/95 shadow-[0_26px_75px_-35px_rgba(0,0,0,0.92)] backdrop-blur">
              <div className="flex flex-col gap-3 border-b border-[#7f312d]/50 bg-[#210d0f]/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2"><h2 className="text-lg font-semibold tracking-tight text-[#fff0e6]">{activeTitle}</h2>{scope === "uploaded" && <Badge variant="secondary" className="bg-[#5d2220] text-[#ffc4a7]">Session scoped</Badge>}</div>
                  <p className="mt-0.5 text-xs text-[#ba8c83]">{scope === "samar" ? "Answers are written in Samar’s first-person voice." : session ? `${session.originalFilename} · temporary session, removed on server restart` : "Upload a PDF or DOCX to begin."}</p>
                </div>
                <Button variant="outline" size="sm" onClick={resetConversation} disabled={messages.length === 0 || isBusy} className="border-[#9e423b] bg-[#291112] text-[#f5d4c5] hover:bg-[#451718] hover:text-white">New chat</Button>
              </div>

              {scope === "uploaded" && !session && (
                <div className="mx-5 mt-5 rounded-2xl border border-dashed border-[#ad4840]/55 bg-[#250e10]/75 p-6 text-center">
                  <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-[#ae2d36] text-white shadow-[0_0_28px_rgba(225,57,55,0.38)]"><Upload className="size-5" /></div>
                  <h3 className="font-semibold text-[#fff0e7]">Start a private resume session</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#c79d94]">Upload a text-based PDF or DOCX of up to 5 MB. The file is parsed in a temporary, private browser session and is removed when the server restarts.</p>
                  <Button className="mt-4 bg-[#b92834] text-white hover:bg-[#d64042]" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {isProcessing ? "Processing resume" : "Choose resume"}
                  </Button>
                  {uploadProgress !== null && <div className="mx-auto mt-4 max-w-sm"><Progress value={uploadProgress} className="h-2" /><p className="mt-1 text-xs text-[#c79d94]">Uploading {uploadProgress}%</p></div>}
                </div>
              )}

              {scope === "uploaded" && session && (
                <div className="mx-5 mt-5 flex flex-col gap-3 rounded-xl border border-[#9b453c]/55 bg-[#2a1112] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#6e2425] text-[#ffc4a4]"><FileText className="size-4" /></div><span className="truncate text-sm font-medium text-[#f6d9cb]">{session.originalFilename}</span></div>
                  <div className="flex shrink-0 gap-2">{session.deleteToken && <Button variant="outline" size="sm" className="border-[#a65045] bg-[#1b0b0c] text-[#f5c3ae] hover:bg-[#441718]" onClick={deleteSession}><Trash2 className="size-3.5" />Delete</Button>}</div>
                </div>
              )}

              {(scope === "samar" || session) && (
                <div className="mx-5 mt-5 rounded-2xl border border-[#9d3f38]/50 bg-[linear-gradient(120deg,rgba(82,22,24,0.55),rgba(31,11,12,0.85))] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div><div className="flex items-center gap-2 text-sm font-semibold text-[#ffe7d9]"><ClipboardCheck className="size-4 text-[#ff8068]" /> Job description match</div><p className="mt-1 max-w-xl text-xs leading-5 text-[#d7aaa0]">Paste a job description for a human-readable ATS-style estimate. It compares only the active {scope === "samar" ? "Samar profile" : "uploaded resume"} and explains evidence, gaps, and tailoring ideas.</p></div>
                    <Badge variant="outline" className="w-fit border-[#bd574b] bg-[#230d0e] text-[#f6b59a]">Scope locked</Badge>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Textarea value={jobDescription} onChange={event => setJobDescription(event.target.value)} placeholder="Paste the role responsibilities, requirements, and preferred skills…" className="min-h-24 resize-y border-[#8f3a35] bg-[#15090a] text-[#f6ded2] placeholder:text-[#9a6f69] focus-visible:ring-[#e05247]" disabled={isBusy} /><Button onClick={() => void analyzeJobDescription(jobDescription)} disabled={isBusy || jobDescription.trim().length < 80} className="shrink-0 self-end bg-[#bd2f38] text-white hover:bg-[#d94544]"><ClipboardCheck className="size-4" />{isJobMatching ? "Comparing…" : "Estimate match"}</Button></div>
                </div>
              )}

              <AIChatBox
                  messages={messages}
                  onSendMessage={sendMessage}
                  isLoading={isBusy}
                  height="590px"
                  className="m-5 border-[#7f312e]/55 bg-[#11090a] shadow-[0_18px_55px_-30px_rgba(0,0,0,0.88)]"
                  placeholder={scope === "samar" ? "Ask about my work or paste a job description…" : session ? "Ask about this candidate or paste a job description…" : "Upload a resume to enable chat…"}
                  emptyStateMessage={scope === "samar" ? "Ask me something about my work, or paste a job description to estimate the match." : session ? "The resume is ready. Ask a question or paste a job description for an estimate." : "Upload a resume to start a private conversation."}
                  suggestedPrompts={scope === "uploaded" && !session ? undefined : suggestedPrompts}
              />
            </Card>
          </section>
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) uploadResume(file); event.currentTarget.value = ""; }} />
      </main>
    </div>
  );
}
