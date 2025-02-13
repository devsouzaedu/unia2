/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import Replicate from "replicate";
import FormData from "form-data";
import fetch from "node-fetch";

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
    const base64Image = `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString(
      "base64"
    )}`;

    console.log("Enviando a imagem para o modelo ControlNet...");

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Força o retorno para string[] com cast
    const output = (await replicate.run(
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
    )) as unknown as string[];

    if (!Array.isArray(output) || typeof output[0] !== "string") {
      throw new Error("Unexpected output format");
    }

    console.log("Iniciando o upload das imagens geradas para o Cloudinary...");

    const urls: string[] = await Promise.all(
      output.map(async (blobUrl: string) => {
        if (typeof blobUrl !== "string") {
          throw new Error("Unexpected blobUrl type");
        }
        // Converte a URL em buffer
        const response = await fetch(blobUrl);
        const buffer = await response.buffer();

        const cloudinaryForm = new FormData();
        cloudinaryForm.append("file", buffer, "unha.jpg");
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
