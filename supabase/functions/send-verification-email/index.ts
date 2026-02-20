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
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get user email
    const { data: { user } } = await supabase.auth.admin.getUserById(user_id);
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "User not found or no email" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a secure verification token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token in profiles
    await supabase.from("profiles").update({
      email_verification_token: token,
      email_verification_expires_at: expiresAt.toISOString(),
    }).eq("id", user_id);

    // Build verification URL
    const verifyUrl = `${supabaseUrl}/functions/v1/verify-email?token=${token}&user_id=${user_id}`;

    // Get user name
    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user_id).single();
    const userName = profile?.name || "there";

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1a1a2e; font-size: 28px; margin: 0;">Ujebong</h1>
          <p style="color: #888; font-size: 12px; margin: 4px 0 0;">Connect with friends and the world</p>
        </div>
        <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin: 16px 0;">
          <h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 12px;">Welcome, ${userName}! 👋</h2>
          <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            Thanks for signing up on Ujebong. Please verify your email address to get started.
          </p>
          <div style="text-align: center;">
            <a href="${verifyUrl}" 
               style="display: inline-block; background: #6c63ff; color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px;">
              ✅ Verify My Email
            </a>
          </div>
        </div>
        <p style="color: #aaa; font-size: 11px; text-align: center; margin-top: 20px;">
          This link expires in 24 hours. If you didn't sign up for Ujebong, please ignore this email.
        </p>
      </div>
    `;

    const fromEmail = Deno.env.get("FROM_EMAIL") || "Ujebong <noreply@ujebong.com>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [user.email],
        subject: "Verify your email - Ujebong",
        html: emailHtml,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ success: false, error: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Verification email sent to:", user.email);
    return new Response(JSON.stringify({ success: true }), {
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
