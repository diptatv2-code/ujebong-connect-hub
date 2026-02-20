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

    // Skip email notifications for likes
    if (type === "like") {
      return new Response(JSON.stringify({ skipped: true, reason: "likes don't trigger emails" }), {
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
      return new Response(JSON.stringify({ skipped: true, reason: "no email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get actor name
    const { data: actorProfile } = await supabase.from("profiles").select("name").eq("id", actor_id).single();
    const actorName = actorProfile?.name || "Someone";

    const appUrl = "https://ujebong-connect-hub.lovable.app";

    const subjects: Record<string, string> = {
      comment: `${actorName} commented on your post`,
      message: `${actorName} sent you a message`,
    };

    const commentHtml = `
      <p><strong>${actorName}</strong> commented on your post:</p>
      <blockquote style="border-left: 3px solid #6c63ff; padding-left: 12px; color: #555; margin: 12px 0;">${content || ""}</blockquote>
      <p style="margin-top: 16px;">
        <a href="${appUrl}" style="display: inline-block; background: #6c63ff; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          View Post
        </a>
      </p>
    `;

    const messageHtml = `
      <p><strong>${actorName}</strong> sent you a message:</p>
      <blockquote style="border-left: 3px solid #6c63ff; padding-left: 12px; color: #555; margin: 12px 0;">${content || "Voice/image message"}</blockquote>
      <p style="margin-top: 16px;">
        <a href="${appUrl}/messages" style="display: inline-block; background: #6c63ff; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Open Messages
        </a>
      </p>
    `;

    const bodies: Record<string, string> = {
      comment: commentHtml,
      message: messageHtml,
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
