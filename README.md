# 🚗 Sistema de Controle de Visitantes e Estacionamento - GDA

![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat&logo=node.js&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-4.20-000000?style=flat&logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.0-2D3748?style=flat&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-4169E1?style=flat&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker&logoColor=white)

API REST para gerenciamento de entrada e saída de veículos, controle de visitantes, permissionários e pessoas não autorizadas.

> **⚠️ Projeto em Desenvolvimento**  
> Este sistema está em constante evolução e melhorias.

> **📖 Documentação Completa**  
> Para instruções sobre como rodar o sistema completo (backend + frontend), consulte o [README do repositório principal](../README.md).

> **⚠️ AVISO**  
> Provavelmente na primeira vez que você rodar o sistema, o banco vai ter iniciado antes do backend e a incializaao vai falhar, basta reiniciar o docker compose que vai funcionar.

## 📋 Índice

- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Funcionalidades](#funcionalidades)
- [Arquitetura e Segurança](#arquitetura-e-segurança)
- [Instalação e Configuração](#instalação-e-configuração)
- [Autenticação e Autorização](#autenticação-e-autorização)
- [Mapa de Rotas da API](#mapa-de-rotas-da-api)
- [Fluxo de Teste Completo](#fluxo-de-teste-completo)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Docker](#docker)

---

## 🛠 Tecnologias Utilizadas

### Backend

- **Node.js 20** - Runtime JavaScript
- **Fastify 4.20** - Framework web de alta performance
- **Prisma ORM 5.0** - ORM moderno para Node.js e TypeScript
- **PostgreSQL** - Banco de dados relacional

### Autenticação e Segurança

- **JWT (jsonwebtoken 9.0)** - Tokens de autenticação
- **@fastify/cookie** - Gerenciamento de cookies HTTP
- **bcrypt 5.1** - Hash de senhas
- **@fastify/helmet** - Headers de segurança

### Upload e Arquivos

- **@fastify/multipart 7.0** - Upload de arquivos
- **@fastify/static 6.0** - Servir arquivos estáticos
- **fast-csv 5.0** - Importação de CSV

### Integrações

- **axios 1.6** - Cliente HTTP para integração com câmeras de vigilância
- **@fastify/cors 8.0** - Habilitação de CORS

---

## 🎯 Funcionalidades

### Gestão de Veículos

- Cadastro e consulta de veículos autorizados
- Importação em massa via CSV
- Busca por placa

### Controle de Entradas

- Registro de entradas e saídas de veículos
- Agendamento de visitas (para perfil S2)
- Diferenciação entre visitantes e permissionários
- Consulta por período

### Permissionários

- Cadastro de permissionários com foto
- Validação por CPF e QR Code
- Armazenamento de dados veiculares

### Pessoas Não Autorizadas

- Registro de pessoas impedidas de entrar
- Consulta rápida por guardas

### Sistema de Vigilância

- Integração com câmeras de segurança
- Captura automática de fotos

### Imagens do Sistema

- Upload de logo personalizado
- Upload de imagem de fundo (background)
- Reset para imagens padrão

---

## 🔐 Arquitetura e Segurança

### Autenticação JWT + Cookies

O sistema utiliza uma abordagem híbrida de autenticação:

1. **JWT (JSON Web Token)**: Tokens assinados contendo informações do usuário
2. **HTTP-Only Cookies**: Armazenamento seguro do token no navegador
3. **Múltiplos níveis de autorização**: Baseado em roles (GUARDA, S2, Scmt)

#### Como funciona o JWT?

```
┌─────────────┐      Login       ┌─────────────┐
│   Cliente   │ ───────────────> │   Backend   │
│  (Browser)  │                  │             │
└─────────────┘                  └─────────────┘
                                        │
                                        │ 1. Valida credenciais
                                        │ 2. Gera JWT
                                        │ 3. Assina com JWT_SECRET
                                        │
                                        ▼
                      ┌──────────────────────────────────┐
                      │  JWT = Header.Payload.Signature  │
                      │                                  │
                      │  Payload: {                      │
                      │    id: 123,                      │
                      │    login: "usuario",             │
                      │    role: "S2",                   │
                      │    exp: 1735689600               │
                      │  }                               │
                      └──────────────────────────────────┘
                                        │
                                        │ Cookie HTTP-Only
                                        ▼
┌─────────────┐    Set-Cookie     ┌─────────────┐
│   Cliente   │ <──────────────── │   Backend   │
│             │  accessToken=...  │             │
└─────────────┘                   └─────────────┘
```

### Níveis de Autorização

| Role              | Permissões                                                       |
| ----------------- | ---------------------------------------------------------------- |
| **S2**            | Acesso total - Cadastros, importações, configurações do sistema  |
| **Guarda**        | Registro de entradas/saídas, consulta de pessoas não autorizadas |
| **Scmt**          | Permissões similares ao Guarda                                   |
| **Usuário Comum** | Apenas consultas básicas                                         |

### Middleware de Autenticação

```javascript
verifyToken(); // Verifica se o usuário está autenticado
verifyS2Role(); // Verifica se o usuário é S2
verifyGuardaRole(); // Verifica se o usuário é Guarda, S2 ou Scmt
```

---

## 📦 Instalação e Configuração

### Pré-requisitos

- Docker
- Sistema pensado para rodar via docker

```

### Estrutura de Diretórios

```

backend/
├── src/
│ ├── server.js # Configuração do servidor Fastify
│ ├── controllers/ # Lógica de negócio
│ ├── routes/ # Definição de rotas
│ ├── middleware/ # Autenticação e validação
│ └── helpers/ # Funções utilitárias
├── prisma/
│ ├── schema.prisma # Modelo do banco de dados
│ └── migrations/ # Histórico de migrações
├── uploads/ # Arquivos enviados
│ ├── visitors/ # Fotos de visitantes
│ ├── permissionarios/ # Fotos de permissionários
│ ├── pessoas-nao-autorizadas/
│ └── temp/ # Arquivos temporários
└── public/
└── img/ # Logo e background do sistema

````

---

## 🔑 Autenticação e Autorização

### 1. Fluxo de Login

```http
POST /login
Content-Type: application/json

{
  "login": "usuario",
  "password": "senha123"
}
````

**Resposta de Sucesso:**

```json
{
  "message": "Login realizado com sucesso",
  "user": {
    "id": 1,
    "login": "usuario",
    "role": "S2"
  }
}
```

**Cookie Criado:**

```
Set-Cookie: accessToken=eyJhbGc...; HttpOnly; Path=/; Max-Age=28800
```

### 2. Usando o Token

Após o login, o navegador envia automaticamente o cookie em todas as requisições. Para testar com ferramentas como Postman/Insomnia:

**Opção 1: Cookie (recomendado)**

```
Cookie: accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Opção 2: Header Authorization (fallback)**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Verificar Autenticação

```http
GET /auth/check
Cookie: accessToken=...
```

**Resposta:**

```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "login": "usuario",
    "role": "S2"
  }
}
```

### 4. Logout

```http
POST /logout
Cookie: accessToken=...
```

Remove o cookie de autenticação.

---

## 🗺 Mapa de Rotas da API

### 🔓 Autenticação (sem autenticação necessária)

| Método | Rota      | Descrição                      | Body                        |
| ------ | --------- | ------------------------------ | --------------------------- |
| POST   | `/login`  | Realiza login e retorna cookie | `{ login, password }`       |
| POST   | `/signup` | Cria novo usuário              | `{ login, password, role }` |
| POST   | `/logout` | Remove cookie de autenticação  | -                           |

### 🔒 Usuários (requer autenticação)

| Método | Rota              | Descrição                 | Acesso |
| ------ | ----------------- | ------------------------- | ------ |
| GET    | `/users`          | Lista todos os usuários   | Todos  |
| GET    | `/auth/check`     | Verifica autenticação     | Todos  |
| PATCH  | `/updateUser/:id` | Atualiza dados do usuário | Todos  |
| PATCH  | `/updPass/:id`    | Atualiza senha            | Todos  |
| DELETE | `/deleteUser/:id` | Remove usuário            | Todos  |

### 🚗 Veículos

| Método | Rota                            | Descrição                | Acesso |
| ------ | ------------------------------- | ------------------------ | ------ |
| GET    | `/vehicles`                     | Lista todos os veículos  | Todos  |
| GET    | `/vehicles/:id`                 | Busca veículo por ID     | Todos  |
| GET    | `/vehiclebyplate/:licensePlate` | Busca veículo por placa  | Todos  |
| POST   | `/vehicles`                     | Cadastra novo veículo    | Todos  |
| PATCH  | `/vehicles/:id`                 | Atualiza veículo         | Todos  |
| DELETE | `/vehicles/:id`                 | Remove veículo           | Todos  |
| POST   | `/vehicles/import-csv`          | Importa veículos via CSV | S2     |

### 📝 Entradas/Saídas

| Método | Rota              | Descrição                  | Acesso      |
| ------ | ----------------- | -------------------------- | ----------- |
| GET    | `/entries`        | Lista todas as entradas    | Autenticado |
| GET    | `/entries/:id`    | Busca entrada por ID       | Autenticado |
| POST   | `/entries`        | Registra nova entrada      | Autenticado |
| POST   | `/entries/byDate` | Busca entradas por período | Autenticado |
| PATCH  | `/entries`        | Atualiza entrada           | Guarda/S2   |
| POST   | `/exits`          | Registra saída             | Guarda/S2   |

### 📅 Agendamentos

| Método | Rota                             | Descrição                | Acesso    |
| ------ | -------------------------------- | ------------------------ | --------- |
| POST   | `/entries/schedule`              | Cria agendamento         | S2        |
| GET    | `/entries/scheduled`             | Lista agendamentos       | Guarda/S2 |
| POST   | `/entries/scheduled/byDate`      | Agendamentos por período | Todos     |
| PATCH  | `/entries/scheduled/:id/confirm` | Confirma agendamento     | Guarda/S2 |

### 👤 Permissionários

| Método | Rota                        | Descrição               | Acesso      |
| ------ | --------------------------- | ----------------------- | ----------- |
| GET    | `/permissionarios`          | Lista permissionários   | Autenticado |
| GET    | `/permissionarios/:id`      | Busca por ID            | S2          |
| GET    | `/permissionarioByCPF/:cpf` | Busca por CPF           | Público     |
| POST   | `/permissionarios`          | Cadastra permissionário | S2          |
| PATCH  | `/permissionarios/:id`      | Atualiza permissionário | S2          |
| DELETE | `/permissionarios/:id`      | Remove permissionário   | S2          |

### 🚫 Pessoas Não Autorizadas

| Método | Rota                           | Descrição            | Acesso    |
| ------ | ------------------------------ | -------------------- | --------- |
| GET    | `/pessoas-nao-autorizadas`     | Lista todas          | Guarda/S2 |
| GET    | `/pessoas-nao-autorizadas/:id` | Busca por ID         | Guarda/S2 |
| POST   | `/pessoas-nao-autorizadas`     | Cadastra nova pessoa | S2        |
| PATCH  | `/pessoas-nao-autorizadas/:id` | Atualiza dados       | S2        |
| DELETE | `/pessoas-nao-autorizadas/:id` | Remove registro      | S2        |

### 👨‍✈️ Motoristas

| Método | Rota          | Descrição          | Acesso |
| ------ | ------------- | ------------------ | ------ |
| GET    | `/driver`     | Lista motoristas   | Todos  |
| GET    | `/driver/:id` | Busca por ID       | Todos  |
| POST   | `/driver`     | Cadastra motorista | Todos  |
| PATCH  | `/driver/:id` | Atualiza motorista | Todos  |
| DELETE | `/driver/:id` | Remove motorista   | Todos  |

### 📸 Imagens

| Método | Rota                                        | Descrição                       | Acesso      |
| ------ | ------------------------------------------- | ------------------------------- | ----------- |
| GET    | `/images/visitors/:filename`                | Imagem de visitante             | Autenticado |
| HEAD   | `/images/visitors/:filename`                | Verifica se imagem existe       | Autenticado |
| GET    | `/images/permissionarios/:filename`         | Imagem de permissionário        | Autenticado |
| GET    | `/images/pessoas-nao-autorizadas/:filename` | Imagem de pessoa não autorizada | Guarda/S2   |

### 🖼️ Imagens do Sistema (Logo e Background)

| Método | Rota                               | Descrição               | Acesso      |
| ------ | ---------------------------------- | ----------------------- | ----------- |
| POST   | `/system-images/upload/logo`       | Upload de logo          | S2          |
| POST   | `/system-images/upload/background` | Upload de background    | S2          |
| GET    | `/system-images/current`           | Lista imagens atuais    | Autenticado |
| GET    | `/system-images/:filename`         | Exibe imagem do sistema | Público     |
| DELETE | `/system-images/:type`             | Reseta para padrão      | S2          |

### 📹 Vigilância

| Método | Rota                         | Descrição              | Acesso |
| ------ | ---------------------------- | ---------------------- | ------ |
| GET    | `/surveillance/latest-photo` | Captura foto da câmera | Todos  |

---

## 🧪 Fluxo de Teste Completo

### Ferramentas Recomendadas

- **Postman** ou **Insomnia** para testes de API
- **curl** para linha de comando

### Passo 1: Criar Usuário (Signup)

```bash
curl -X POST http://localhost:5000/signup \
  -H "Content-Type: application/json" \
  -d '{
    "login": "teste_s2",
    "password": "senha123",
    "role": "S2"
  }'
```

### Passo 2: Fazer Login

```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "login": "teste_s2",
    "password": "senha123"
  }'
```

**Importante:** A flag `-c cookies.txt` salva os cookies recebidos.

### Passo 3: Verificar Autenticação

```bash
curl -X GET http://localhost:5000/auth/check \
  -b cookies.txt
```

### Passo 4: Acessar Rota Protegida

```bash
# Listar veículos (rota autenticada)
curl -X GET http://localhost:5000/vehicles \
  -b cookies.txt
```

### Passo 5: Cadastrar Veículo

```bash
curl -X POST http://localhost:5000/vehicles \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "completeName": "João Silva",
    "tagName": "João",
    "carModel": "Gol",
    "licensePlate": "ABC1234",
    "color": "Prata",
    "driverLicense": "12345678900",
    "idNumber": "987654321",
    "company": "FAB",
    "section": "Admin"
  }'
```

### Passo 6: Registrar Entrada

```bash
curl -X POST http://localhost:5000/entries \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "type": "ENTRADA",
    "isVisitor": true,
    "name": "Maria Santos",
    "idNumber": "123456789",
    "licensePlate": "XYZ5678",
    "carModel": "Corolla",
    "color": "Preto",
    "target": "Visita ao setor administrativo",
    "contactPerson": "João Silva"
  }'
```

### Passo 7: Upload de Imagem do Sistema

```bash
# Upload de logo
curl -X POST http://localhost:5000/system-images/upload/logo \
  -b cookies.txt \
  -F "file=@/caminho/para/logo.png"

# Upload de background
curl -X POST http://localhost:5000/system-images/upload/background \
  -b cookies.txt \
  -F "file=@/caminho/para/background.jpg"
```

### Passo 8: Logout

```bash
curl -X POST http://localhost:5000/logout \
  -b cookies.txt
```

### Teste no Postman

1. **Fazer Login:**

   - POST `http://localhost:5000/login`
   - Body (JSON):
     ```json
     {
       "login": "teste_s2",
       "password": "senha123"
     }
     ```
   - O Postman automaticamente salvará o cookie

2. **Testar Rota Protegida:**

   - GET `http://localhost:5000/vehicles`
   - O cookie será enviado automaticamente

3. **Ver Cookie:**
   - Em Postman: Aba "Cookies" → Visualizar `accessToken`
   - Em Insomnia: Aba "Timeline" → Ver cookies enviados

---

## 🌍 Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Banco de Dados
DATABASE_URL="postgresql://usuario:senha@localhost:5432/controle_gda"

# JWT
JWT_SECRET="seu-secret-super-seguro-aqui-min-32-chars"

# Cookies
COOKIE_SECRET="controle-gda-cookie-secret-2025"

# Ambiente
NODE_ENV="development"  # ou "production"

# Sistema de Vigilância (opcional)
SURVEILLANCE_API_URL="https://192.168.1.100"
SURVEILLANCE_API_CAMERA="camera01"
SURVEILLANCE_API_USERNAME="admin"
SURVEILLANCE_API_PASSWORD="senha123"
```

## 📝 Notas Importantes

### Segurança do JWT

- O `JWT_SECRET` deve ter no mínimo 32 caracteres
- Tokens expiram em 8 horas
- Cookies são HTTP-Only (não acessíveis via JavaScript)

### Upload de Imagens

- Limite de 5MB por arquivo
- Formatos aceitos: JPG, JPEG, PNG
- Imagens são armazenadas em diretórios separados por tipo

### Banco de Dados

- As migrações são executadas automaticamente no start do Docker
- Use `npx prisma studio` para visualizar dados localmente

### CORS

- Configurado para permitir todas as origens em desenvolvimento
- Em produção, configure origens específicas

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

---

## 👥 Suporte

Para dúvidas e suporte:

- Abra uma issue no repositório
- Entre em contato com a equipe de desenvolvimento
