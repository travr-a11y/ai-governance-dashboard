import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Model classification (mirrors MODEL_CLASS in index.html) ─────────────────

function classifyModel(modelId: string): string {
  const id = (modelId || "").toLowerCase();
  if (id.includes("opus")) return "Opus";
  if (id.includes("sonnet")) return "Sonnet";
  if (id.includes("haiku")) return "Haiku";
  return "Other";
}

// ─── CSV parser (handles quoted fields with embedded commas) ──────────────────

function parseCSVRows(text: string): Array<Record<string, string>> {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') {
        inQ = !inQ;
      } else if (ch === "," && !inQ) {
        values.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    values.push(cur.trim());
    return Object.fromEntries(
      headers.map((h, i) => [h, (values[i] ?? "").replace(/^"|"$/g, "")]),
    );
  });
}

// ─── Ingest Anthropic CSV rows into usage_rows ────────────────────────────────

async function ingestUsageRows(
  sb: ReturnType<typeof createClient>,
  uploadId: string,
  fileName: string,
  text: string,
): Promise<void> {
  // Extract start date from filename pattern YYYY-MM-DD-to-YYYY-MM-DD
  const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})-to-/);
  const rowDate = dateMatch ? dateMatch[1] : null;

  const rows = parseCSVRows(text);
  if (!rows.length) return;

  // Validate this is an Anthropic admin CSV by checking required headers
  const required = [
    "user_email",
    "model",
    "product",
    "total_requests",
    "total_prompt_tokens",
    "total_completion_tokens",
    "total_net_spend_usd",
  ];
  if (!required.every((h) => h in rows[0])) return;

  // Delete existing rows for this upload first (idempotency — safe to re-process)
  await sb.from("usage_rows").delete().eq("upload_id", uploadId);

  const insertRows = rows
    .filter((r) => r.user_email && r.model)
    .map((r) => ({
      upload_id: uploadId,
      user_email: r.user_email.toLowerCase().trim(),
      model_id: r.model.trim(),
      model_class: classifyModel(r.model),
      product: r.product?.trim() || null,
      requests: parseInt(r.total_requests || "0", 10) || 0,
      prompt_tokens: parseInt(r.total_prompt_tokens || "0", 10) || 0,
      completion_tokens: parseInt(r.total_completion_tokens || "0", 10) || 0,
      net_spend_usd: parseFloat(r.total_net_spend_usd || "0") || 0,
      row_date: rowDate,
    }));

  if (!insertRows.length) return;

  // Batch insert in groups of 500
  const batchSize = 500;
  for (let i = 0; i < insertRows.length; i += batchSize) {
    const { error } = await sb
      .from("usage_rows")
      .insert(insertRows.slice(i, i + batchSize));
    if (error) console.error("usage_rows insert error:", error);
  }
  console.log(`usage_rows: inserted ${insertRows.length} rows for upload ${uploadId}`);
}

// ─── Chunker (unchanged) ──────────────────────────────────────────────────────

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

// ─── Embeddings via OpenRouter ────────────────────────────────────────────────

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

// ─── Main handler ─────────────────────────────────────────────────────────────

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
      return new Response(
        JSON.stringify({ error: "Storage download failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const text = await blob.text();

    // ── Step 1: Parse Anthropic CSV into usage_rows (runs without OpenRouter key) ──
    if (row.file_type === "anthropic-csv") {
      await ingestUsageRows(sb, uploadId, row.file_name, text);
    }

    // ── Step 2: Chunk and embed (skipped if no OpenRouter key) ───────────────────
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
          usage_rows_ingested: row.file_type === "anthropic-csv",
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
    const insertChunks = chunks.map((chunk_text, chunk_index) => ({
      upload_id: uploadId,
      chunk_index,
      chunk_text,
      embedding: allEmb[chunk_index],
      file_type: row.file_type,
      metadata: { file_name: row.file_name },
    }));
    const { error: e3 } = await sb.from("document_chunks").insert(insertChunks);
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
