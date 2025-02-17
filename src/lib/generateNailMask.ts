import sharp from "sharp";
import { Hands } from "mediapipe-hands"; // Biblioteca não-oficial para Node

// Tamanho da imagem para a qual faremos a análise
const TARGET_WIDTH = 512;
const TARGET_HEIGHT = 512;

/**
 * Gera uma máscara onde as unhas (regiões próximas às pontas dos dedos) 
 * ficam em branco e o resto em preto.
 * @param inputBuffer Buffer da imagem original
 */
export async function generateNailMask(inputBuffer: Buffer): Promise<Buffer> {
  // 1. Redimensionar imagem para 512x512 (fit: cover)
  const resizedBuffer = await sharp(inputBuffer)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover" })
    .jpeg({ quality: 80 })
    .toBuffer();

  // 2. Detectar landmarks com MediaPipe
  // Obs.: A biblioteca “mediapipe-hands” pode ter métodos diferentes; verifique a doc.
  const hands = new Hands({
    locateFile: file => `node_modules/mediapipe-hands/${file}`, 
    // Pode ser necessário ajustar de acordo com o wrapper
  });

  // Inicializar e rodar a detecção
  // Esse wrapper específico pode exigir uma imagem de caminho ou base64
  // Leia a doc do “mediapipe-hands” para ver como fazer a inferência corretamente.
  const detectionResults = await hands.detect(resizedBuffer);

  // 3. Criar uma imagem em branco (tudo preto) para desenhar as unhas
  // Vamos usar "sharp.raw()" para conseguir escrever pixel a pixel
  let mask = Buffer.alloc(TARGET_WIDTH * TARGET_HEIGHT * 4, 0); // RGBA, tudo zero = preto

  // 4. Para cada mão detectada, desenhar círculos (ou elipses) nas pontas dos dedos
  for (const result of detectionResults) {
    // A estrutura exata de 'result' depende da biblioteca
    // Em geral, "landmarks" é um array de 21 pontos
    // Indices: [8, 12, 16, 20] costumam ser as pontas dos dedos
    // mas verifique a doc do mediapipe-hands

    const { landmarks } = result;
    if (landmarks) {
      const fingertipIndices = [8, 12, 16, 20]; // Pontas de cada dedo
      for (const idx of fingertipIndices) {
        const { x, y } = landmarks[idx];
        // x,y normalmente vem normalizado entre 0 e 1
        const px = Math.round(x * TARGET_WIDTH);
        const py = Math.round(y * TARGET_HEIGHT);

        // Desenhar um pequeno círculo (~10px) ao redor do ponto
        const radius = 10;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius) {
              const drawX = px + dx;
              const drawY = py + dy;
              if (
                drawX >= 0 && drawX < TARGET_WIDTH &&
                drawY >= 0 && drawY < TARGET_HEIGHT
              ) {
                const index = (drawY * TARGET_WIDTH + drawX) * 4;
                // RGBA -> branco = 255,255,255,255
                mask[index] = 255;
                mask[index + 1] = 255;
                mask[index + 2] = 255;
                mask[index + 3] = 255;
              }
            }
          }
        }
      }
    }
  }

  // 5. Converter o buffer "mask" em imagem PNG usando sharp
  const maskPng = await sharp(mask, {
    raw: {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  return maskPng;
}
