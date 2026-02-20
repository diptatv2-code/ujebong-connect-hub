import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("METERED_API_KEY");
    if (!apiKey) {
      throw new Error("METERED_API_KEY not configured");
    }

    console.log("Using API key starting with:", apiKey.substring(0, 6) + "...", "length:", apiKey.length);

    const url = `https://ujebong.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`;
    console.log("Fetching:", url.replace(apiKey, "***"));
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Metered API error:", response.status, errorText);
      throw new Error(`Metered API returned ${response.status}`);
    }

    const iceServers = await response.json();
    console.log("Fetched", iceServers.length, "ICE servers from Metered");

    return new Response(JSON.stringify({ iceServers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching TURN credentials:", error);
    // Return fallback STUN-only servers so calls can still attempt
    return new Response(
      JSON.stringify({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
        fallback: true,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
