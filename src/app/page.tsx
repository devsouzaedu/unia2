"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserPrompt(e.target.value);
  };

  const handleGenerate = async () => {
    if (!selectedImage || isLoading) return;
    setIsLoading(true);

    const formData = new FormData();
    formData.append("image", selectedImage);
    formData.append("prompt", userPrompt);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();
      // Exibe somente a primeira imagem
      if (data.urls && data.urls.length > 0) {
        router.push(`/design?url=${encodeURIComponent(data.urls[0])}`);
      } else {
        alert("Erro: Nenhum resultado foi retornado.");
      }
    } catch (error) {
      console.error("Erro inesperado:", error);
      alert("Erro inesperado: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-900">
      <h1 className="text-4xl font-bold mb-6 text-pink-400">Unia. Crie unhas com IA 💅</h1>
      
      <input
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="mb-4 p-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
      />
      
      <input
        type="text"
        placeholder="Digite sua ideia para a unha (ex: Unhas vermelhas com corações)"
        value={userPrompt}
        onChange={handlePromptChange}
        className="mt-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 w-full max-w-md"
      />
      
      <button
        onClick={handleGenerate}
        disabled={isLoading}
        className="mt-6 px-6 py-3 bg-pink-500 text-white rounded hover:bg-pink-600 transition-colors disabled:opacity-50"
      >
        {isLoading ? "Gerando ideia de unha..." : "Gerar ideia de unha"}
      </button>
      
      {isLoading && (
        <div className="mt-6 text-white">
          <p>Processando sua imagem, por favor aguarde...</p>
          {/* Aqui você pode adicionar um spinner ou animação */}
        </div>
      )}
    </div>
  );
}
