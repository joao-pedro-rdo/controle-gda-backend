# 📊 Guia Completo de Métricas com Prometheus

## 🎯 Índice

1. [Visão Geral](#visão-geral)
2. [Instalação e Setup](#instalação-e-setup)
3. [Métricas Disponíveis](#métricas-disponíveis)
4. [Como Usar no Grafana](#como-usar-no-grafana)
5. [Monitoramento de CPU/RAM/Storage](#monitoramento-de-cpuramStorage)
6. [Queries Úteis (PromQL)](#queries-úteis-promql)

---

## 🎯 Visão Geral

### O que foi implementado?

✅ **Métricas HTTP Automáticas**

- Latência de requisições
- Total de requisições por endpoint
- Taxa de erros

✅ **Métricas de Negócio**

- Entradas (visitantes, permissionários, militares)
- Saídas
- Agendamentos
- Tempo de permanência
- Tentativas de login

✅ **Métricas de Cadastros**

- Total de veículos
- Total de permissionários
- Total de pessoas não autorizadas
- Total de usuários por role

---

## 🚀 Instalação e Setup

### 1. Instalar dependência

```bash
npm install prom-client
```

### 2. Iniciar o servidor

```bash
npm start
```

### 3. Verificar métricas

Acesse: http://localhost:5000/metrics

Você verá algo como:

```
# HELP entries_total Total de entradas registradas no sistema
# TYPE entries_total counter
entries_total{type="visitor",status="success",scheduled="false"} 125
entries_total{type="permissionario",status="success",scheduled="false"} 340

# HELP http_request_duration_seconds Duração das requisições HTTP
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1",method="POST",path="/entries",status="201"} 100
```

---

## 📊 Métricas Disponíveis

### 1. Métricas HTTP (Performance)

| Métrica                         | Tipo      | Descrição                 | Labels               |
| ------------------------------- | --------- | ------------------------- | -------------------- |
| `http_requests_total`           | Counter   | Total de requisições HTTP | method, path, status |
| `http_request_duration_seconds` | Histogram | Duração das requisições   | method, path, status |

**Como funciona:**

- Toda requisição HTTP é automaticamente medida
- Paths com IDs são normalizados (ex: `/vehicles/123` → `/vehicles/:id`)

### 2. Métricas de Entradas/Saídas

| Métrica                   | Tipo      | Descrição             | Labels                  |
| ------------------------- | --------- | --------------------- | ----------------------- |
| `entries_total`           | Counter   | Total de entradas     | type, status, scheduled |
| `exits_total`             | Counter   | Total de saídas       | type                    |
| `stay_duration_hours`     | Histogram | Tempo de permanência  | type                    |
| `scheduled_entries_total` | Counter   | Total de agendamentos | status                  |

**Types disponíveis:**

- `visitor` - Visitantes
- `permissionario` - Permissionários
- `militar` - Militares

**Exemplo de uso:**

```javascript
// No controller, quando uma entrada é registrada:
incrementEntryCounter("visitor", false, "success");
```

### 3. Métricas de Cadastros (Gauges)

| Métrica                      | Tipo  | Descrição                        |
| ---------------------------- | ----- | -------------------------------- |
| `vehicles_registered_total`  | Gauge | Total de veículos cadastrados    |
| `permissionarios_total`      | Gauge | Total de permissionários         |
| `unauthorized_persons_total` | Gauge | Total de pessoas não autorizadas |
| `users_total`                | Gauge | Total de usuários (por role)     |

**Como funciona:**

- Atualizadas automaticamente a cada 1 minuto
- Consultam o banco de dados via Prisma

### 4. Métricas de Autenticação

| Métrica                | Tipo    | Descrição           | Labels       |
| ---------------------- | ------- | ------------------- | ------------ |
| `login_attempts_total` | Counter | Tentativas de login | status, role |
| `active_sessions`      | Gauge   | Sessões ativas      | role         |

**Status:**

- `success` - Login bem-sucedido
- `failed` - Login falhou

### 5. Métricas de Uploads

| Métrica               | Tipo      | Descrição           | Labels       |
| --------------------- | --------- | ------------------- | ------------ |
| `image_uploads_total` | Counter   | Total de uploads    | type, status |
| `upload_size_bytes`   | Histogram | Tamanho dos uploads | type         |

---

## 🎨 Como Usar no Grafana

### Configurar Datasource

1. Abra o Grafana: http://localhost:3001
2. Configuration → Data Sources → Add data source
3. Selecione "Prometheus"
4. URL: `http://prometheus:9090` (ou `http://localhost:9090`)
5. Save & Test

### Dashboards Recomendados

#### 📈 Dashboard 1: Controle de Fluxo

**Painel 1: Entradas por Tipo (últimas 24h)**

```promql
sum(increase(entries_total[24h])) by (type)
```

**Painel 2: Entradas vs Saídas**

```promql
# Entradas
sum(increase(entries_total[1h]))

# Saídas
sum(increase(exits_total[1h]))
```

**Painel 3: Entradas por Hora do Dia**

```promql
sum(increase(entries_total[1h])) by (type)
```

#### 📊 Dashboard 2: Métricas Diárias (5h às 5h)

Para ver entradas do dia começando às 5h da manhã:

**Query no Grafana:**

```promql
# Entradas de permissionários do dia (5h às 5h)
sum(increase(entries_total{type="permissionario"}[24h] offset 5h))

# Entradas de visitantes
sum(increase(entries_total{type="visitor"}[24h] offset 5h))

# Entradas de militares
sum(increase(entries_total{type="militar"}[24h] offset 5h))
```

**Configuração do Time Range no Grafana:**

- Vá em "Dashboard Settings" → "Time Options"
- Selecione "Custom time"
- Configure para iniciar às 5h

**Filtro por Range de Data e Hora:**

```promql
# Entradas entre 01/12/2025 05:00 e 02/12/2025 05:00
entries_total{type="permissionario"}[24h] @ 1733220000
```

#### ⚡ Dashboard 3: Performance

**Painel 1: Latência Média por Endpoint**

```promql
rate(http_request_duration_seconds_sum[5m]) /
rate(http_request_duration_seconds_count[5m])
```

**Painel 2: Taxa de Requisições por Segundo**

```promql
sum(rate(http_requests_total[1m])) by (path)
```

**Painel 3: Taxa de Erros**

```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) /
sum(rate(http_requests_total[5m])) * 100
```

#### 🔐 Dashboard 4: Segurança

**Painel 1: Tentativas de Login**

```promql
sum(increase(login_attempts_total[1h])) by (status, role)
```

**Painel 2: Logins Falhados (últimas 24h)**

```promql
sum(increase(login_attempts_total{status="failed"}[24h]))
```

---

## 💻 Monitoramento de CPU/RAM/Storage

### ⚠️ IMPORTANTE: A Aplicação NÃO Monitora Isso

As métricas da aplicação Node.js **NÃO INCLUEM**:

- ❌ CPU do container/servidor
- ❌ Memória RAM total do sistema
- ❌ Uso de disco/storage

### ✅ Solução: Usar cAdvisor + Node Exporter

Para monitorar recursos do sistema, você precisa adicionar ao `docker-compose.yml`:

```yaml
services:
  # Seu backend existente
  backend:
    # ... configurações existentes

  # 📊 Prometheus - Coleta métricas
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
    networks:
      - monitoring

  # 📈 Grafana - Visualização
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - monitoring
    depends_on:
      - prometheus

  # 🐳 cAdvisor - Monitora containers Docker
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    privileged: true
    devices:
      - /dev/kmsg
    networks:
      - monitoring

  # 💻 Node Exporter - Métricas do servidor Linux
  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - "--path.procfs=/host/proc"
      - "--path.sysfs=/host/sys"
      - "--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)"
    networks:
      - monitoring

volumes:
  prometheus-data:
  grafana-data:

networks:
  monitoring:
    driver: bridge
```

### Configurar Prometheus para Coletar

Criar arquivo `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # 🎯 Métricas da aplicação Node.js (este projeto)
  - job_name: "controle-gda-backend"
    static_configs:
      - targets: ["backend:5000"]
        labels:
          app: "controle-gda"
          environment: "production"

  # 🐳 Métricas dos containers Docker
  - job_name: "cadvisor"
    static_configs:
      - targets: ["cadvisor:8080"]

  # 💻 Métricas do servidor Linux
  - job_name: "node-exporter"
    static_configs:
      - targets: ["node-exporter:9100"]
```

### Queries para CPU/RAM/Storage no Grafana

#### CPU do Container Backend

```promql
# % de uso de CPU
rate(container_cpu_usage_seconds_total{name="backend"}[5m]) * 100

# CPU disponível
container_spec_cpu_quota{name="backend"} /
container_spec_cpu_period{name="backend"} * 100
```

#### Memória RAM do Container

```promql
# Memória usada em MB
container_memory_usage_bytes{name="backend"} / 1024 / 1024

# Memória disponível
container_spec_memory_limit_bytes{name="backend"} / 1024 / 1024

# % de uso
(container_memory_usage_bytes{name="backend"} /
container_spec_memory_limit_bytes{name="backend"}) * 100
```

#### Armazenamento do Servidor

```promql
# Disco usado em GB
(node_filesystem_size_bytes{mountpoint="/"} -
node_filesystem_avail_bytes{mountpoint="/"}) / 1024 / 1024 / 1024

# % de uso
(1 - (node_filesystem_avail_bytes{mountpoint="/"} /
node_filesystem_size_bytes{mountpoint="/"})) * 100
```

#### CPU do Servidor (Node Exporter)

```promql
# % de uso total
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

---

## 🔍 Queries Úteis (PromQL)

### Análises de Negócio

#### Quantas pessoas entraram hoje?

```promql
sum(increase(entries_total[24h]))
```

#### Quantas pessoas ainda estão dentro?

```promql
sum(increase(entries_total[24h])) - sum(increase(exits_total[24h]))
```

#### Tempo médio de permanência (últimas 24h)

```promql
sum(stay_duration_hours_sum) / sum(stay_duration_hours_count)
```

#### Taxa de agendamentos confirmados

```promql
sum(scheduled_entries_total{status="confirmed"}) /
sum(scheduled_entries_total{status="created"}) * 100
```

#### Entradas por hora (hoje)

```promql
sum(increase(entries_total[1h])) by (type)
```

#### Comparação semanal

```promql
# Esta semana
sum(increase(entries_total[7d]))

# Semana passada
sum(increase(entries_total[7d] offset 7d))
```

### Performance e Disponibilidade

#### Endpoint mais lento

```promql
topk(5,
  rate(http_request_duration_seconds_sum[5m]) /
  rate(http_request_duration_seconds_count[5m])
)
```

#### Taxa de sucesso (últimos 5 min)

```promql
sum(rate(http_requests_total{status=~"2.."}[5m])) /
sum(rate(http_requests_total[5m])) * 100
```

#### Uptime da aplicação

```promql
process_uptime_seconds / 60 / 60  # em horas
```

### Segurança

#### Detectar ataque de força bruta

```promql
# Mais de 10 falhas de login em 5 minutos
sum(increase(login_attempts_total{status="failed"}[5m])) > 10
```

#### Logins por role (últimas 24h)

```promql
sum(increase(login_attempts_total{status="success"}[24h])) by (role)
```

---

## 🎯 Como Filtrar por Período no Grafana

### Filtrando das 5h às 5h do dia seguinte

**Opção 1: Usando variáveis de tempo**

1. Crie uma variável `$start_offset = 5h`
2. Use na query:

```promql
sum(increase(entries_total[24h] offset $start_offset)) by (type)
```

**Opção 2: Time Range customizado**

No painel do Grafana:

- Time range: "From: now-24h, To: now"
- Adicione transformation "Filter by time" → ajuste para 5h

**Opção 3: Query com timestamp específico**

```promql
# Entradas entre 01/12 05:00 e 02/12 05:00
entries_total @ 1733047200  # timestamp Unix
```

---

## 📖 Referências

- [Prometheus Documentation](https://prometheus.io/docs/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)
- [cAdvisor](https://github.com/google/cadvisor)
- [Node Exporter](https://github.com/prometheus/node_exporter)

---

## 🆘 Troubleshooting

### Métricas não aparecem no Prometheus

1. Verifique se `/metrics` está acessível:

   ```bash
   curl http://localhost:5000/metrics
   ```

2. Verifique o `prometheus.yml`:

   ```yaml
   - targets: ["backend:5000"] # Use o nome do service no Docker
   ```

3. Verifique logs do Prometheus:
   ```bash
   docker logs prometheus
   ```

### cAdvisor não funciona no Linux

Adicione ao `docker-compose.yml`:

```yaml
privileged: true
devices:
  - /dev/kmsg
```

### Queries demoram muito

- Use intervalos menores: `[5m]` ao invés de `[24h]`
- Aumente o `scrape_interval` no Prometheus
- Use recording rules para pré-calcular queries complexas

---

## ✅ Checklist de Implementação

- [x] Instalar `prom-client`
- [x] Criar helpers/prometheus.js
- [x] Criar middleware de métricas
- [x] Criar rota /metrics
- [x] Instrumentar controllers
- [x] Atualizar gauges periodicamente
- [ ] Instalar cAdvisor e Node Exporter
- [ ] Configurar Prometheus
- [ ] Criar dashboards no Grafana

---

**🎉 Implementação concluída! Agora é só configurar o Grafana e criar seus dashboards personalizados!**
