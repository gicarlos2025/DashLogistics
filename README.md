# DashLogistics

Dashboard web estático para acompanhar estoque e movimentações de um centro de distribuição. A interface permite consultar setembro e outubro de 2026, visualizar indicadores por mês e filtrar o painel pelas semanas do mês selecionado.

## Funcionalidades

- Visão geral com valor do estoque, total de SKUs, quantidade total e itens críticos.
- Gráficos de valores por categoria, status/distribuição e movimentação semanal.
- Tabelas de entradas e saídas com base nas movimentações registradas nas planilhas.
- Inventário detalhado com quantidade, valor calculado e status de reposição.
- Seleção de mês entre setembro e outubro de 2026.
- Filtro semanal aplicado aos indicadores, gráficos e tabelas de movimentação.
- Cards de semana ocultos na página de Inventário.

## Arquivos

- `dashboard.html`: estrutura e estilos da interface.
- `script.js`: navegação, cálculos, filtros, renderização das tabelas e gráficos.
- `inventory-data.js`: dados locais usados pelo dashboard no navegador.
- `Tabela_Estoque_CD_Setembro_2026.xlsx`: planilha de setembro de 2026.
- `Tabela_Estoque_CD_Outubro_2026.xlsx`: planilha de outubro de 2026.
- `requirements.txt`: informa que não há dependências Python para instalar.

## Requisitos

- Navegador moderno com suporte a JavaScript.
- Acesso à internet para carregar Chart.js, Font Awesome e a fonte Poppins por CDN.
- Não é necessário instalar pacotes Python ou Node.js para visualizar o dashboard.

## Como executar

É possível abrir `dashboard.html` diretamente no navegador. Como alternativa, com Python 3 instalado, inicie um servidor HTTP na pasta do projeto:

```bash
python -m http.server 8000
```

Depois, abra <http://localhost:8000/dashboard.html>.

## Atualização dos dados

O navegador lê os dados de `inventory-data.js`; ele não importa arquivos Excel diretamente. Ao atualizar uma planilha mensal, atualize também a entrada do mês correspondente em `inventory-data.js`, preservando os campos consumidos por `script.js`:

| Campo | Descrição |
| --- | --- |
| `sku` | Código do produto |
| `name` | Descrição do material |
| `category` | Categoria do material |
| `address` | Endereço de armazenagem |
| `quantity` | Saldo atual em estoque |
| `unit` | Unidade de medida |
| `unitCost` | Custo unitário |
| `minimum` | Estoque mínimo |
| `entryQuantity` / `entryDate` | Quantidade e data de entrada |
| `exitQuantity` / `exitDate` | Quantidade e data de saída |

As datas devem estar no formato `DD/MM/AAAA`. Se uma linha da planilha não tiver uma movimentação, use `null` nos campos correspondentes de quantidade e data. Os totais financeiros são calculados no dashboard como quantidade em estoque multiplicada pelo custo unitário; os valores de entrada e saída são calculados pela quantidade movimentada multiplicada pelo custo unitário.

## Observações

- O dashboard é uma aplicação somente de leitura: não há banco de dados, API ou persistência de alterações.
- O filtro semanal considera semanas de calendário, de domingo a sábado, com os dias inicial e final do mês ajustados ao período consultado.
- Os dados das planilhas são snapshots mensais; os cards semanais agregam os SKUs que tiveram entradas ou saídas na semana e apresentam o saldo atual desses SKUs.
- Informações não existentes nas planilhas, como número de nota fiscal, ordem de serviço, destino e status de entrega, não são exibidas nas tabelas de movimentação.
