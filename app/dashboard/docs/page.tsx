"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, BookOpen, FileText, Loader2, Pencil, Plus, Search, Trash2, Upload } from "lucide-react"

type Doc = { id: string; title: string; created_at: string; updated_at: string; content?: string }

function inline(text: string) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\x27/g, "&#39;")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

function renderMarkdown(source: string) {
  const lines = source.replace(/\r\n/g, "\n").split("\n")
  const out: string[] = []
  let inCode = false, code: string[] = [], list: "ul" | "ol" | null = null
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null } }
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      closeList()
      if (inCode) { out.push("<pre><code>" + code.join("\n").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") + "</code></pre>"); code=[]; inCode=false }
      else inCode=true
      continue
    }
    if (inCode) { code.push(line); continue }
    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) { closeList(); const n=heading[1].length; out.push(`<h${n}>${inline(heading[2])}</h${n}>`); continue }
    if (/^\s*---+\s*$/.test(line)) { closeList(); out.push("<hr/>"); continue }
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/)
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/)
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol"
      if (list !== kind) { closeList(); list=kind; out.push(`<${kind}>`) }
      out.push("<li>" + inline((bullet || numbered)![1]) + "</li>"); continue
    }
    if (!line.trim()) { closeList(); continue }
    if (line.startsWith(">")) { closeList(); out.push("<blockquote>" + inline(line.replace(/^>\s?/, "")) + "</blockquote>"); continue }
    closeList(); out.push("<p>" + inline(line) + "</p>")
  }
  closeList()
  if (inCode) out.push("<pre><code>" + code.join("\n") + "</code></pre>")
  return out.join("\n")
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [selected, setSelected] = useState<Doc | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [search, setSearch] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [showUpload, setShowUpload] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const response = await fetch("/api/documents", { cache: "no-store" })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Could not load documents")
    setDocs(data)
  }
  useEffect(() => { load().catch(e => setError(e.message)) }, [])
  const filtered = useMemo(() => docs.filter(d => d.title.toLowerCase().includes(search.toLowerCase())), [docs, search])

  async function chooseFile(file?: File) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".md")) { setError("Please choose a .md file."); return }
    setTitle(file.name.replace(/\.md$/i, "").replace(/[-_]/g, " "))
    setContent(await file.text())
    setError("")
    setShowUpload(true)
  }
  async function save() {
    setBusy(true); setError("")
    try {
      const response = await fetch(editingId ? "/api/documents/" + editingId : "/api/documents", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Save failed")
      await load(); setSelected({ ...data, content }); setShowUpload(false); setEditingId(null); setTitle(""); setContent("")
      if (fileRef.current) fileRef.current.value = ""
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed") }
    finally { setBusy(false) }
  }
  async function openDoc(id: string) {
    setBusy(true); setError("")
    try {
      const response = await fetch(`/api/documents/${id}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not open document")
      setSelected(data)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open document") }
    finally { setBusy(false) }
  }
  async function removeDoc(doc: Doc) {
    if (!confirm(`Delete "${doc.title}"?`)) return
    const response = await fetch(`/api/documents?id=${doc.id}`, { method: "DELETE" })
    if (!response.ok) { const data=await response.json(); setError(data.error || "Delete failed"); return }
    setDocs(items => items.filter(item => item.id !== doc.id))
    if (selected?.id === doc.id) setSelected(null)
  }

  return <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm text-muted-foreground">Your knowledge library</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Documents</h1><p className="mt-2 text-sm text-muted-foreground">Upload Markdown files and read them as clean web pages.</p></div>
      <div className="flex gap-2">
        <input ref={fileRef} type="file" accept=".md,text/markdown,text/plain" className="hidden" onChange={e => chooseFile(e.target.files?.[0])} />
        <button onClick={() => fileRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"><Upload className="size-4"/> Upload .md</button>
      </div>
    </header>
    {error && <div role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    {showUpload && <section className="mb-6 rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{editingId ? "Edit Markdown document" : "Save Markdown document"}</h2><button onClick={() => { setShowUpload(false); setEditingId(null); setTitle(""); setContent("") }} className="text-sm text-muted-foreground">Cancel</button></div>
      <label className="mb-1 block text-xs font-medium">Document title</label><input value={title} onChange={e=>setTitle(e.target.value)} className="mb-3 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"/>
      <label className="mb-1 block text-xs font-medium">Markdown content</label><textarea value={content} onChange={e=>setContent(e.target.value)} rows={9} className="w-full rounded-lg border border-input bg-background p-3 font-mono text-xs"/>
      <button disabled={busy || !title.trim() || !content.trim()} onClick={save} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin"/> : editingId ? <Pencil className="size-4"/> : <Plus className="size-4"/>} {editingId ? "Save changes" : "Save to library"}</button>
    </section>}
    {selected ? <article className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><button onClick={()=>setSelected(null)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4"/> All documents</button><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">Markdown document</span><button onClick={() => { setTitle(selected.title); setContent(selected.content || ""); setEditingId(selected.id); setShowUpload(true) }} className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"><Pencil className="size-3.5"/> Edit</button></div></div>
      <div className="mx-auto max-w-4xl px-6 py-10 sm:px-12"><h2 className="mb-8 text-3xl font-semibold tracking-tight">{selected.title}</h2><div className="markdown-view" dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.content || "") }}/></div>
    </article> : <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-xl border border-border bg-card p-4"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents" className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm"/></div>
        <div className="mt-4 space-y-1">{filtered.map(doc=><div key={doc.id} className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted"><button onClick={()=>openDoc(doc.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"><FileText className="size-4 shrink-0 text-muted-foreground"/><span className="truncate">{doc.title}</span></button><button onClick={()=>removeDoc(doc)} aria-label="Delete document" className="p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"><Trash2 className="size-3.5"/></button></div>)}
        {filtered.length===0 && <p className="px-2 py-5 text-center text-xs text-muted-foreground">{docs.length ? "No matching documents." : "No documents yet. Upload your first .md file."}</p>}</div>
      </aside>
      <section className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-8 text-center"><span className="flex size-12 items-center justify-center rounded-xl bg-secondary"><BookOpen className="size-5"/></span><h2 className="mt-4 text-lg font-semibold">Your docs, beautifully readable</h2><p className="mt-2 max-w-sm text-sm text-muted-foreground">Choose a document from the list or upload a Markdown file to add it to your library.</p><button onClick={()=>fileRef.current?.click()} className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium"><Upload className="size-4"/> Upload Markdown</button></section>
    </div>}
    <style jsx global>{`
      .markdown-view { color: var(--foreground); font-size: 15px; line-height: 1.8; overflow-wrap: anywhere; }
      .markdown-view h1,.markdown-view h2,.markdown-view h3,.markdown-view h4 { font-weight: 650; line-height: 1.3; margin: 1.8em 0 .65em; letter-spacing: -.02em; }
      .markdown-view h1 { font-size: 2rem; } .markdown-view h2 { font-size: 1.55rem; border-bottom: 1px solid var(--border); padding-bottom: .4em; }
      .markdown-view h3 { font-size: 1.2rem; } .markdown-view h4 { font-size: 1.05rem; }
      .markdown-view p { margin: .8em 0; } .markdown-view ul,.markdown-view ol { margin: .8em 0; padding-left: 1.6em; }
      .markdown-view ul { list-style: disc; } .markdown-view ol { list-style: decimal; } .markdown-view li { padding-left: .25em; margin: .25em 0; }
      .markdown-view a { color: var(--primary); text-decoration: underline; text-underline-offset: 3px; }
      .markdown-view code { background: var(--muted); border-radius: 4px; padding: .15em .35em; font-size: .88em; }
      .markdown-view pre { background: var(--muted); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; overflow-x: auto; margin: 1em 0; }
      .markdown-view pre code { background: transparent; padding: 0; }
      .markdown-view blockquote { border-left: 3px solid var(--border); padding-left: 1em; color: var(--muted-foreground); margin: 1em 0; }
      .markdown-view hr { border: 0; border-top: 1px solid var(--border); margin: 2em 0; }
      .markdown-view strong { font-weight: 650; }
    `}</style>
  </div>
}
