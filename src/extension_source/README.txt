===========================================================
ASSISTENTE Q-BANK & PACER - VERSÃO 1.9
===========================================================

Novidades da Versão 1.9:
- ⚡ Correção Cirúrgica na Extração de Explicação vs Educational Objective:
  - O cabeçalho 'Educational objective' agora é detectado de forma estrita em elementos dedicados (h1..h6), eliminando a captura indevida de divs contêineres pai.
  - A Explicação inteira agora vai exclusivamente para o campo 'Explicação', sem misturar com o Educational Objective.
  - O Educational Objective vai exclusivamente para o campo 'Educational Objective'.
- ⚡ Extração Perfeita de Subject, System e Q ID:
  - Mapeamento direto da tabela/linhas de metadados do QBankly/UWorld (ex: Subject: Medicine | System: Biostatistics & Epidemiology | Q ID: 4262).
  - Geração automática de tags únicas sem duplicidades (ex: 'qid:4262', 'subject:medicine', 'system:biostatistics-epidemiology', 'qbank-sync').
- ⚡ Pré-visualização em Tempo Real no Drawer:
  - O painel vertical da margem direita agora mostra em tempo real os valores detectados de Subject, System e Q ID antes mesmo de você clicar em gerar o card.
- ⚡ Captura Abrangente de Imagens Clínicas:
  - Identifica e copia imagens e thumbnails médicas em alta resolução do QBankly e UWorld (incluindo imagens clicáveis com zoom).

COMO ATUALIZAR UMA EXTENSÃO JÁ INSTALADA:
1. Baixe o novo arquivo .zip no site e extraia os arquivos substituindo os existentes na sua pasta da extensão.
2. Abra o Google Chrome, digite chrome://extensions e dê Enter.
3. No cartão da extensão "Assistente de Questões por Voz + Pacer", clique no ícone de "Recarregar" (círculo com seta 🔄).
4. Volte para a aba do seu Q-Bank (UWorld/QBankly) e aperte F5 (recarregar página).
5. Pronto! Os campos serão extraídos com 100% de fidelidade!