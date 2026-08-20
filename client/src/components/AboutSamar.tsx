import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Heart, MapPin, Ruler } from "lucide-react";

type Profile = {
  about: string;
  age: number;
  formattedBirthDate: string;
  relationshipStatus: string;
};

export function AboutSamar({ profile, isLoading }: { profile?: Profile; isLoading?: boolean }) {
  return (
    <Card className="overflow-hidden border-slate-900/10 bg-white/90 shadow-[0_18px_55px_-32px_rgba(15,23,42,0.45)]">
      <CardContent className="p-0">
        <div className="border-b border-slate-900/10 bg-emerald-950 px-5 py-4 text-white">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200"><span aria-hidden="true" className="font-serif text-sm leading-none">S</span> About Samar</div>
          <p className="mt-2 font-serif text-2xl tracking-[-0.03em]">A builder at the intersection of AI and useful systems.</p>
        </div>
        <div className="p-5">
          {isLoading ? <div className="h-20 animate-pulse rounded-xl bg-slate-100" /> : <p className="text-sm leading-6 text-slate-600">{profile?.about}</p>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 p-3"><span className="flex items-center gap-2 text-xs font-semibold text-emerald-900"><CalendarDays className="size-3.5" /> Born {profile?.formattedBirthDate ?? "23 Sep 2004"}</span><p className="mt-1 text-sm text-emerald-800">{profile?.age ?? 21} years old, calculated live.</p></div>
            <div className="rounded-xl bg-amber-50 p-3"><span className="flex items-center gap-2 text-xs font-semibold text-amber-900"><Heart className="size-3.5" /> Relationship status</span><p className="mt-1 text-sm text-amber-800">{profile?.relationshipStatus ?? "Single and trying things out"}</p></div>
            <div className="rounded-xl bg-slate-100 p-3"><span className="flex items-center gap-2 text-xs font-semibold text-slate-700"><MapPin className="size-3.5" /> Based in</span><p className="mt-1 text-sm text-slate-600">Jammu & Kashmir, India</p></div>
            <div className="rounded-xl bg-slate-100 p-3"><span className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Ruler className="size-3.5" /> Height</span><p className="mt-1 text-sm text-slate-600">6 feet</p></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2"><Badge className="bg-slate-900 text-white hover:bg-slate-900">Badminton</Badge><Badge variant="outline" className="border-emerald-300 text-emerald-800">Plays with both hands</Badge><Badge variant="outline" className="border-slate-300 text-slate-700">Sikh</Badge></div>
        </div>
      </CardContent>
    </Card>
  );
}
