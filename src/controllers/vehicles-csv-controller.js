import { prisma } from "../helpers/utils.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'fast-csv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const importVehiclesFromCSV = async (req, reply) => {
  try {
    // Verificar se a requisição é multipart
    if (!req.isMultipart()) {
      return reply.status(400).send({
        success: false,
        message: "A requisição deve ser do tipo multipart/form-data"
      });
    }

    // Obter o arquivo enviado
    const data = await req.file();

    if (!data) {
      return reply.status(400).send({
        success: false,
        message: "Nenhum arquivo foi enviado"
      });
    }

    // Verificar extensão do arquivo
    const fileExtension = path.extname(data.filename).toLowerCase();
    if (fileExtension !== '.csv') {
      return reply.status(400).send({
        success: false,
        message: "O arquivo deve ser um CSV"
      });
    }

    // Criar diretório temporário se não existir
    const tempDir = path.join(__dirname, '../../uploads/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Salvar arquivo temporariamente
    const tempFilePath = path.join(tempDir, `vehicle_import_${Date.now()}.csv`);
    await data.toBuffer();
    await fs.promises.writeFile(tempFilePath, await data.toBuffer());

    // Resultados da importação
    const results = {
      success: 0,
      failed: 0,
      duplicates: 0,
      errors: []
    };

    // Processar o CSV
    const vehicles = [];

    // Usar promisify para trabalhar com promises
    await new Promise((resolve, reject) => {
      fs.createReadStream(tempFilePath)
        .pipe(csv.parse({ headers: true, ignoreEmpty: true, trim: true }))
        .on('error', error => {
          fs.unlinkSync(tempFilePath);
          reject(error);
        })
        .on('data', async (row) => {
          try {
            // Mapear campos do CSV para o modelo
            const vehicle = {
              completeName: row.NOME || '',
              tagName: row.POSTO || '',
              carModel: row.MODELO || '',
              licensePlate: row.PLACA || '',
              color: row.COR || '',
              // Campos obrigatórios que não estão no CSV, usar valores padrão
              driverLicense: 'N/A',
              idNumber: 'N/A',
              company: 'N/A',
              section: 'N/A'
            };

            // Validar campos obrigatórios
            if (!vehicle.completeName || !vehicle.licensePlate || !vehicle.carModel) {
              results.failed++;
              results.errors.push({
                linha: results.success + results.failed + results.duplicates,
                erro: "Campos obrigatórios ausentes (NOME, PLACA ou MODELO)",
                dados: row
              });
              return;
            }

            vehicles.push(vehicle);
          } catch (error) {
            results.failed++;
            results.errors.push({
              linha: results.success + results.failed + results.duplicates,
              erro: error.message,
              dados: row
            });
          }
        })
        .on('end', async () => {
          resolve();
        });
    });

    // Verificar duplicatas no banco e inserir registros
    for (const vehicle of vehicles) {
      try {
        // Verificar se o veículo já existe
        const existingVehicle = await prisma.vehicles.findFirst({
          where: {
            licensePlate: vehicle.licensePlate
          }
        });

        if (existingVehicle) {
          results.duplicates++;
          results.errors.push({
            placa: vehicle.licensePlate,
            erro: "Veículo já cadastrado com esta placa",
            dados: vehicle
          });
          continue;
        }

        // Inserir o veículo
        await prisma.vehicles.create({
          data: vehicle
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          placa: vehicle.licensePlate,
          erro: error.message,
          dados: vehicle
        });
      }
    }

    // Remover arquivo temporário
    fs.unlinkSync(tempFilePath);

    // Retornar resultados
    return reply.status(200).send({
      success: true,
      message: "Importação concluída",
      results: {
        total: results.success + results.failed + results.duplicates,
        sucessos: results.success,
        falhas: results.failed,
        duplicados: results.duplicates,
        erros: results.errors
      }
    });
  } catch (error) {
    console.error('Erro na importação de veículos:', error);
    return reply.status(500).send({
      success: false,
      message: "Erro ao processar o arquivo CSV",
      error: error.message
    });
  }
};