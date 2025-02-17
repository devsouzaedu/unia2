import { NextResponse } from "next/server";
import sharp from "sharp";
import fetch from "node-fetch";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { generateNailMask } from "../../../lib/generateNailMask";

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

// Função que processa a imagem com Stability AI utilizando a máscara automática
async function processImage(image: File, userPrompt: string): Promise<string> {
  console.log("=== Iniciando processImage com Stability AI ===");
  const overallStart = Date.now();

  // Converter a imagem em Buffer
  const conversionStart = Date.now();
  const originalBuffer = Buffer.from(await image.arrayBuffer());
  console.log(`Conversão para Buffer: ${Date.now() - conversionStart} ms`);

  // Redimensionar a imagem para 512x512 para usar como init_image
  const resizeStart = Date.now();
  const resizedBuffer = await sharp(originalBuffer)
    .resize(512, 512, { fit: "cover" })
    .jpeg({ quality: 80 })
    .toBuffer();
  console.log(`Redimensionamento (init_image): ${Date.now() - resizeStart} ms`);

  // Gerar a máscara automática das unhas (usa seu helper)
  const maskStart = Date.now();
  const maskBuffer = await generateNailMask(originalBuffer);
  console.log(`Geração da máscara: ${Date.now() - maskStart} ms`);

  // Converter ambas as imagens para Base64 (data URI)
  const base64Init = `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;
  const base64Mask = `data:image/png;base64,${maskBuffer.toString("base64")}`;

  // Compor o prompt final
  const finalPrompt = `Using the submitted hand photo, modify only the nail polish on the five nails. The hand must remain exactly as in the original photo. ${userPrompt}`;
  console.log("Final prompt:", finalPrompt);

  // Chamada à Stability AI – endpoint para image-to-image inpainting
  const stabilityStart = Date.now();
  const response = await fetch(
    "https://api.stability.ai/v1/generation/stable-diffusion-inpainting-v2-1/image-to-image",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_STABILITY_API_KEY}`,
      },
      body: JSON.stringify({
        init_image: base64Init,
        mask_image: base64Mask,
        text_prompts: [{ text: finalPrompt }],
        cfg_scale: 7,
        denoising_strength: 0.75,
        height: 512,
        width: 512,
        samples: 1,
        steps: 30,
      }),
    }
  );
  console.log(`Chamada ao Stability API: ${Date.now() - stabilityStart} ms`);

  // Obter e tratar a resposta da API
  const result = await response.json();
  console.log("Resultado do Stability API:", result);

  if (result.artifacts && result.artifacts.length > 0) {
    const generatedImageBase64 = result.artifacts[0].base64;
    console.log(`processImage finalizado em ${Date.now() - overallStart} ms`);
    // Retorna a imagem gerada como data URL (que pode ser exibida diretamente)
    return `data:image/png;base64,${generatedImageBase64}`;
  } else {
    throw new Error("Nenhuma imagem gerada pela Stability API");
  }
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