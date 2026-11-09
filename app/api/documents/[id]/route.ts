import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let userId: number | null = null
  try { userId = Number(JSON.parse(request.cookies.get("insta_session")?.value || "{}").userId) || null } catch {}
  if (!userId || !/^\d+$/.test(String(userId))) return NextResponse.json({ error: "Please connect Instagram first." }, { status: 401 })
  const { id } = await context.params
  const { data, error } = await getSupabaseAdmin().from("documents").select("id,title,content,created_at,updated_at").eq("id", id).eq("user_id", userId).single()
  if (error || !data) return NextResponse.json({ error: "Document not found." }, { status: 404 })
  return NextResponse.json(data)
}
