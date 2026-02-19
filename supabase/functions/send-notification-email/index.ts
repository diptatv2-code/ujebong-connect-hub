import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, type, actor_id, content } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get user email
    const { data: { user } } = await supabase.auth.admin.getUserById(user_id);
    if (!user?.email) {
      return new Response(JSON.stringify({ skipped: true, reason: "no email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get actor name
    const { data: actorProfile } = await supabase.from("profiles").select("name").eq("id", actor_id).single();
    const actorName = actorProfile?.name || "Someone";

    const subjects: Record<string, string> = {
      like: `${actorName} liked your post`,
      comment: `${actorName} commented on your post`,
      message: `${actorName} sent you a message`,
    };

    const bodies: Record<string, string> = {
      like: `<p><strong>${actorName}</strong> liked your post on Ujebong.</p>`,
      comment: `<p><strong>${actorName}</strong> commented on your post:</p><blockquote style="border-left: 3px solid #6c63ff; padding-left: 12px; color: #555;">${content || ""}</blockquote>`,
      message: `<p><strong>${actorName}</strong> sent you a message:</p><blockquote style="border-left: 3px solid #6c63ff; padding-left: 12px; color: #555;">${content || "Voice/image message"}</blockquote>`,
    };

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">🔔 Ujebong Notification</h2>
        <div style="background: #f8f9fa; border-radius: 12px; padding: 16px; margin: 16px 0;">
          ${bodies[type] || bodies.message}
        </div>
        <p style="color: #888; font-size: 12px; margin-top: 16px;">Open Ujebong to respond.</p>
      </div>
    `;

    // Use verified domain if available, fallback to resend test
    const fromEmail = Deno.env.get("FROM_EMAIL") || "Ujebong <onboarding@resend.dev>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [user.email],
        subject: subjects[type] || `New notification on Ujebong`,
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
    console.log("Email sent successfully to:", user.email);

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
