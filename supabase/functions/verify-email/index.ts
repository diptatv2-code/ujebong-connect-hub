import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const userId = url.searchParams.get("user_id");

    if (!token || !userId) {
      return new Response(errorPage("Missing verification parameters."), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Look up profile with matching token
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("email_verification_token, email_verification_expires_at, email_verified")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      return new Response(errorPage("User not found."), {
        status: 404,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (profile.email_verified) {
      return new Response(successPage("Your email is already verified! You can log in now."), {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (profile.email_verification_token !== token) {
      return new Response(errorPage("Invalid verification link."), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (profile.email_verification_expires_at && new Date(profile.email_verification_expires_at) < new Date()) {
      return new Response(errorPage("This verification link has expired. Please request a new one from the login page."), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Mark email as verified
    await supabase.from("profiles").update({
      email_verified: true,
      email_verification_token: null,
      email_verification_expires_at: null,
    }).eq("id", userId);

    return new Response(successPage("Your email has been verified! You can now log in to Ujebong."), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(errorPage("Something went wrong. Please try again."), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
});

function successPage(message: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email Verified - Ujebong</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#6c63ff;">
  <div style="background:white;border-radius:16px;padding:40px;max-width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
    <div style="font-size:48px;margin-bottom:16px;">✅</div>
    <h1 style="color:#1a1a2e;font-size:22px;margin:0 0 12px;">Email Verified!</h1>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">${message}</p>
    <a href="https://ujebong-connect-hub.lovable.app/login" style="display:inline-block;background:#6c63ff;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold;">Go to Login</a>
  </div>
</body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verification Error - Ujebong</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#6c63ff;">
  <div style="background:white;border-radius:16px;padding:40px;max-width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
    <div style="font-size:48px;margin-bottom:16px;">❌</div>
    <h1 style="color:#1a1a2e;font-size:22px;margin:0 0 12px;">Verification Failed</h1>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">${message}</p>
    <a href="https://ujebong-connect-hub.lovable.app/login" style="display:inline-block;background:#6c63ff;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold;">Go to Login</a>
  </div>
</body>
</html>`;
}
