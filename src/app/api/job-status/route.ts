// api/job-status/route.tsx
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Parâmetro jobId ausente" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !data) {
    console.error("Erro ao buscar job:", error);
    return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });
  }
  console.log(`Checando job ${jobId} - Status atual: ${JSON.stringify(data)}`);
  return NextResponse.json(data);
}
