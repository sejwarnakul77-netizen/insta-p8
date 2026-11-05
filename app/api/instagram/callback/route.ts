import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

const GRAPH = "https://graph.facebook.com/v27.0"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get("code")
  const error = params.get("error")
  const description = params.get("error_description")
  if (error) {
    const url = new URL("/", request.url)
    url.searchParams.set("error", error)
    if (description) url.searchParams.set("error_description", description)
    return NextResponse.redirect(url)
  }
  if (code) {
    const url = new URL("/", request.url)
    url.searchParams.set("code", code)
    return NextResponse.redirect(url)
  }
  return NextResponse.json({ error: "Invalid callback" }, { status: 400 })
}

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Missing OAuth code" }, { status: 400 })
    }

    // Unified Login exchanges the code using the parent Meta app credentials.
    const appId = process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID || "1753831466409131"
    const appSecret = process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET
    const redirectUri = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI ||
      "https://insta-p8-lake.vercel.app/api/instagram/callback"
    if (!appSecret) {
      return NextResponse.json({ error: "Set META_APP_SECRET in Vercel before connecting Instagram." }, { status: 500 })
    }

    const tokenParams = new URLSearchParams({
      client_id: appId, client_secret: appSecret, code, redirect_uri: redirectUri,
    })
    const tokenRes = await fetch(`${GRAPH}/oauth/access_token?${tokenParams.toString()}`, { cache: "no-store" })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      console.error("[unified-login] Token exchange failed:", tokenData.error || tokenData)
      return NextResponse.json({ error: tokenData.error?.message || "Meta token exchange failed" }, { status: 400 })
    }

    const accessToken = tokenData.access_token as string
    const headers = { Authorization: `Bearer ${accessToken}` }

    // In Unified Login /me is a business system user, not the Instagram profile.
    const accountsRes = await fetch(
      `${GRAPH}/me/assigned_instagram_accounts?fields=id,username,profile_picture_url&limit=100`,
      { headers, cache: "no-store" },
    )
    const accountsData = await accountsRes.json()
    if (!accountsRes.ok || accountsData.error) {
      console.error("[unified-login] Account lookup failed:", accountsData.error || accountsData)
      return NextResponse.json({ error: accountsData.error?.message || "Could not retrieve shared Instagram account" }, { status: 400 })
    }
    const accounts = Array.isArray(accountsData.data) ? accountsData.data : []
    if (accounts.length === 0) {
      return NextResponse.json({ error: "No Instagram account was shared by this login. Check the Unified Login configuration and assigned Instagram assets." }, { status: 400 })
    }
    if (accounts.length > 1) {
      return NextResponse.json({
        error: "Multiple Instagram accounts were shared. Select one account; this dashboard currently supports one account per login.",
        accounts: accounts.map((account: any) => ({ id: account.id, username: account.username })),
      }, { status: 409 })
    }

    const account = accounts[0]
    const instagramUserId = String(account.id)
    const username = account.username || `instagram_${instagramUserId}`
    const profilePic = account.profile_picture_url || null

    // Subscribe this shared Instagram professional account to the app's webhook fields.
    // A successful app-level webhook test alone does not subscribe each Unified Login asset.
    const subscribeUrl = `${GRAPH}/${instagramUserId}/subscribed_apps?subscribed_fields=messages,comments&access_token=${encodeURIComponent(accessToken)}`
    const subscribeRes = await fetch(subscribeUrl, { method: "POST", cache: "no-store" })
    const subscribeData = await subscribeRes.json()
    const webhookSubscribed = subscribeRes.ok && !subscribeData.error
    if (!webhookSubscribed) {
      console.error("[unified-login] Webhook subscription failed:", subscribeData.error || subscribeData)
    }
    const expiresAt = typeof tokenData.expires_in === "number" && tokenData.expires_in > 0
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null
    const supabase = await getSupabaseServerClient()
    const { error: upsertError } = await supabase.from("users").upsert({
      id: instagramUserId,
      username,
      access_token: accessToken,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
      business_account_id: instagramUserId,
      // Legacy column retained for webhook matching. This value is the IG account ID, not a Page ID.
      page_id: instagramUserId,
    }, { onConflict: "id" })
    if (upsertError) throw upsertError

    const response = NextResponse.json({ success: true, username, userId: instagramUserId, profilePic })
    response.cookies.set("insta_session", JSON.stringify({ username, userId: instagramUserId }), {
      path: "/", maxAge: typeof tokenData.expires_in === "number" ? tokenData.expires_in : 31536000,
      sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: true,
    })
    return response
  } catch (error: any) {
    console.error("[unified-login] Callback error:", error)
    return NextResponse.json({ error: error?.message || "Instagram connection failed" }, { status: 500 })
  }
}
