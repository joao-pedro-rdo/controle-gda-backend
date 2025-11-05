import fastify from 'fastify';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ao invés de usar FastifyPluginAsync, use uma função assíncrona padrão
const surveillanceRoutes = async (app, opts) => {
    // Configuração do sistema de vigilância a partir do .env
    const SURVEILLANCE_API_URL = process.env.SURVEILLANCE_API_URL;
    const SURVEILLANCE_API_CAMERA = process.env.SURVEILLANCE_API_CAMERA;
    const SURVEILLANCE_API_USERNAME = process.env.SURVEILLANCE_API_USERNAME;
    const SURVEILLANCE_API_PASSWORD = process.env.SURVEILLANCE_API_PASSWORD;

    // Diretório temporário para armazenar imagens
    const tempDir = path.join(__dirname, '../../uploads/temp');

    // Cria o diretório temporário se não existir
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    // Rota para obter a última foto do sistema de vigilância
    app.get('/surveillance/latest-photo', async (request, reply) => {
        try {
            // Nome do arquivo temporário baseado no timestamp atual
            const timestamp = Date.now();
            const tempFilePath = path.join(tempDir, `GDA_RECEPCAO_${timestamp}.jpg`);

            // Configuração do axios para fazer requisição com autenticação básica e ignorar erros de SSL
            const axiosInstance = axios.create({
                auth: {
                    username: SURVEILLANCE_API_USERNAME,
                    password: SURVEILLANCE_API_PASSWORD
                },
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false // Ignora erros de certificado SSL (equivalente ao -k do curl)
                }),
                responseType: 'arraybuffer'  // Para receber dados binários
            });

            // URL da imagem mais recente
            const imageUrl = `${SURVEILLANCE_API_URL}/${SURVEILLANCE_API_CAMERA}/latest.jpg`;

            // Fazendo a requisição HTTP
            console.log(`Fazendo requisição para: ${imageUrl}`);
            const response = await axiosInstance.get(imageUrl);

            // Escreve o arquivo temporário
            fs.writeFileSync(tempFilePath, response.data);
            console.log(`Imagem salva temporariamente em: ${tempFilePath}`);

            // Converte a imagem para base64
            const imageBuffer = fs.readFileSync(tempFilePath);
            const imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

            // Opcional: remover o arquivo temporário após conversão
            fs.unlinkSync(tempFilePath);

            return { imageBase64 };
        } catch (error) {
            console.error('Erro ao buscar imagem do sistema de vigilância:', error);
            reply.status(500).send({
                error: 'Não foi possível obter a imagem do sistema de vigilância',
                details: error.message
            });
        }
    });
};

export default surveillanceRoutes;