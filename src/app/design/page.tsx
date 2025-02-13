"use client";

// Force dynamic rendering (avoid pre-rendering)
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function DesignPage() {
  const [url, setUrl] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Executa apenas no cliente e extrai o parâmetro "url" da query string
    const searchParams = new URLSearchParams(window.location.search);
    const urlParam = searchParams.get("url") || "";
    setUrl(urlParam);
  }, []);

  const handleBack = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-6">
      <h1 className="text-4xl font-bold mb-6 text-pink-400">Sua Ideia de Unha 💅</h1>
      {url ? (
        <div className="relative w-96 h-96 mb-8">
          <Image
            src={url}
            alt="Imagem gerada"
            fill
            className="object-contain rounded shadow-lg"
          />
        </div>
      ) : (
        <p className="text-white">Nenhuma imagem encontrada.</p>
      )}
      <button
        onClick={handleBack}
        className="mt-4 px-6 py-3 bg-pink-500 text-white rounded hover:bg-pink-600 transition-colors"
      >
        Gerar outra ideia
      </button>
    </div>
  );
}
