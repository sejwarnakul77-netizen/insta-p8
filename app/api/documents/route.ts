import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

// Shared document library: these endpoints do not require Instagram login.
export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin().from("documents").select("id,title,created_at,updated_at").order("updated_at", { ascending: false })
    if (error) throw error
    return NextResponse.json(data || [], { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[documents] GET:", error)
    return NextResponse.json({ error: "Could not load documents." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : ""
    const content = typeof body.content === "string" ? body.content : ""
    if (!title || !content.trim()) return NextResponse.json({ error: "Title and Markdown content are required." }, { status: 400 })
    if (content.length > 1024 * 1024) return NextResponse.json({ error: "Markdown file must be under 1 MB." }, { status: 413 })

    // Preserve compatibility with the existing NOT NULL/FK user_id column.
    // This is only a legacy owner value; documents are shared globally.
    const admin = getSupabaseAdmin()
    const { data: owner, error: ownerError } = await admin.from("users").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle()
    if (ownerError) throw ownerError
    if (!owner) return NextResponse.json({ error: "No legacy owner record exists for the documents table. Connect an Instagram account once to initialize the app; document access itself does not require login." }, { status: 503 })

    const { data, error } = await admin.from("documents").insert({ user_id: String(owner.id), title, content }).select("id,title,content,created_at,updated_at").single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("[documents] POST:", error)
    return NextResponse.json({ error: "Could not save document." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing document id." }, { status: 400 })
  try {
    const { error } = await getSupabaseAdmin().from("documents").delete().eq("id", id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[documents] DELETE:", error)
    return NextResponse.json({ error: "Could not delete document." }, { status: 500 })
  }
}
