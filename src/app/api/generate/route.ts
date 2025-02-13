import { NextResponse } from "next/server";
import Replicate from "replicate";
import FormData from "form-data";
import fetch from "node-fetch";

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

export async function POST(request: Request) {
  try {
    console.log("Recebendo a requisição de imagem...");

    const formData = await request.formData();
    const image = formData.get("image");

    if (!image || !(image instanceof File)) {
      console.error("Nenhuma imagem foi enviada ou o tipo é inválido.");
      return NextResponse.json(
        { error: "Nenhuma imagem foi enviada ou o tipo é inválido." },
        { status: 400 }
      );
    }

    console.log("Imagem recebida com sucesso, convertendo para base64...");
    const arrayBuffer = await image.arrayBuffer();
    const base64Image = `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString("base64")}`;

    console.log("Enviando a imagem para o modelo ControlNet...");

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Executa o modelo no Replicate
    const outputRaw: unknown = await replicate.run(
      "jagilley/controlnet-canny:aff48af9c68d162388d230a2ab003f68d2638d88307bdaf1c2f1ac95079c9613",
      {
        input: {
          image: base64Image,
          prompt:
            "A female hand with 10 fingers, close-up, with fingernails designed based on the inspiration image. Focus on the fingernails and their style, color, and texture. No faces, no backgrounds.",
          negative_prompt:
            "faces, full body, background, blurry, multiple people, objects unrelated to nails",
          guidance_scale: 7.5,
          num_outputs: 1,
        },
      }
    );

    console.log("Resposta do Replicate (outputRaw):", outputRaw);

    // Converter o output para um array de Buffer
    let output: Buffer[] = [];

    if (
      Array.isArray(outputRaw) &&
      outputRaw.length > 0 &&
      typeof (outputRaw[0] as any).getReader === "function"
    ) {
      // Se for um array de ReadableStream, converte cada stream em Buffer
      output = await Promise.all(
        (outputRaw as ReadableStream[]).map(async (stream) => {
          const buf = await streamToBuffer(stream);
          return buf;
        })
      );
    } else if (typeof outputRaw === "string") {
      // Se for uma string (menos provável para dados binários)
      output = [Buffer.from(outputRaw, "binary")];
    } else if (Array.isArray(outputRaw) && typeof outputRaw[0] === "string") {
      output = (outputRaw as string[]).map((s) => Buffer.from(s, "binary"));
    } else if (
      typeof outputRaw === "object" &&
      outputRaw !== null &&
      "output" in outputRaw
    ) {
      const maybeOutput = (outputRaw as any).output;
      if (Array.isArray(maybeOutput) && typeof maybeOutput[0] === "string") {
        output = maybeOutput.map((s: string) => Buffer.from(s, "binary"));
      } else {
        throw new Error(
          "Unexpected output format: propriedade 'output' não é um array de strings"
        );
      }
    } else {
      throw new Error("Unexpected output format");
    }

    console.log("Formato esperado confirmado. Output length:", output.length);
    console.log("Iniciando o upload das imagens para o Cloudinary...");

    // Para cada buffer, realiza o upload para o Cloudinary
    const urls: string[] = await Promise.all(
      output.map(async (buffer: Buffer) => {
        const cloudinaryForm = new FormData();
        // Usamos o buffer diretamente como conteúdo do arquivo
        cloudinaryForm.append("file", buffer, "unha.png");
        cloudinaryForm.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET!);

        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
          {
            method: "POST",
            body: cloudinaryForm,
          }
        );

        const uploadResult = await uploadResponse.json();
        console.log("Resposta do Cloudinary:", uploadResult);

        return uploadResult.secure_url || null;
      })
    );

    console.log("Imagens carregadas com sucesso no Cloudinary:", urls.filter(Boolean));
    return NextResponse.json({ urls: urls.filter(Boolean) });
  } catch (error) {
    console.error("Erro inesperado no servidor:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
