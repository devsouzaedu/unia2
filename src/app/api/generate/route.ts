import { NextResponse } from "next/server";
import sharp from "sharp";

// Função que processa a imagem com Stability AI (image-to-image inpainting)
async function processImage(image: File, userPrompt: string): Promise<string> {
  console.log("=== Iniciando processImage com Stability AI ===");
  const overallStart = Date.now();
  
  // Converter o arquivo em Buffer
  const conversionStart = Date.now();
  const originalBuffer = Buffer.from(await image.arrayBuffer());
  console.log(`Conversão para Buffer: ${Date.now() - conversionStart} ms`);
  
  // Redimensionar e comprimir a imagem para 512x512
  const resizeStart = Date.now();
  const resizedBuffer = await sharp(originalBuffer)
    .resize(512, 512, { fit: "cover" })
    .jpeg({ quality: 70 })
    .toBuffer();
  console.log(`Redimensionamento: ${Date.now() - resizeStart} ms`);
  
  // Converter a imagem redimensionada para base64 (com prefixo de data URI)
  const base64Image = `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;
  
  // Compor o prompt final
  const finalPrompt = `Using the submitted hand photo, modify only the nail polish on the five nails. DO NOT change any part of the hand (including skin tone, texture, or details). Apply the following design exclusively to the nails: ${userPrompt}. The hand must remain exactly as in the original photo.`;
  console.log("Final prompt:", finalPrompt);
  
  // Chamada à Stability AI – endpoint para image-to-image (inpainting)
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
        init_image: base64Image,
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
    // Retorna a imagem gerada como data URL (pode ser exibida diretamente no navegador)
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
    
    console.log("Iniciando processamento com Stability AI...");
    const resultUrl = await processImage(image, userPrompt);
    console.log("Processamento concluído, retornando imagem gerada.");
    
    return NextResponse.json({ result: resultUrl });
  } catch (error) {
    console.error("Erro no endpoint /generate:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
