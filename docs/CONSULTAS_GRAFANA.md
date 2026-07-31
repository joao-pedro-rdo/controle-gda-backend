# 📊 Consultas PromQL para Grafana - Controle de Visitantes

## ⚠️ **IMPORTANTE: Limitações dos Counters**

**Counters resetam ao reiniciar o servidor!**

- `entries_total`, `exits_total`, etc. **começam do ZERO** a cada restart
- Para dados históricos (últimas 24h), os counters só funcionam se o servidor estiver rodando há 24h
- **Solução:** Use as **Gauges** (calculadas do banco) para dados em tempo real

**Métricas que NÃO resetam (calculadas do banco a cada 60s):**

- ✅ `vehicles_registered_total` - Total no banco
- ✅ `permissionarios_total` - Total no banco
- ✅ `people_inside_om_total` - **MELHOR MÉTRICA** para saber quantas pessoas estão dentro

**Métricas que resetam (counters incrementais):**

- ⚠️ `entries_total` - Conta apenas desde o último restart
- ⚠️ `exits_total` - Conta apenas desde o último restart

---

## 🎯 Consultas Solicitadas

### 1. ✅ Quantos veículos temos cadastrados

```promql
vehicles_registered_total
```

**Tipo de painel:** Stat / Gauge  
**Descrição:** Total de veículos cadastrados no sistema  
**Atualização:** A cada 60 segundos

---

### 2. ✅ Quantos permissionários temos cadastrados

```promql
permissionarios_total
```

**Tipo de painel:** Stat / Gauge  
**Descrição:** Total de permissionários cadastrados  
**Atualização:** A cada 60 segundos

---

### 3. ✅ Quantas entradas e saídas tivemos nas últimas 24 horas

⚠️ **ATENÇÃO:** Estas queries só funcionam se o servidor estiver rodando há 24h sem restart!

#### Entradas nas últimas 24h (desde o último restart)

```promql
sum(increase(entries_total{scheduled="false"}[24h]))
```

#### Saídas nas últimas 24h (desde o último restart)

```promql
sum(increase(exits_total[24h]))
```

#### ✨ **ALTERNATIVA MELHOR: Taxa de entrada/saída por hora (tempo real)**

```promql
# Taxa de entradas por hora
sum(rate(entries_total{scheduled="false"}[5m])) * 3600

# Taxa de saídas por hora
sum(rate(exits_total[5m])) * 3600
```

#### Entradas e Saídas juntas (gráfico de linha)

```promql
# Entradas nos últimos 5 minutos (agregado por hora)
sum(increase(entries_total{scheduled="false"}[5m])) by (type) * 12

# Saídas nos últimos 5 minutos (agregado por hora)
sum(increase(exits_total[5m])) by (type) * 12
```

**Tipo de painel:** Time Series (gráfico de linha) ou Stat  
**Legenda:** Use labels diferentes para "Entradas" e "Saídas"

---

### 4. ✅ Quantos users temos dentro da OM

```promql
sum(people_inside_om_total)
```

#### Por tipo (visitantes, permissionários, militares)

```promql
people_inside_om_total
```

**Tipo de painel:** Stat / Gauge  
**Descrição:** Pessoas que entraram mas ainda não saíram (exited=false)  
**Atualização:** A cada 60 segundos

---

### 5. ⚠️ Quantos militares entraram hoje

```promql
sum(increase(entries_total{type="militar", scheduled="false"}[24h] @ end()))
```

#### Se quiser desde às 5h da manhã (início do dia militar)

```promql
# Calcular timestamp de hoje às 05:00
# Use a função time() ou configure o range no Grafana
sum(increase(entries_total{type="militar", scheduled="false"}[19h]))
```

**Tipo de painel:** Stat  
**⚠️ IMPORTANTE:** O campo `isMilitar` **NÃO EXISTE** no schema do Prisma atual.

Esta métrica **sempre retornará 0** até você:

1. Adicionar o campo ao schema:
   ```prisma
   model Entry {
     // ... campos existentes
     isMilitar Boolean? @default(false)
   }
   ```
2. Executar: `npx prisma migrate dev --name add_is_militar_field`
3. Atualizar o frontend para enviar `isMilitar: true` nas entradas de militares

---

### 6. ✅ Quantos permissionários entraram hoje

⚠️ **Limitação:** Counter reseta ao reiniciar. Mostra apenas entradas desde o último restart.

```promql
sum(increase(entries_total{type="permissionario", scheduled="false"}[24h] @ end()))
```

