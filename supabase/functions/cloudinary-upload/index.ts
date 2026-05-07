import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// BUG-059: Restrict CORS to known origin in production. Falls back to "*" if
// ALLOWED_ORIGIN isn't set (e.g. in development). Configure via
//   supabase secrets set ALLOWED_ORIGIN=https://ujebong.com
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // BUG-008: Authenticate the caller. The Supabase config has verify_jwt=false
    // for this function (formData multipart payloads bypass the platform JWT
    // check on some CLI versions), so we do the check ourselves.
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
    const { data: userData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const CLOUD_NAME = "djud8hb8d";
    const API_KEY = "849613855898236";
    const API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET");
    if (!API_SECRET) throw new Error("CLOUDINARY_API_SECRET not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "ujebong";

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // BUG-027: Cloudinary's signing format is sorted_params + secret with NO
    // separator before the secret. The format below ("folder=...&timestamp=...
    // &transformation=q_auto,f_auto" + API_SECRET) matches Cloudinary's
    // documented spec — DO NOT add an `&` before API_SECRET.
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}&transformation=q_auto,f_auto${API_SECRET}`;

    const encoder = new TextEncoder();
    const data = encoder.encode(paramsToSign);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("api_key", API_KEY);
    uploadForm.append("timestamp", timestamp);
    uploadForm.append("signature", signature);
    uploadForm.append("folder", folder);
    uploadForm.append("transformation", "q_auto,f_auto");

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: uploadForm }
    );

    const result = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(`Cloudinary upload failed [${uploadRes.status}]: ${JSON.stringify(result)}`);
    }

    return new Response(
      JSON.stringify({
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Cloudinary upload error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
