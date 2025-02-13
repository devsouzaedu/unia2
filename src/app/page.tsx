"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const router = useRouter();

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedImage(event.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage || isLoading) return;  // Impede requests múltiplos
    setIsLoading(true);

    const formData = new FormData();
    formData.append("image", selectedImage);
    formData.append("guidance_scale", guidanceScale.toString());

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.urls) {
        router.push(`/design?urls=${encodeURIComponent(JSON.stringify(data.urls))}`);
      } else {
        alert("Erro: Nenhum resultado foi retornado.");
      }
    } catch (error) {
      console.error("Erro inesperado:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">App de Nail Art 💅</h1>
      <p className="text-lg mb-4 text-gray-600 text-center">Faça upload de uma imagem de inspiração!</p>

      <input type="file" accept="image/*" onChange={handleImageChange} className="mb-4" />

      <label className="mb-2">
        Guidance Scale (Controle do Prompt): {guidanceScale}
      </label>
      <input
        type="range"
        min="5"
        max="15"
        step="0.1"
        value={guidanceScale}
        onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
        className="w-full mb-4"
      />

      <button
        onClick={handleGenerate}
        disabled={isLoading}  // Desativa o botão durante o carregamento
        className={`px-4 py-2 rounded text-white ${
          isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {isLoading ? "Gerando..." : "Gerar Design de Unhas"}
      </button>
    </div>
  );
}
