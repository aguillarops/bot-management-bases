# Usar a imagem base do Node.js versão 20
FROM node:20

# Instalar o pacote tzdata para configurar o fuso horário
RUN apt-get update && apt-get install -y tzdata

# Configurar o fuso horário para São Paulo (BRT)
ENV TZ=America/Sao_Paulo

# Criar e definir o diretório de trabalho
WORKDIR /app

# Copiar os arquivos package.json e package-lock.json (se houver) para o diretório de trabalho
COPY package*.json ./

# Instalar as dependências da aplicação
RUN npm install

# Copiar o restante dos arquivos da aplicação para o diretório de trabalho
COPY . .

# Comando para rodar a aplicação
CMD ["node", "index.js"]
