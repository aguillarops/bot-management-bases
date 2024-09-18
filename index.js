require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits } = require('discord.js');
const { Client: PgClient } = require('pg');
const { addDays, format } = require('date-fns');
const schedule = require('node-schedule');

// Database configurations from environment variables
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
};

// Discord configurations from environment variables
const discordToken = process.env.DISCORD_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;

const discordClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

async function sendDiscordMessage(content) {
  try {
    await discordClient.login(discordToken);
    const channel = await discordClient.channels.fetch(channelId);
    await channel.send(content);
    console.log('Mensagem enviada com sucesso no canal.');
  } catch (error) {
    console.error('Erro ao enviar mensagem no canal:', error);
  }
}

async function checkAndSendMessages() {
  const pgClient = new PgClient(dbConfig);

  try {
    await pgClient.connect();
    console.log('Conexão com o banco de dados estabelecida.');

    const currentDate = new Date();
    const tomorrow = addDays(currentDate, 1);
    const tomorrowFormatted = format(tomorrow, 'dd/MM/yyyy');

    // Check for bases expiring tomorrow
    const selectQuery = `
      SELECT nome_da_base, data_fim
      FROM controle_bases
      WHERE data_fim = $1::date;
    `;
    const result = await pgClient.query(selectQuery, [tomorrowFormatted]);

    let messageContent = '';

    if (result.rows.length === 0) {
      console.log('Não há bases expirando amanhã.');
      messageContent = `@everyone NÃO HÁ BASES **__POSTGRES__** EXPIRANDO AMANHÃ **__(${tomorrowFormatted})__.**`;
    } else {
      console.log('Bases expirando amanhã:');
      console.log(result.rows);
      messageContent = `@everyone BASES **__POSTGRES__** DESTINADAS À EXCLUSÃO A PARTIR DE AMANHÃ **__(${tomorrowFormatted})__**:\n`;

      for (const base of result.rows) {
        messageContent += `- ${base.nome_da_base}\n`;
      }
    }

    await sendDiscordMessage(messageContent);

    // Remove expired bases
    const expiredBasesResult = await pgClient.query(`
      SELECT nome_da_base, data_fim
      FROM controle_bases
      WHERE data_fim <= CURRENT_DATE;
    `);

    for (const base of expiredBasesResult.rows) {
      const baseName = base.nome_da_base;

      // Disconnect clients from the database
      const disconnectQuery = `
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${baseName}';
      `;
      await pgClient.query(disconnectQuery);

      // Remove the database
      const dropQuery = `
        DROP DATABASE IF EXISTS "${baseName}";
      `;
      await pgClient.query(dropQuery);

      // Delete expired records
      const deleteQuery = `
        DELETE FROM controle_bases
        WHERE data_fim <= CURRENT_DATE;
      `;
      await pgClient.query(deleteQuery);
      console.log('Bases expiradas removidas da tabela controle_bases.');
    }

  } catch (error) {
    console.error('Ocorreu um erro:', error);
    await sendDiscordMessage('@everyone Ocorreu um erro inesperado ao acessar o banco de dados do servidor de teste **__SRV06__**. Verifique as configurações de rede e as credenciais de acesso.');
  } finally {
    await pgClient.end();
    console.log('Conexão com o banco de dados encerrada.');
  }
}

// Schedule job executions
const scheduleJobs = () => {
  // Schedule for 06:00 from Monday to Friday
  schedule.scheduleJob({ hour: 6, minute: 0, dayOfWeek: new schedule.Range(1, 5) }, checkAndSendMessages);

  // Schedule for 17:50 from Monday to Friday
  schedule.scheduleJob({ hour: 17, minute: 50, dayOfWeek: new schedule.Range(1, 5) }, checkAndSendMessages);
};

// Start the schedules for testing
scheduleJobs();

// Keep the Node.js process running
console.log('Aplicação em execução e tarefas agendadas.');
