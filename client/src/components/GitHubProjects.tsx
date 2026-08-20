import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, Github, Loader2, Star } from "lucide-react";

type Project = {
  name: string;
  description: string | null;
  url: string;
  homepageUrl: string | null;
  language: string | null;
  stargazerCount: number;
};

export function GitHubProjects({ projects, isLoading }: { projects?: Project[]; isLoading?: boolean }) {
  return (
    <section className="mt-6" aria-labelledby="github-projects-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800"><Github className="size-3.5" /> GitHub project catalog</div><h2 id="github-projects-title" className="mt-1 font-serif text-3xl tracking-[-0.04em] text-slate-950">Projects beyond the resume.</h2></div><Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">{projects?.length ?? "…"} active repositories</Badge></div>
      {isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-2xl bg-white/70" />)}</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects?.map(project => <Card key={project.url} className="group border-slate-900/10 bg-white/90 shadow-[0_16px_45px_-35px_rgba(15,23,42,0.5)] transition-transform duration-200 hover:-translate-y-0.5"><CardContent className="flex h-full flex-col p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold tracking-tight text-slate-900">{project.name}</h3><Github className="size-4 shrink-0 text-slate-400" /></div><p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{project.description || "Explore the repository for project details."}</p><div className="mt-4 flex items-center justify-between gap-2"><div className="flex items-center gap-2">{project.language && <Badge variant="secondary" className="bg-slate-100 text-slate-600">{project.language}</Badge>}{project.stargazerCount > 0 && <span className="flex items-center gap-1 text-xs text-slate-500"><Star className="size-3" />{project.stargazerCount}</span>}</div><div className="flex items-center gap-2"><a className="text-xs font-semibold text-emerald-800 hover:text-emerald-950" href={project.url} target="_blank" rel="noreferrer">Code <ArrowUpRight className="inline size-3" /></a>{project.homepageUrl && <a className="text-xs font-semibold text-emerald-800 hover:text-emerald-950" href={project.homepageUrl} target="_blank" rel="noreferrer">Live <ArrowUpRight className="inline size-3" /></a>}</div></div></CardContent></Card>)}</div>}
      {!isLoading && (!projects || projects.length === 0) && <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500">No public repositories are currently available.</div>}
    </section>
  );
}
