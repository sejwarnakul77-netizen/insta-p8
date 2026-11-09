import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

function getSessionUserId(request: NextRequest) {
  try {
    const session = JSON.parse(request.cookies.get("insta_session")?.value || "{}")
    return typeof session.userId === "string" && /^\d+$/.test(session.userId) ? session.userId : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Please connect Instagram first." }, { status: 401 })
  try {
    const { data, error } = await getSupabaseAdmin().from("documents")
      .select("id,title,created_at,updated_at").eq("user_id", userId).order("updated_at", { ascending: false })
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[documents] GET:", error)
    return NextResponse.json({ error: "Could not load documents. Apply the latest schema.sql in Supabase." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Please connect Instagram first." }, { status: 401 })
  try {
    const body = await request.json()
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : ""
    const content = typeof body.content === "string" ? body.content : ""
    if (!title || !content.trim()) return NextResponse.json({ error: "Title and Markdown content are required." }, { status: 400 })
    if (content.length > 1024 * 1024) return NextResponse.json({ error: "Markdown file must be under 1 MB." }, { status: 413 })
    const { data, error } = await getSupabaseAdmin().from("documents")
      .insert({ user_id: userId, title, content }).select("id,title,created_at,updated_at").single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("[documents] POST:", error)
    return NextResponse.json({ error: "Could not save document. Check that the documents table exists." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Please connect Instagram first." }, { status: 401 })
  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing document id." }, { status: 400 })
  try {
    const { error } = await getSupabaseAdmin().from("documents").delete().eq("id", id).eq("user_id", userId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[documents] DELETE:", error)
    return NextResponse.json({ error: "Could not delete document." }, { status: 500 })
  }
}
