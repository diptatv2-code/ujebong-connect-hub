import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, user_name, user_email } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    // Build one-click approve URL
    const approveUrl = `${SUPABASE_URL}/functions/v1/approve-user?user_id=${user_id}&secret=${RESEND_API_KEY.slice(0, 8)}`;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">🔔 New Ujebong Signup</h2>
        <div style="background: #f8f9fa; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Name:</strong> ${user_name || "Not provided"}</p>
          <p style="margin: 4px 0;"><strong>Email:</strong> ${user_email || "Not provided"}</p>
          <p style="margin: 4px 0;"><strong>User ID:</strong> <code style="font-size: 11px;">${user_id}</code></p>
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
        subject: `🆕 New signup: ${user_name || user_email || "Unknown"}`,
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
