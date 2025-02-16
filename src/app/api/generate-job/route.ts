import { NextResponse } from "next/server";
import Replicate from "replicate";
import FormData from "form-data";
import fetch from "node-fetch";
import sharp from "sharp";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// Função para criar um job no Supabase
async function createJob(): Promise<string> {
  const jobId = Math.random().toString(36).substring(2, 10);
  const { error } = await supabaseAdmin
    .from("jobs")
    .insert([{ id: jobId, status: "pending" }]);
  if (error) {
    console.error("Erro ao criar job:", error);
  }
  return jobId;
}

// Função para atualizar um job no Supabase
async function updateJob(
  jobId: string,
  update: { status?: string; result?: string; error?: string }
) {
  const { error } = await supabaseAdmin
    .from("jobs")
    .update(update)
    .eq("id", jobId);
  if (error) {
    console.error("Erro ao atualizar job:", error);
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

// Função que processa a imagem e inclui logs de tempo para cada etapa
async function processImage(image: File, userPrompt: string): Promise<string> {
  console.log("=== Iniciando processImage ===");
  const overallStart = Date.now();

  // Conversão da imagem para Buffer
  const conversionStart = Date.now();
  const originalBuffer = Buffer.from(await image.arrayBuffer());
  console.log(`Conversão para Buffer: ${Date.now() - conversionStart} ms`);

  // Redimensionamento da imagem
  const resizeStart = Date.now();
  const resizedBuffer = await sharp(originalBuffer)
    .resize({ width: 500, withoutEnlargement: true })
    .toBuffer();
  console.log(`Redimensionamento: ${Date.now() - resizeStart} ms`);

  // Converter o buffer redimensionado para base64
  const base64Image = `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;

  // Compor o prompt final
  const finalPrompt = `Using the submitted hand photo, modify only the nail polish on the five nails. DO NOT change any part of the hand (including skin tone, texture, or details). Apply the following design exclusively to the nails: ${userPrompt}. The hand must remain exactly as in the original photo.`;
  console.log("Final prompt:", finalPrompt);

  // Chamada ao Replicate
  const replicateStart = Date.now();
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
  console.log(`Chamada ao Replicate: ${Date.now() - replicateStart} ms`);

  // Converter a resposta do Replicate para Buffer(s)
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
    throw new Error("Formato de saída inesperado");
  }
  console.log("Número de imagens obtidas:", output.length);

  // Seleciona o buffer da melhor imagem
  let chosenBuffer: Buffer;
  if (output.length > 1) {
    chosenBuffer = output.reduce((prev, curr) =>
      curr.length > prev.length ? curr : prev
    );
  } else {
    chosenBuffer = output[0];
  }
  console.log("Buffer escolhido, tamanho:", chosenBuffer.length);

  // Upload da imagem para o Cloudinary
  const uploadStart = Date.now();
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
  console.log(`Upload para o Cloudinary: ${Date.now() - uploadStart} ms`);

  console.log(`processImage finalizado em ${Date.now() - overallStart} ms`);
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
      return NextResponse.json({ error: "Imagem inválida" }, { status: 400 });
    }
    const jobId = await createJob();
    console.log("Job criado com ID:", jobId);
    const response = NextResponse.json({ jobId });

    // Processa a imagem em background sem bloquear a resposta
    setTimeout(async () => {
      try {
        console.log(`=== Iniciando processamento do job ${jobId} ===`);
        const startTime = Date.now();
        const resultUrl = await processImage(image, userPrompt);
        console.log(`Job ${jobId} finalizado. Tempo total: ${Date.now() - startTime} ms`);
        await updateJob(jobId, { status: "done", result: resultUrl });
      } catch (error) {
        await updateJob(jobId, { status: "error", error: error.toString() });
        console.error("Erro no processamento do job", jobId, error);
      }
    }, 0);

    return response;
  } catch (error) {
    console.error("Erro interno no servidor:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
