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

  // Função de polling com limite de tentativas (aprox. 60s no total)
  const pollJobStatus = async (jobId: string, attempts = 0) => {
    if (attempts > 20) {
      alert("Job timeout, please try again.");
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/job-status?jobId=${jobId}`);
      const data = await response.json();
      console.log("Job status:", data);
      if (data.status === "done") {
        router.push(`/design?url=${encodeURIComponent(data.result)}`);
      } else if (data.status === "error") {
        alert("An error occurred: " + data.error);
        setIsLoading(false);
      } else {
        setTimeout(() => pollJobStatus(jobId, attempts + 1), 3000);
      }
    } catch (error) {
      console.error("Error polling job status:", error);
      setTimeout(() => pollJobStatus(jobId, attempts + 1), 3000);
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage || isLoading) return;
    setIsLoading(true);

    const formData = new FormData();
    formData.append("image", selectedImage);
    formData.append("prompt", userPrompt);

    try {
      const response = await fetch("/api/generate-job", {
        method: "POST",
        body: formData,
      });
      const { jobId } = await response.json();
      console.log("Job ID:", jobId);

      // Inicia o polling imediatamente
      pollJobStatus(jobId);
    } catch (error) {
      console.error("Unexpected error:", error);
      alert("Unexpected error: " + error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-900">
      <h1 className="text-4xl font-bold mb-6 text-pink-400">Nail Art AI</h1>
      <input
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="mb-4 p-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
      />
      <input
        type="text"
        placeholder="Enter your nail art design (e.g., Red Disney Nails)"
        value={userPrompt}
        onChange={handlePromptChange}
        className="mt-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 w-full max-w-md"
      />
      <button
        onClick={handleGenerate}
        disabled={isLoading}
        className="mt-6 px-6 py-3 bg-pink-500 text-white rounded hover:bg-pink-600 transition-colors"
      >
        {isLoading ? "Generating nail art idea..." : "Generate Nail Art Idea"}
      </button>
      {isLoading && (
        <div className="mt-6 text-white">
          <p>Processing your image, please wait...</p>
        </div>
      )}
    </div>
  );
}
