import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Generate signature
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}&transformation=q_auto,f_auto${API_SECRET}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(paramsToSign);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Upload to Cloudinary
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
