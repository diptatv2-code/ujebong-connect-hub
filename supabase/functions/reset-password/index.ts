import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8" };

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);

  // GET — show the reset password form
  if (req.method === "GET") {
    const token = url.searchParams.get("token");
    const userId = url.searchParams.get("user_id");

    if (!token || !userId) {
      return new Response(errorPage("Missing reset parameters."), {
        status: 400, headers: HTML_HEADERS,
      });
    }

    // Validate token
    const { data: profile } = await supabase
      .from("profiles")
      .select("password_reset_token, password_reset_expires_at")
      .eq("id", userId)
      .single();

    if (!profile || profile.password_reset_token !== token) {
      return new Response(errorPage("Invalid or expired reset link."), {
        status: 400, headers: HTML_HEADERS,
      });
    }

    if (profile.password_reset_expires_at && new Date(profile.password_reset_expires_at) < new Date()) {
      return new Response(errorPage("This reset link has expired. Please request a new one."), {
        status: 400, headers: HTML_HEADERS,
      });
    }

    return new Response(resetFormPage(token, userId), {
      status: 200, headers: HTML_HEADERS,
    });
  }

  // POST — process the password reset
  if (req.method === "POST") {
    try {
      const formData = await req.formData();
      const token = formData.get("token") as string;
      const userId = formData.get("user_id") as string;
      const password = formData.get("password") as string;
      const confirmPassword = formData.get("confirm_password") as string;

      if (!token || !userId || !password) {
        return new Response(errorPage("Missing required fields."), {
          status: 400, headers: HTML_HEADERS,
        });
      }

      if (password.length < 6) {
        return new Response(errorPage("Password must be at least 6 characters."), {
          status: 400, headers: HTML_HEADERS,
        });
      }

      if (password !== confirmPassword) {
        return new Response(errorPage("Passwords do not match."), {
          status: 400, headers: HTML_HEADERS,
        });
      }

      // Validate token
      const { data: profile } = await supabase
        .from("profiles")
        .select("password_reset_token, password_reset_expires_at")
        .eq("id", userId)
        .single();

      if (!profile || profile.password_reset_token !== token) {
        return new Response(errorPage("Invalid or expired reset link."), {
          status: 400, headers: HTML_HEADERS,
        });
      }

      if (profile.password_reset_expires_at && new Date(profile.password_reset_expires_at) < new Date()) {
        return new Response(errorPage("This reset link has expired. Please request a new one."), {
          status: 400, headers: HTML_HEADERS,
        });
      }

      // Update password via admin API
      const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
        password,
      });

      if (updateErr) {
        return new Response(errorPage("Failed to update password. Please try again."), {
          status: 500, headers: HTML_HEADERS,
        });
      }

      // Clear reset token
      await supabase.from("profiles").update({
        password_reset_token: null,
        password_reset_expires_at: null,
      }).eq("id", userId);

      return new Response(successPage(), {
        status: 200, headers: HTML_HEADERS,
      });
    } catch (error) {
      console.error("Reset error:", error);
      return new Response(errorPage("Something went wrong. Please try again."), {
        status: 500, headers: HTML_HEADERS,
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

function resetFormPage(token: string, userId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reset Password - Ujebong</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #6c63ff; padding: 20px; }
    .card { background: white; border-radius: 16px; padding: 40px; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: #1a1a2e; font-size: 22px; margin-bottom: 8px; }
    .subtitle { color: #555; font-size: 14px; margin-bottom: 24px; }
    form { text-align: left; }
    label { display: block; color: #333; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
    input[type="password"] { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 10px; font-size: 14px; margin-bottom: 16px; outline: none; }
    input[type="password"]:focus { border-color: #6c63ff; }
    .btn { width: 100%; background: #6c63ff; color: white; padding: 14px; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 8px; }
    .btn:hover { background: #5a52e0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔑</div>
    <h1>Reset Your Password</h1>
    <p class="subtitle">Enter your new password below.</p>
    <form method="POST">
      <input type="hidden" name="token" value="${token}">
      <input type="hidden" name="user_id" value="${userId}">
      <label>New Password</label>
      <input type="password" name="password" required minlength="6" placeholder="At least 6 characters">
      <label>Confirm Password</label>
      <input type="password" name="confirm_password" required minlength="6" placeholder="Confirm your password">
      <button type="submit" class="btn">Reset Password</button>
    </form>
  </div>
</body>
</html>`;
}

function successPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Password Reset - Ujebong</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #6c63ff; padding: 20px; }
    .card { background: white; border-radius: 16px; padding: 40px; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: #1a1a2e; font-size: 22px; margin-bottom: 12px; }
    p { color: #555; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .btn { display: inline-block; background: #6c63ff; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; }
    .btn:hover { background: #5a52e0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Password Reset!</h1>
    <p>Your password has been successfully updated. You can now log in with your new password.</p>
    <a href="https://ujebong-connect-hub.lovable.app/login" class="btn">Go to Login</a>
  </div>
</body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reset Error - Ujebong</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #6c63ff; padding: 20px; }
    .card { background: white; border-radius: 16px; padding: 40px; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: #1a1a2e; font-size: 22px; margin-bottom: 12px; }
    p { color: #555; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .btn { display: inline-block; background: #6c63ff; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; }
    .btn:hover { background: #5a52e0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Reset Failed</h1>
    <p>${message}</p>
    <a href="https://ujebong-connect-hub.lovable.app/login" class="btn">Go to Login</a>
  </div>
</body>
</html>`;
}
