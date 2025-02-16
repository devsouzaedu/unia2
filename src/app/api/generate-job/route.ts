import { NextResponse } from "next/server";
import Replicate from "replicate";
import FormData from "form-data";
import fetch from "node-fetch";
import sharp from "sharp";

// Global job store (apenas para demonstração)
if (!globalThis.jobs) {
  globalThis.jobs = {};
}
const jobs: Record<
  string,
  { status: "pending" | "processing" | "done" | "error"; result?: string; error?: string }
> = globalThis.jobs;

// Funções para manipular jobs
function createJob(): string {
  const jobId = Math.random().toString(36).substring(2, 10);
  jobs[jobId] = { status: "pending" };
  return jobId;
}

function updateJob(
  jobId: string,
  update: Partial<{ status: string; result?: string; error?: string }>
) {
  if (jobs[jobId]) {
    console.log(`Updating job ${jobId} - New Status: ${JSON.stringify(update)}`);
    jobs[jobId] = { ...jobs[jobId], ...update };
  }
}

// Função auxiliar para converter um ReadableStream em Buffer
async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// Função que processa a imagem: redimensiona, envia para o modelo e faz upload no Cloudinary
async function processImage(image: File, userPrompt: string): Promise<string> {
  // Converte a imagem para Buffer
  const originalBuffer = Buffer.from(await image.arrayBuffer());

  // Redimensiona a imagem para uma largura máxima de 500px (mantendo a proporção)
  const resizedBuffer = await sharp(originalBuffer)
    .resize({ width: 500, withoutEnlargement: true })
    .toBuffer();

  // Converte o buffer redimensionado para base64
  const base64Image = `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;

  // Compor o prompt final
  const finalPrompt = `Using the submitted hand photo, modify only the nail polish on the five nails. DO NOT change any part of the hand (including skin tone, texture, or details). Apply the following design exclusively to the nails: ${userPrompt}. The hand must remain exactly as in the original photo.`;
  console.log("Final prompt:", finalPrompt);

  console.log("Sending the image to the ControlNet model...");
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  const outputRaw: unknown = await replicate.run(
    "jagilley/controlnet-canny:aff48af9c68d162388d230a2ab003f68d2638d88307bdaf1c2f1ac95079c9613",
    {
      input: {
        image: base64Image,
        prompt: finalPrompt,
        negative_prompt: "hand, skin, face, full body, background, non-nail areas",
        guidance_scale: 6.5,
        num_outputs: 1,
      },
    }
  );
  console.log("Replicate response (outputRaw):", outputRaw);

  // Converter o output para array de Buffer
  let output: Buffer[] = [];
  if (
    Array.isArray(outputRaw) &&
    outputRaw.length > 0 &&
    typeof (outputRaw[0] as any).getReader === "function"
  ) {
    output = await Promise.all(
      (outputRaw as ReadableStream[]).map(async (stream) => await streamToBuffer(stream))
    );
  } else if (typeof outputRaw === "string") {
    output = [Buffer.from(outputRaw, "binary")];
  } else if (Array.isArray(outputRaw) && typeof outputRaw[0] === "string") {
    output = (outputRaw as string[]).map((s) => Buffer.from(s, "binary"));
  } else {
    throw new Error("Unexpected output format");
  }
  console.log("Expected format confirmed. Output length:", output.length);

  // Se houver mais de uma imagem, escolhe a melhor (maior em tamanho)
  let chosenBuffer: Buffer;
  if (output.length > 1) {
    chosenBuffer = output.reduce((prev, curr) =>
      curr.length > prev.length ? curr : prev
    );
  } else {
    chosenBuffer = output[0];
  }
  console.log("Chosen buffer for upload, size:", chosenBuffer.length);
  console.log("Uploading the image to Cloudinary...");

  const cloudinaryForm = new FormData();
  cloudinaryForm.append("file", chosenBuffer, "nail.png");
  cloudinaryForm.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET!);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: cloudinaryForm,
    }
  );
  const uploadResult = await uploadResponse.json();
  console.log("Cloudinary response:", uploadResult);
  return uploadResult.secure_url;
}

// Configuração para permitir execuções de até 60 segundos
export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const userPrompt = formData.get("prompt")?.toString() || "";
    if (!image || !(image instanceof File)) {
      return NextResponse.json({ error: "Invalid image" }, { status: 400 });
    }
    const jobId = createJob();
    console.log("Job created with ID:", jobId);
    const response = NextResponse.json({ jobId });

    // Processa a imagem em background (sem bloquear a resposta)
    setTimeout(async () => {
      try {
        const resultUrl = await processImage(image, userPrompt);
        updateJob(jobId, { status: "done", result: resultUrl });
        console.log("Job", jobId, "completed with result:", resultUrl);
      } catch (error) {
        updateJob(jobId, { status: "error", error: error.toString() });
        console.error("Job", jobId, "failed with error:", error);
      }
    }, 0);

    return response;
  } catch (error) {
    console.error("Unexpected server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
