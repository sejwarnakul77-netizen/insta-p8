import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const GRAPH = "https://graph.facebook.com/v27.0"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = typeof body.userId === "string" ? body.userId : ""
    if (!/^\\d+$/.test(userId)) {
      return NextResponse.json({ error: "Invalid Instagram account. Please reconnect Instagram." }, { status: 401 })
    }

    // Never trust the browser's localStorage identity by itself. Verify the
    // stored Meta token still grants access to this exact Instagram account.
    const { data: user, error } = await getSupabaseAdmin()
      .from("users").select("id,username,access_token").eq("id", userId).maybeSingle()
    if (error) throw error
    if (!user?.access_token) {
      return NextResponse.json({ error: "Instagram session expired. Please reconnect Instagram." }, { status: 401 })
    }

    const verify = await fetch(
      GRAPH + "/me/assigned_instagram_accounts?fields=id&limit=100",
      { headers: { Authorization: "Bearer " + user.access_token }, cache: "no-store" },
    )
    const result = await verify.json()
    const valid = verify.ok && Array.isArray(result.data) &&
      result.data.some((account: { id?: string | number }) => String(account.id) === userId)
    if (!valid) {
      return NextResponse.json({ error: "Instagram access has expired or this account is no longer connected. Please reconnect Instagram." }, { status: 401 })
    }

    const response = NextResponse.json({ success: true, userId, username: user.username })
    response.cookies.set("insta_session", JSON.stringify({ username: user.username, userId }), {
      path: "/", maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: true,
    })
    return response
  } catch (error) {
    console.error("[instagram-session] Restore failed:", error)
    return NextResponse.json({ error: "Could not restore Instagram session. Please reconnect Instagram." }, { status: 500 })
  }
}
