import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

// Shared document library: reading and editing do not require Instagram login.
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { data, error } = await getSupabaseAdmin().from("documents").select("id,title,content,created_at,updated_at").eq("id", id).maybeSingle()
  if (error || !data) return NextResponse.json({ error: "Document not found." }, { status: 404 })
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const body = await request.json()
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : ""
    const content = typeof body.content === "string" ? body.content : ""
    if (!title || !content.trim()) return NextResponse.json({ error: "Title and Markdown content are required." }, { status: 400 })
    if (content.length > 1024 * 1024) return NextResponse.json({ error: "Markdown file must be under 1 MB." }, { status: 413 })
    const { data, error } = await getSupabaseAdmin().from("documents").update({ title, content, updated_at: new Date().toISOString() }).eq("id", id).select("id,title,content,created_at,updated_at").maybeSingle()
    if (error || !data) return NextResponse.json({ error: "Document not found or could not be updated." }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error("[documents] PATCH:", error)
    return NextResponse.json({ error: "Could not update document." }, { status: 500 })
  }
}
