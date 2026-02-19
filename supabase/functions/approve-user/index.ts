import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function verifyHmac(userId: string, token: string, timestamp: string): Promise<boolean> {
  const SECRET_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const data = encoder.encode(`${userId}:${timestamp}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const expectedToken = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (expectedToken.length !== token.length) return false;
  let result = 0;
  for (let i = 0; i < expectedToken.length; i++) {
    result |= expectedToken.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    const token = url.searchParams.get("token");
    const timestamp = url.searchParams.get("ts");

    if (!userId || !token || !timestamp) {
      return new Response(renderHtml("❌ Invalid or unauthorized request.", false), {
        status: 403,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Check token expiry (24 hours)
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (isNaN(tokenAge) || tokenAge > 24 * 60 * 60 * 1000 || tokenAge < 0) {
      return new Response(renderHtml("❌ This approval link has expired. Please use the admin panel to approve users.", false), {
        status: 403,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Verify HMAC signature
    const isValid = await verifyHmac(userId, token, timestamp);
    if (!isValid) {
      return new Response(renderHtml("❌ Invalid or unauthorized request.", false), {
        status: 403,
        headers: { "Content-Type": "text/html" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: true })
      .eq("id", userId);

    if (error) {
      console.error("Approval error:", error);
      return new Response(renderHtml("❌ Failed to approve user. " + error.message, false), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response(renderHtml("✅ User has been approved successfully!", true), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(renderHtml("❌ Something went wrong.", false), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
});

function renderHtml(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ujebong - User Approval</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: ${success ? "#f0fdf4" : "#fef2f2"}; }
  .card { text-align: center; padding: 40px; border-radius: 16px; background: white; box-shadow: 0 4px 24px rgba(0,0,0,0.1); max-width: 400px; }
  h1 { font-size: 24px; color: ${success ? "#16a34a" : "#dc2626"}; }
  p { color: #666; margin-top: 8px; }
</style>
</head>
<body>
  <div class="card">
    <h1>${message}</h1>
    <p>${success ? "They can now log in and use Ujebong." : "Please try again or contact support."}</p>
  </div>
</body>
</html>`;
}
