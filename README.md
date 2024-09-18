# Bot de Gerenciamento de Bases

Este projeto é um bot desenvolvido em Node.js para gerenciar bases de dados PostgreSQL, incluindo exclusão automática de bases vencidas e notificações via Discord.

# Funcionalidades

    - Exclusão automática de bases vencidas: O bot verifica e remove bases que já passaram da data de validade.
    - Notificações via Discord: Envia mensagens de aviso sobre bases que irão expirar em breve.

# Tecnologias Utilizadas

    - Node.js: Para desenvolvimento do bot.
    - Docker: Para containerização da aplicação.
    - PostgreSQL: Adaptado para trabalhar com este banco de dados.
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

# Configurações do Banco de Dados

Edite as configurações de banco de dados no arquivo index.js.

# Configurações do Discord

Adicione seu token do Discord e o ID do canal onde deseja enviar as mensagens.

# Contribuições

Sinta-se à vontade para contribuir! Abra uma issue ou envie um pull request.

# Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.
