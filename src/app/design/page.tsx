"use client";

// Força renderização dinâmica (não pré-renderiza a página)
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Image from "next/image";

export default function DesignPage() {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    // Executa apenas no cliente
    const searchParams = new URLSearchParams(window.location.search);
    try {
      const parsed = JSON.parse(searchParams.get("urls") || "[]");
      setUrls(parsed);
    } catch (error) {
      console.error("Erro ao parsear URLs:", error);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <h1 className="text-4xl font-bold text-blue-600 mb-6">Design de Nail Art 💅</h1>
      <p className="text-lg text-gray-600 mb-6 text-center">
        Aqui estão suas unhas inspiradas na imagem enviada!
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {urls.map((url: string, index: number) => (
          <Image
            key={index}
            src={url}
            alt={`Unha ${index + 1}`}
            width={128}
            height={128}
            className="rounded shadow"
            unoptimized={true}
          />
        ))}
      </div>
    </div>
  );
}
