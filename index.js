require('dotenv').config();
const { Client: DiscordClient, GatewayIntentBits } = require('discord.js');
const { Client: PgClient } = require('pg');
const oracledb = require('oracledb');
const { addDays, format } = require('date-fns');
const schedule = require('node-schedule');

// Configurações do PostgreSQL a partir de variáveis de ambiente
const pgConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
};

// Configurações do Oracle a partir de variáveis de ambiente
const oracleConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING
};

// Configurações do Discord a partir de variáveis de ambiente
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

async function checkAndSendMessagesPostgres() {
  const pgClient = new PgClient(pgConfig);

  try {
    await pgClient.connect();
    console.log('Conexão com o banco de dados PostgreSQL estabelecida.');

    const currentDate = new Date();
    const tomorrow = addDays(currentDate, 1);
    const tomorrowFormatted = format(tomorrow, 'dd/MM/yyyy');

    // Verifica bases que expiram amanhã
    const selectQuery = `
      SELECT nome_da_base, data_fim
      FROM controle_bases
      WHERE data_fim = $1::date;
    `;
    const result = await pgClient.query(selectQuery, [tomorrowFormatted]);

    let messageContent = '';

    if (result.rows.length === 0) {
      console.log('Não há bases PostgreSQL expirando amanhã.');
      messageContent = `@everyone NÃO HÁ BASES **__POSTGRES__** EXPIRANDO AMANHÃ **__(${tomorrowFormatted})__.**`;
    } else {
      console.log('Bases PostgreSQL expirando amanhã:');
      console.log(result.rows);
      messageContent = `@everyone BASES **__POSTGRES__** DESTINADAS À EXCLUSÃO A PARTIR DE AMANHÃ **__(${tomorrowFormatted})__**:\n`;

      for (const base of result.rows) {
        messageContent += `- ${base.nome_da_base}\n`;
      }
    }

    await sendDiscordMessage(messageContent);

    // Remove bases vencidas
    const expiredBasesResult = await pgClient.query(`
      SELECT nome_da_base, data_fim
      FROM controle_bases
      WHERE data_fim <= CURRENT_DATE;
    `);

    for (const base of expiredBasesResult.rows) {
      const baseName = base.nome_da_base;

      // Desconecta clientes ainda presos à base
      const disconnectQuery = `
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${baseName}';
      `;
      await pgClient.query(disconnectQuery);

      // Remove a base
      const dropQuery = `
        DROP DATABASE IF EXISTS "${baseName}";
      `;
      await pgClient.query(dropQuery);
    }

    if (expiredBasesResult.rows.length > 0) {
      await pgClient.query(`
        DELETE FROM controle_bases
        WHERE data_fim <= CURRENT_DATE;
      `);
      console.log('Bases PostgreSQL expiradas removidas da tabela controle_bases.');
    }

  } catch (error) {
    console.error('Ocorreu um erro no PostgreSQL:', error);
    await sendDiscordMessage('@everyone Ocorreu um erro inesperado ao acessar o banco de dados **__POSTGRES__** do servidor de teste. Verifique as configurações de rede e as credenciais de acesso.');
  } finally {
    await pgClient.end();
    console.log('Conexão com o banco de dados PostgreSQL encerrada.');
  }
}

async function checkAndSendMessagesOracle() {
  let connection;

  try {
    connection = await oracledb.getConnection(oracleConfig);
    console.log('Conexão com o banco de dados Oracle estabelecida.');

    const currentDate = new Date();
    const tomorrow = addDays(currentDate, 1);
    const tomorrowFormatted = format(tomorrow, 'dd/MM/yyyy');

    // Verifica bases que expiram amanhã
    const selectResult = await connection.execute(
      `SELECT nome_da_base, data_fim
       FROM controle_bases
       WHERE TRUNC(data_fim) = TO_DATE(:tomorrow, 'DD/MM/YYYY')`,
      [tomorrowFormatted]
    );

    let messageContent = '';

    if (selectResult.rows.length === 0) {
      console.log('Não há bases Oracle expirando amanhã.');
      messageContent = `@everyone NÃO HÁ BASES **__ORACLE__** EXPIRANDO AMANHÃ **__(${tomorrowFormatted})__.**`;
    } else {
      console.log('Bases Oracle expirando amanhã:');
      console.log(selectResult.rows);
      messageContent = `@everyone BASES **__ORACLE__** DESTINADAS À EXCLUSÃO A PARTIR DE AMANHÃ **__(${tomorrowFormatted})__**:\n`;

      for (const [baseName] of selectResult.rows) {
        messageContent += `- ${baseName}\n`;
      }
    }

    await sendDiscordMessage(messageContent);

    // Remove bases vencidas
    const expiredResult = await connection.execute(
      `SELECT nome_da_base
       FROM controle_bases
       WHERE TRUNC(data_fim) <= TRUNC(SYSDATE)`
    );

    for (const [baseName] of expiredResult.rows) {
      // Encerra sessões ativas do schema antes de removê-lo
      const sessionsResult = await connection.execute(
        `SELECT sid, serial# FROM v$session WHERE username = :username`,
        [baseName.toUpperCase()]
      );

      for (const [sid, serial] of sessionsResult.rows) {
        await connection.execute(`ALTER SYSTEM KILL SESSION '${sid},${serial}' IMMEDIATE`);
      }

      // Remove o schema/usuário correspondente à base
      await connection.execute(`DROP USER "${baseName}" CASCADE`);
    }

    if (expiredResult.rows.length > 0) {
      await connection.execute(
        `DELETE FROM controle_bases WHERE TRUNC(data_fim) <= TRUNC(SYSDATE)`
      );
      await connection.commit();
      console.log('Bases Oracle expiradas removidas da tabela controle_bases.');
    }

  } catch (error) {
    console.error('Ocorreu um erro no Oracle:', error);
    await sendDiscordMessage('@everyone Ocorreu um erro inesperado ao acessar o banco de dados **__ORACLE__** do servidor de teste. Verifique as configurações de rede e as credenciais de acesso.');
  } finally {
    if (connection) {
      await connection.close();
      console.log('Conexão com o banco de dados Oracle encerrada.');
    }
  }
}

async function runDailyChecks() {
  await checkAndSendMessagesPostgres();
  await checkAndSendMessagesOracle();
}

// Agenda as execuções diárias
const scheduleJobs = () => {
  const horarios = [
    { hour: 6, minute: 0 },
    { hour: 12, minute: 0 },
    { hour: 17, minute: 50 }
  ];

  for (const horario of horarios) {
    schedule.scheduleJob({ ...horario, dayOfWeek: new schedule.Range(1, 5) }, runDailyChecks);
  }
};

scheduleJobs();

// Mantém o processo Node.js em execução
console.log('Aplicação em execução e tarefas agendadas.');
