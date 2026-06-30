# Bot de Gerenciamento de Bases

Este projeto é um bot desenvolvido em Node.js para gerenciar bases de dados de clientes (PostgreSQL e Oracle) importadas em servidores de teste, incluindo exclusão automática de bases vencidas e notificações via Discord.

# Funcionalidades

    - Exclusão automática de bases vencidas: O bot verifica e remove, tanto no PostgreSQL quanto no Oracle, as bases que já passaram da data de validade.
    - Notificações via Discord: Envia, três vezes ao dia (06:00, 12:00 e 17:50, de segunda a sexta), mensagens avisando quais bases serão excluídas a partir do dia seguinte.

# Ciclo de vida das bases

Cada base importada para os servidores de teste passa por um ciclo de vida padronizado de 7 dias, controlado via SQL.

Esse controle é definido no momento da importação, pelo próprio atendente responsável: ao final do processo de import, eram executados comandos para remover/mascarar os dados sensíveis de clientes da base recém-importada e, junto a isso, um trecho que inseria a base na tabela `controle_bases` já com a data de expiração (data da importação + 7 dias).

Esse script de import roda fora deste bot. O bot apenas consulta a tabela `controle_bases` (em ambos os bancos) para alertar sobre bases prestes a vencer e excluir as que já venceram, eliminando a necessidade de controle manual.

# Tecnologias Utilizadas

    - Node.js: Para desenvolvimento do bot.
    - Docker: Para containerização da aplicação.
    - PostgreSQL e Oracle: Bancos de dados suportados para importação das bases de clientes.
    - Linux: Ambiente de desenvolvimento.

# Estrutura do Projeto

/etc/baseautodel
├── Dockerfile
├── index.js
├── node_modules/
├── package.json
└── package-lock.json

# Configuração
Certifique-se de ter as seguintes dependências instaladas:

    - Node.js (versão 20 ou superior)
    - Docker

# Configurações do Banco de Dados e Discord

- Edite as configurações de banco de dados no arquivo index.js (variáveis de ambiente `DB_*` para PostgreSQL e `ORACLE_*` para Oracle).
- Adicione seu token do Discord e o ID do canal onde deseja enviar as mensagens.

# Contribuições

Sinta-se à vontade para contribuir! Abra uma issue ou envie um pull request.

# Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.
