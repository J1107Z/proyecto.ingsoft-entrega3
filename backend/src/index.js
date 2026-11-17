const config = require('./config');
const { createApp } = require('./app');

const app = createApp();

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`MineMarket API escuchando en http://localhost:${config.port}`);
  });
}

module.exports = app;