#### ✨ **ALTERNATIVA MELHOR: Permissionários dentro agora (calculado do banco)**

```promql
people_inside_om_total{type="permissionario"}
```

Isso mostra quantos permissionários estão **atualmente dentro** da OM (não saíram ainda).

#### Desde às 5h (horário militar)

```promql
sum(increase(entries_total{type="permissionario", scheduled="false"}[19h]))
```

**Tipo de painel:** Stat  
**Descrição:** Total de permissionários que registraram entrada hoje (desde último restart)

---

### 7. ✅ Quantos permissionários saíram hoje

```promql
sum(increase(exits_total{type="permissionario"}[24h] @ end()))
```

#### Desde às 5h

```promql
sum(increase(exits_total{type="permissionario"}[19h]))
```

**Tipo de painel:** Stat  
**Descrição:** Total de permissionários que registraram saída hoje

---

### 8. ✅ Quantos visitantes tivemos hoje

⚠️ **Limitação:** Counter reseta ao reiniciar. Mostra apenas entradas desde o último restart.

```promql
sum(increase(entries_total{type="visitor", scheduled="false"}[24h] @ end()))
```

#### ✨ **ALTERNATIVA MELHOR: Visitantes dentro agora (calculado do banco)**

```promql
people_inside_om_total{type="visitor"}
```

Isso mostra quantos visitantes estão **atualmente dentro** da OM (não saíram ainda).

#### Desde às 5h

```promql
sum(increase(entries_total{type="visitor", scheduled="false"}[19h]))
```

**Tipo de painel:** Stat  
**Descrição:** Total de visitantes que entraram hoje (sem contar agendamentos) desde o último restart

---

## 📈 Consultas Adicionais Úteis

### Total de entradas por tipo (hoje)

```promql
sum by (type) (increase(entries_total{scheduled="false"}[24h]))
```

**Visualização:** Pie chart ou Bar gauge

---

### Taxa de entrada por hora (últimas 24h)

```promql
sum(rate(entries_total{scheduled="false"}[1h])) * 3600
```

**Descrição:** Quantas pessoas entram por hora

---

### Pessoas que ainda não saíram (por tipo)

```promql
people_inside_om_total
```

**Visualização:** Bar gauge horizontal

---

### Tempo médio de permanência (em horas)

```promql
sum(stay_duration_hours_sum) / sum(stay_duration_hours_count)
```

---

### Comparação: Entradas vs Saídas (último mês)

```promql
# Entradas
sum(increase(entries_total{scheduled="false"}[30d]))

# Saídas
sum(increase(exits_total[30d]))

# Diferença (ainda dentro)
sum(increase(entries_total{scheduled="false"}[30d])) - sum(increase(exits_total[30d]))
```

---

## 🎨 Configuração de Dashboards no Grafana

### Dashboard Recomendado: "Movimentação Diária"

#### Row 1: Cadastros

- **Veículos Cadastrados:** `vehicles_registered_total`
- **Permissionários Cadastrados:** `permissionarios_total`
- **Pessoas Dentro da OM:** `sum(people_inside_om_total)`

#### Row 2: Movimentação Hoje

- **Visitantes Hoje:** `sum(increase(entries_total{type="visitor", scheduled="false"}[24h]))`
- **Permissionários Entraram:** `sum(increase(entries_total{type="permissionario", scheduled="false"}[24h]))`
- **Permissionários Saíram:** `sum(increase(exits_total{type="permissionario"}[24h]))`
- **Militares Entraram:** `sum(increase(entries_total{type="militar", scheduled="false"}[24h]))`

#### Row 3: Entradas e Saídas (24h)

- **Gráfico de Linha:**

  ```promql
  # Query A (Entradas)
  sum by (type) (increase(entries_total{scheduled="false"}[1h]))

  # Query B (Saídas)
  sum by (type) (increase(exits_total[1h]))
  ```

#### Row 4: Distribuição por Tipo

- **Pie Chart:**
  ```promql
  sum by (type) (increase(entries_total{scheduled="false"}[24h]))
  ```

---

## ⚙️ Configuração do Time Range

### Para usar horário militar (05:00 às 05:00)

1. No dashboard, vá em **Settings** → **Time Options**
2. Configure **Timezone:** `America/Sao_Paulo` (ou seu fuso)
3. Para queries "hoje desde 5h", use:

```promql
# Calcular dinamicamente
# Exemplo: agora são 14h, então desde 5h = 9 horas atrás
sum(increase(entries_total[9h]))
```

**Ou use variáveis do Grafana:**

```promql
$__range
```

---

