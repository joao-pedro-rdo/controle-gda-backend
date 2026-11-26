# Atualizar para usar Node 20
FROM node:20

# Definir o diretório de trabalho
WORKDIR /app

# Copiar apenas os arquivos de dependências primeiro (cache layer)
COPY package.json package-lock.json ./

# Instalar dependências usando apenas NPM
RUN npm ci --only=production

# Copiar os arquivos da aplicação
COPY . .

# Gerar o cliente Prisma no build (com internet), baixando todos os engines de
# binaryTargets. A subida do container não pode depender de download: os
# servidores rodam em intranet, e `prisma generate` no CMD ficava travado
# tentando baixar engines de binaries.prisma.sh.
RUN ./node_modules/.bin/prisma generate

# Criar diretórios necessários
RUN mkdir -p /app/uploads/visitors /app/uploads/permissionarios /app/uploads/temp
RUN chmod -R 755 /app/uploads

# Expor a porta
EXPOSE 5000

# Prisma no runtime: sem telemetria/checagem de versão (rede offline)
ENV CHECKPOINT_DISABLE=1

# Comando de inicialização: só aplica migrações e sobe a API
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && npm start"]
