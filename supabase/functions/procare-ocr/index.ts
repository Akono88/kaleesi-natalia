const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You extract daycare activity data from Procare app screenshots.
Return ONLY a valid JSON array. Each entry needs: cat, time, text.

Category mapping rules:
- MEALS → cat: "feed". Include what was eaten and how much (all/some/none) in text.
- BATHROOM | DIAPER → cat: "potty". Include wet/dirty/BM in text.
- WONDER TIME or learning activities → cat: "activity". Include lesson name in text.
- SIGN-IN / SIGN-OUT → cat: "note". Text: "Signed in @ TIME" or "Signed out @ TIME".
- Music/movement/art activities → cat: "activity". Include activity description.
- NAP or SLEEP entries → cat: "sleep". Include start/end in text.
- Any other entry → cat: "note".

Time format: "H:MM AM" or "H:MM PM" (12-hour, e.g. "9:30 AM", "11:45 AM").
Return ONLY the JSON array, no markdown, no explanation.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image, media_type } = await req.json();

    if (!image || !media_type) {
      return new Response(
        JSON.stringify({ error: "Missing image or media_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type, data: image } },
              { type: "text", text: SYSTEM_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: err?.error?.message || `API error ${resp.status}` }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    let text = data.content[0].text.trim();
    // Strip markdown fences if present
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const entries = JSON.parse(text);

    return new Response(JSON.stringify({ entries }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("procare-ocr error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
