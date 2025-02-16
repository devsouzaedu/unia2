import { NextResponse } from "next/server";

// Garante que o armazenamento global esteja definido
if (!globalThis.jobs) {
  globalThis.jobs = {};
}
const jobs: Record<
  string,
  { status: "pending" | "processing" | "done" | "error"; result?: string; error?: string }
> = globalThis.jobs;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }
  const job = jobs[jobId];
  console.log(`Checking job ${jobId} - Current Status: ${JSON.stringify(job)}`);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}
