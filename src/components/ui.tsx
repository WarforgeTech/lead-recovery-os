import Link from "next/link";

export function Card({
  children,
  className = "",
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return <section className={`rounded-lg border border-zinc-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

export function Skeleton({ className = "" }: Readonly<{ className?: string }>) {
  return <div className={`animate-pulse rounded-md bg-zinc-200/80 ${className}`} />;
}

export function Stat({
  label,
  value,
  note,
}: Readonly<{ label: string; value: string; note?: string }>) {
  return (
    <Card>
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{value}</div>
      {note ? <div className="mt-2 text-sm leading-6 text-zinc-600">{note}</div> : null}
    </Card>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: Readonly<{ children: React.ReactNode; tone?: "green" | "yellow" | "red" | "neutral" | "blue" }>) {
  const tones = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    yellow: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-rose-200 bg-rose-50 text-rose-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
    neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function PrimaryLink({
  href,
  children,
}: Readonly<{ href: string; children: React.ReactNode }>) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({
  href,
  children,
}: Readonly<{ href: string; children: React.ReactNode }>) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
    >
      {children}
    </Link>
  );
}

export function Shell({
  children,
  title,
  actions,
}: Readonly<{ children: React.ReactNode; title: string; actions?: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/dashboard" className="font-semibold tracking-tight text-zinc-950">
            Pipeline Recovery OS
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
            <Link href="/dashboard" className="hover:text-zinc-950">Today</Link>
            <Link href="/imports" className="hover:text-zinc-950">Imports</Link>
            <Link href="/leads" className="hover:text-zinc-950">Contacts</Link>
            <Link href="/reports" className="hover:text-zinc-950">Reports</Link>
            <Link href="/exports" className="hover:text-zinc-950">Exports</Link>
            <Link href="/settings" className="hover:text-zinc-950">Settings</Link>
            {actions}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-500">Client portal</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{title}</h1>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
