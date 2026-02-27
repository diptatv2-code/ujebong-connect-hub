import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });
    }

    const results: { table: string; id: string; old_url: string; new_url: string }[] = [];
    const errors: { table: string; id: string; error: string }[] = [];

    // Helper to upload URL to Cloudinary
    async function uploadToCloudinary(imageUrl: string, folder: string): Promise<string> {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const paramsToSign = `folder=${folder}&timestamp=${timestamp}&transformation=q_auto,f_auto${API_SECRET}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-1", encoder.encode(paramsToSign));
      const signature = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

      const form = new FormData();
      form.append("file", imageUrl);
      form.append("api_key", API_KEY);
      form.append("timestamp", timestamp);
      form.append("signature", signature);
      form.append("folder", folder);
      form.append("transformation", "q_auto,f_auto");

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      return data.secure_url;
    }

    const isSupabaseUrl = (url: string) =>
      url && (url.includes("supabase.co/storage") || url.includes("supabase.in/storage"));

    // Migrate posts
    const { data: posts } = await supabase.from("posts").select("id, image_url").not("image_url", "is", null);
    for (const post of (posts || [])) {
      if (!isSupabaseUrl(post.image_url)) continue;
      try {
        const newUrl = await uploadToCloudinary(post.image_url, "ujebong/posts");
        await supabase.from("posts").update({ image_url: newUrl }).eq("id", post.id);
        results.push({ table: "posts", id: post.id, old_url: post.image_url, new_url: newUrl });
      } catch (e: any) {
        errors.push({ table: "posts", id: post.id, error: e.message });
      }
    }

    // Migrate profiles (avatar_url, cover_photo_url)
    const { data: profiles } = await supabase.from("profiles").select("id, avatar_url, cover_photo_url");
    for (const p of (profiles || [])) {
      if (p.avatar_url && isSupabaseUrl(p.avatar_url)) {
        try {
          const newUrl = await uploadToCloudinary(p.avatar_url, "ujebong/avatars");
          await supabase.from("profiles").update({ avatar_url: newUrl }).eq("id", p.id);
          results.push({ table: "profiles.avatar", id: p.id, old_url: p.avatar_url, new_url: newUrl });
        } catch (e: any) {
          errors.push({ table: "profiles.avatar", id: p.id, error: e.message });
        }
      }
      if (p.cover_photo_url && isSupabaseUrl(p.cover_photo_url)) {
        try {
          const newUrl = await uploadToCloudinary(p.cover_photo_url, "ujebong/covers");
          await supabase.from("profiles").update({ cover_photo_url: newUrl }).eq("id", p.id);
          results.push({ table: "profiles.cover", id: p.id, old_url: p.cover_photo_url, new_url: newUrl });
        } catch (e: any) {
          errors.push({ table: "profiles.cover", id: p.id, error: e.message });
        }
      }
    }

    // Migrate group_posts
    const { data: groupPosts } = await supabase.from("group_posts").select("id, image_url").not("image_url", "is", null);
    for (const gp of (groupPosts || [])) {
      if (!isSupabaseUrl(gp.image_url)) continue;
      try {
        const newUrl = await uploadToCloudinary(gp.image_url, "ujebong/group-posts");
        await supabase.from("group_posts").update({ image_url: newUrl }).eq("id", gp.id);
        results.push({ table: "group_posts", id: gp.id, old_url: gp.image_url, new_url: newUrl });
      } catch (e: any) {
        errors.push({ table: "group_posts", id: gp.id, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({ migrated: results.length, errors: errors.length, results, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Migration error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