## 🔧 Troubleshooting

### Métricas retornando 0?

1. **Verifique o endpoint:** http://localhost:5000/metrics
2. **Confirme que as métricas existem:**
   ```bash
   curl http://localhost:5000/metrics | grep entries_total
   ```

### Campos faltando no schema?

Se `isMilitar` não existe no seu schema Prisma:

```prisma
model Entry {
  // ... outros campos
  isMilitar Boolean @default(false)
}
```

Execute a migration:

```bash
npx prisma migrate dev --name add_is_militar_field
```

### Métricas não atualizam?

- As **Gauges** (totais) atualizam a cada 60 segundos automaticamente
- Os **Counters** (entries/exits) incrementam em tempo real quando há movimento
- Verifique os logs do servidor para ver se há erros

---

## 📝 Notas Importantes

1. **scheduled="false"** → Exclui agendamentos dos relatórios de movimento real
2. **[24h]** → Últimas 24 horas (use [19h] para desde as 5h)
3. **@ end()** → Força o cálculo até o momento atual
4. **increase()** → Soma o incremento no período (use para contadores)
5. **rate()** → Calcula a taxa por segundo (use para velocidade)

---

## 🆘 Suporte

Se alguma métrica não estiver funcionando:

1. Verifique o schema do Prisma (`prisma/schema.prisma`)
2. Confirme que o campo existe na tabela `Entry`
3. Verifique os logs do servidor ao registrar entrada/saída
4. Teste o endpoint `/metrics` diretamente

**Logs esperados ao registrar entrada:**

```
📊 [Prometheus] Entrada registrada: type=permissionario, scheduled=false
```

**Logs esperados ao registrar saída:**

```
📊 [Prometheus] Saída registrada: type=permissionario
```

---

## 📊 Análise dos Dados Reais do Seu Sistema

**Baseado no output atual do `/metrics`:**

### ✅ Métricas Funcionando Perfeitamente:

```
vehicles_registered_total 100
permissionarios_total 60
unauthorized_persons_total 20
```

### ✅ Nova Métrica de Pessoas Dentro da OM (FUNCIONANDO!):

```
people_inside_om_total{type="visitor"} 13
people_inside_om_total{type="permissionario"} 27
people_inside_om_total{type="militar"} 0
```

**Interpretação:**

- 13 visitantes entraram e ainda não saíram
- 27 permissionários entraram e ainda não saíram
- 0 militares (campo `isMilitar` não existe ou não usado)

### 📈 Contadores Desde o Último Restart:

```
entries_total{type="visitor",status="success",scheduled="false"} 1
exits_total{type="visitor"} 8
exits_total{type="permissionario"} 1
```

**Interpretação:**

- 1 nova entrada de visitante foi registrada desde o restart
- 8 visitantes saíram desde o restart
- 1 permissionário saiu desde o restart
- Nota: A diferença entre entradas (1) e saídas (8) é porque as saídas são de entradas antigas (antes do restart)

### 🔍 Observação Importante:

**Por que não vejo `entries_total{type="permissionario"}`?**

Porque nenhuma entrada de permissionário foi registrada **desde o último restart do servidor**. Os 27 permissionários dentro da OM são de entradas antigas que já estavam no banco de dados.

### 📊 Tempo de Permanência:

```
stay_duration_hours_sum{type="visitor"} 320.35 horas total
stay_duration_hours_count{type="visitor"} 8 saídas
Média: 40 horas por visitante
```

**Atenção:** Visitantes estão ficando em média **40 horas** dentro! Pode ser:

- Dados antigos de entradas sem saída
- Sistema usado 24/7 com permanências longas
- Necessidade de limpeza de dados antigos

---

## 🎯 Dashboard Recomendado com Base nos Dados Reais

### Panel 1: Cadastros (Row 1)

```promql
# Veículos
vehicles_registered_total

# Permissionários
permissionarios_total

# Pessoas não autorizadas
unauthorized_persons_total
```

### Panel 2: Pessoas Dentro da OM AGORA (Row 2) - MELHOR MÉTRICA

```promql
# Total dentro
sum(people_inside_om_total)

# Por tipo
people_inside_om_total
```

### Panel 3: Movimento desde o último restart (Row 3)

```promql
# Total de entradas
sum(entries_total)

# Total de saídas
sum(exits_total)
```

### Panel 4: Taxa de Entrada/Saída (Row 4)

```promql
# Entradas por minuto
sum(rate(entries_total[5m])) * 60

# Saídas por minuto
sum(rate(exits_total[5m])) * 60
```
