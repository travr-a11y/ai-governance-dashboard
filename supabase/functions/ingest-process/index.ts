import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function chunkText(text: string, fileType: string): string[] {
  const maxChunk = 8000;
  const overlap = 600;
  if (!text || !text.trim()) return [];
  const t = text.trim();
  const jsonTypes = ["conversations", "projects", "memories", "users"];
  if (jsonTypes.includes(fileType)) {
    try {
      const parsed: unknown = JSON.parse(t);
      if (Array.isArray(parsed) && parsed.length) {
        const out: string[] = [];
        let cur = "";
        for (const item of parsed) {
          const part = JSON.stringify(item);
          if (cur.length + part.length > maxChunk && cur) {
            out.push(cur);
            cur = part;
          } else {
            cur = cur ? `${cur}\n${part}` : part;
          }
        }
        if (cur) out.push(cur);
        return out.length ? out : [t.slice(0, maxChunk)];
      }
    } catch {
      /* fall through */
    }
  }
  const chunks: string[] = [];
  for (let i = 0; i < t.length; i += maxChunk - overlap) {
    chunks.push(t.slice(i, i + maxChunk));
    if (i + maxChunk >= t.length) break;
  }
  return chunks.length ? chunks : [""];
}

async function embedBatch(
  chunks: string[],
  apiKey: string,
): Promise<number[][]> {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/travr-a11y/ai-governance-dashboard",
      "X-Title": "Frank Group AI Governance Dashboard",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: chunks,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter embeddings ${res.status}: ${err}`);
  }
  const json = (await res.json()) as {
    data?: Array<{ index?: number; embedding: number[] }>;
  };
  const data = json.data;
  if (!Array.isArray(data)) throw new Error("Invalid embeddings response");
  return data
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((d) => d.embedding);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const body = (await req.json()) as { upload_id?: string };
    const uploadId = body.upload_id;
    if (!uploadId || typeof uploadId !== "string") {
      return new Response(JSON.stringify({ error: "upload_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(supabaseUrl, serviceKey);
    const { data: row, error: e1 } = await sb
      .from("uploads")
      .select("id,storage_path,file_name,file_type")
      .eq("id", uploadId)
      .maybeSingle();
    if (e1 || !row) {
      return new Response(JSON.stringify({ error: "Upload not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: blob, error: e2 } = await sb.storage
      .from("uploads")
      .download(row.storage_path);
    if (e2 || !blob) {
      return new Response(JSON.stringify({ error: "Storage download failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const text = await blob.text();
    const chunks = chunkText(text, row.file_type);
    if (!chunks.length) {
      return new Response(
        JSON.stringify({ ok: true, chunks: 0, message: "Nothing to embed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!openrouterKey) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "OPENROUTER_API_KEY not set on function",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const batchSize = 16;
    const allEmb: number[][] = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const emb = await embedBatch(batch, openrouterKey);
      allEmb.push(...emb);
    }
    await sb.from("document_chunks").delete().eq("upload_id", uploadId);
    const insertRows = chunks.map((chunk_text, chunk_index) => ({
      upload_id: uploadId,
      chunk_index,
      chunk_text,
      embedding: allEmb[chunk_index],
      file_type: row.file_type,
      metadata: { file_name: row.file_name },
    }));
    const { error: e3 } = await sb.from("document_chunks").insert(insertRows);
    if (e3) {
      console.error(e3);
      return new Response(JSON.stringify({ error: String(e3.message) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ ok: true, chunks: chunks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
