import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let userId: string | null = null
  try { userId = JSON.parse(request.cookies.get("insta_session")?.value || "{}").userId || null } catch {}
  if (!userId || !/^\d+$/.test(String(userId))) return NextResponse.json({ error: "Please connect Instagram first." }, { status: 401 })
  const { id } = await context.params
  const { data, error } = await getSupabaseAdmin().from("documents").select("id,title,content,created_at,updated_at").eq("id", id).eq("user_id", userId).single()
  if (error || !data) return NextResponse.json({ error: "Document not found." }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let userId: string | null = null
  try { userId = JSON.parse(request.cookies.get("insta_session")?.value || "{}").userId || null } catch {}
  if (!userId || !/^\\d+$/.test(String(userId))) return NextResponse.json({ error: "Please connect Instagram first." }, { status: 401 })

  const { id } = await context.params
  try {
    const body = await request.json()
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : ""
    const content = typeof body.content === "string" ? body.content : ""
    if (!title || !content.trim()) return NextResponse.json({ error: "Title and Markdown content are required." }, { status: 400 })
    if (content.length > 1024 * 1024) return NextResponse.json({ error: "Markdown file must be under 1 MB." }, { status: 413 })

    const { data, error } = await getSupabaseAdmin().from("documents")
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", userId)
      .select("id,title,content,created_at,updated_at").single()
    if (error || !data) return NextResponse.json({ error: "Document not found or could not be updated." }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error("[documents] PATCH:", error)
    return NextResponse.json({ error: "Could not update document." }, { status: 500 })
  }
}
