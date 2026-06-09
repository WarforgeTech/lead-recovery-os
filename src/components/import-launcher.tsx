"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const SOURCE_KINDS = [
  ["lead_file", "Inactive leads"],
  ["closed_leads", "Closed / dead files"],
  ["do_not_contact", "Do-not-contact"],
  ["mixed", "Mixed / not sure"],
] as const;

type QueuedFile = { id: number; file: File; sourceKind: string };

export function ImportLauncher({
  organizationId,
  onboarding = false,
}: {
  organizationId: string;
  onboarding?: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [text, setText] = useState("");
  const [textSourceKind, setTextSourceKind] = useState("lead_file");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const added = Array.from(fileList).map((file) => ({ id: nextId.current++, file, sourceKind: "lead_file" }));
    setFiles((current) => [...current, ...added]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function setKind(id: number, sourceKind: string) {
    setFiles((current) => current.map((item) => (item.id === id ? { ...item, sourceKind } : item)));
  }

  function removeFile(id: number) {
    setFiles((current) => current.filter((item) => item.id !== id));
  }

  async function startImport(file: File, sourceKind: string) {
    const formData = new FormData();
    formData.set("organization_id", organizationId);
    formData.set("source_kind", sourceKind);
    formData.set("file", file);
    const response = await fetch("/api/imports", { method: "POST", body: formData });
    const result = (await response.json()) as { importId?: string; redirectTo?: string; error?: string };
    if (!response.ok || !result.importId) throw new Error(result.error ?? "Could not start the import.");
    return result.importId;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "text") {
        const formData = new FormData();
        formData.set("organization_id", organizationId);
        formData.set("source_kind", textSourceKind);
        formData.set("text", text);
        const response = await fetch("/api/imports", { method: "POST", body: formData });
        const result = (await response.json()) as { importId?: string; redirectTo?: string; error?: string };
        if (!response.ok || !result.redirectTo) throw new Error(result.error ?? "Could not start the import.");
        // During onboarding, land on the imports list (live status of all files)
        // so a first-time user can see what's happening; otherwise the focused
        // single-import progress screen.
        router.push(onboarding ? "/imports" : result.redirectTo);
        return;
      }

      // Each file becomes its own import + durable workflow, processed in parallel.
      const importIds = await Promise.all(files.map((item) => startImport(item.file, item.sourceKind)));
      router.push(onboarding || importIds.length !== 1 ? "/imports" : `/imports/${importIds[0]}/processing`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the import.");
      setLoading(false);
    }
  }

  const ready = mode === "file" ? files.length > 0 : Boolean(text.trim());

  return (
    <form onSubmit={submit} className="space-y-5">
      {onboarding ? (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
          Drop in every messy export you have — add as many files as you like and tag each one. Nothing is added to your
          follow-up queue until you review and accept the cleaned import.
        </div>
      ) : null}

      <div className="flex gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-1">
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`h-10 flex-1 rounded px-3 text-sm font-medium ${mode === "file" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-600"}`}
        >
          Upload files
        </button>
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`h-10 flex-1 rounded px-3 text-sm font-medium ${mode === "text" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-600"}`}
        >
          Paste text
        </button>
      </div>

      {mode === "file" ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6">
            <div className="text-sm font-medium text-zinc-800">Add one or more lead files</div>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              CSV, TSV, XLSX, TXT, JSON, VCF, DOCX, and text-based PDF are supported. Legacy .xls should be exported as
              .xlsx, CSV, or TSV. Tag each file so the cleaner knows how to treat it.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              accept=".csv,.tsv,.txt,.json,.vcf,.xls,.xlsx,.docx,.pdf"
              onChange={(event) => addFiles(event.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              {files.length ? "Add more files" : "Choose files"}
            </button>
          </div>

          {files.length ? (
            <ul className="space-y-2">
              {files.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-zinc-900">{item.file.name}</span>
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`kind-${item.id}`}>
                      What is {item.file.name}?
                    </label>
                    <select
                      id={`kind-${item.id}`}
                      value={item.sourceKind}
                      onChange={(event) => setKind(item.id, event.target.value)}
                      className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900"
                    >
                      {SOURCE_KINDS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
                      aria-label={`Remove ${item.file.name}`}
                      className="grid h-9 w-9 flex-none place-items-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No files added yet.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-zinc-800">What are you pasting?</span>
            <select
              value={textSourceKind}
              onChange={(event) => setTextSourceKind(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 sm:w-72"
            >
              {SOURCE_KINDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-800">Paste messy lead data</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={12}
              placeholder="Paste old CRM rows, copied spreadsheet text, loan notes, Facebook/iMessage notes, names, phones, emails, statuses, or last-contact details."
              className="mt-2 w-full rounded-md border border-zinc-300 p-3 text-sm leading-6 text-zinc-950 outline-none focus:border-zinc-900"
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!ready || loading}
          className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Starting import…"
            : mode === "file" && files.length > 1
              ? `Clean and review ${files.length} files`
              : "Clean and review leads"}
        </button>
        <p className="text-sm text-zinc-500">No messages are sent. This only creates a review queue.</p>
      </div>
      {error ? <p className="text-sm leading-6 text-rose-700">{error}</p> : null}
    </form>
  );
}
