import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email;

    const { user_name } = await req.json();

    // Verify user exists in profiles
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, name")
      .eq("id", userId)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SECRET_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Generate HMAC-signed approval token
    const timestamp = Date.now().toString();
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(SECRET_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const data = encoder.encode(`${userId}:${timestamp}`);
    const signature = await crypto.subtle.sign("HMAC", key, data);
    const hmacToken = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const approveUrl = `${SUPABASE_URL}/functions/v1/approve-user?user_id=${userId}&token=${hmacToken}&ts=${timestamp}`;

    const displayName = user_name || profile.name || "Not provided";

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">🔔 New Ujebong Signup</h2>
        <div style="background: #f8f9fa; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Name:</strong> ${displayName}</p>
          <p style="margin: 4px 0;"><strong>Email:</strong> ${userEmail || "Not provided"}</p>
          <p style="margin: 4px 0;"><strong>User ID:</strong> <code style="font-size: 11px;">${userId}</code></p>
        </div>
        <a href="${approveUrl}" 
           style="display: inline-block; background: #6c63ff; color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 8px;">
          ✅ Approve This User
        </a>
        <p style="color: #888; font-size: 12px; margin-top: 16px;">Click the button above to instantly approve this user on Ujebong.</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Ujebong <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: `🆕 New signup: ${displayName}`,
        html: emailHtml,
      }),
    });

    const result = await res.json();
    console.log("Resend response:", result);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
