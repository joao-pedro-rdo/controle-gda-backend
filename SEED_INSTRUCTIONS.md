# 🌱 Guia de Popular o Banco de Dados

## 📦 Instalação

Primeiro, instale a biblioteca Faker:

```powershell
npm install --save-dev @faker-js/faker
```

## 🚀 Como Executar

### Opção 1: Popular do Zero

Se você quer limpar tudo e começar do zero:

```powershell
# 1. Resetar o banco (CUIDADO: Apaga tudo!)
npx prisma migrate reset --force

# 2. Executar o seed
node prisma/seed-faker.js
```

### Opção 2: Adicionar Dados ao Banco Existente

Se você só quer adicionar mais dados:

```powershell
node prisma/seed-faker.js
```

## 📊 O Que Será Criado?

O script `seed-faker.js` vai criar:

| Entidade                    | Quantidade | Descrição                                         |
| --------------------------- | ---------- | ------------------------------------------------- |
| **Usuários**                | 3          | s2, guarda, scmt (todos com senha: teste123)      |
| **Veículos**                | 50         | Veículos de militares cadastrados                 |
| **Permissionários**         | 30         | Trabalhadores com acesso regular                  |
| **Pessoas Não Autorizadas** | 10         | Lista de pessoas proibidas                        |
| **Motoristas**              | 20         | Motoristas habilitados                            |
| **Viaturas**                | 15         | Veículos militares                                |
| **Missões**                 | 25         | Missões cadastradas (ativas e inativas)           |
| **Entradas**                | 150        | 80 visitantes + 40 permissionários + 30 militares |

## 🔐 Credenciais Geradas

Após executar o seed, você terá 3 usuários para testar:

```
Login: s2        | Senha: teste123 | Role: S2
Login: guarda    | Senha: teste123 | Role: Guarda
Login: scmt      | Senha: teste123 | Role: Scmt
```

## 🎲 Dados Gerados

### Placas de Veículos

- Formato antigo: `ABC-1234`
- Formato Mercosul: `ABC1D23`

### Nomes

- Nomes brasileiros realistas (Faker locale pt_BR)

### Telefones

- Formato: `(XX) XXXXX-XXXX`

### Datas

- Entradas: Entre dezembro/2024 e hoje
- Missões: Entre janeiro/2024 e hoje

### Status Realistas

- ~40% das entradas ainda não saíram (pessoas dentro)
- ~30% das missões ainda estão ativas
- ~30% dos permissionários não têm carro

## 🔧 Customizações

### Alterar Quantidades

Edite as linhas no `seed-faker.js`:

```javascript
for (let i = 0; i < 50; i++) {
  // ← Altere o número aqui
  // criar veículos
}
```

### Adicionar Novos Dados

Você pode adicionar mais modelos nas arrays:

```javascript
const carModels = [
  "Gol",
  "Civic",
  "Corolla",
  "SEU_MODELO_AQUI", // ← Adicione aqui
];
```

## 📈 Métricas do Prometheus

Com esses dados, você terá métricas interessantes:

```promql
# Total de entradas nos últimos 30 dias
sum(increase(entries_total[30d]))

# Pessoas dentro do quartel
sum(increase(entries_total[24h])) - sum(increase(exits_total[24h]))

# Entradas por tipo
sum by (type) (entries_total)
```

## 🧹 Limpar Apenas Dados (Manter Schema)

Se quiser apagar apenas os dados sem resetar as migrações:

```powershell
# PowerShell
node -e "import('c:/Users/joaop/projects/controle-visitantes-estacionamento/backend/prisma/clear-data.js')"
```

Crie o arquivo `prisma/clear-data.js`:

```javascript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function clear() {
  console.log("🧹 Limpando dados...");

  await prisma.entry.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.viatura.deleteMany();
  await prisma.pessoaNaoAutorizada.deleteMany();
  await prisma.permissionario.deleteMany();
  await prisma.vehicles.deleteMany();
  await prisma.user.deleteMany();

  console.log("✅ Dados limpos!");
}

clear().finally(() => prisma.$disconnect());
```

## ⚠️ Avisos Importantes

1. **Não execute em produção!** Este script é apenas para desenvolvimento
2. **Backup**: Faça backup antes de usar `migrate reset`
3. **CPF/RG**: São números aleatórios, não são validados
4. **Imagens**: O script não cria imagens, apenas deixa os campos vazios

## 🐛 Troubleshooting

### Erro: CPF duplicado

- Normal! O script ignora e tenta novamente
- Pode acontecer com números aleatórios

### Erro: Foreign key constraint

- Certifique-se que as migrations estão atualizadas:

```powershell
npx prisma migrate deploy
```

### Banco não está vazio após reset

- Verifique se há conexões abertas:

```powershell
# Parar containers Docker
docker-compose down

# Resetar novamente
npx prisma migrate reset --force
```

## 📚 Referências

- [Faker.js Documentation](https://fakerjs.dev/)
- [Prisma Seeding](https://www.prisma.io/docs/guides/database/seed-database)
- [Locale PT-BR](https://fakerjs.dev/guide/localization.html)

---

**Pronto para testar!** 🚀
