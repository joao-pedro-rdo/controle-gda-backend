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

# # Gerar o cliente Prisma
# RUN npx prisma generate

# Criar diretórios necessários
RUN mkdir -p /app/uploads/visitors /app/uploads/permissionarios /app/uploads/temp
RUN chmod -R 755 /app/uploads

# Criar diretório para imagens do sistema (logo e background)
RUN mkdir -p /app/public/img
RUN chmod -R 755 /app/public

# Expor a porta
EXPOSE 5000

# Comando de inicialização
CMD ["sh", "-c", "./node_modules/.bin/prisma generate && ./node_modules/.bin/prisma migrate deploy && npm start"]