import {createApp} from './server.js';

process.on('unhandledRejection', reason => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const PORT = process.env.PORT || 3000;
const app = createApp();
app.listen(PORT, () => {
  console.log(`vc-api-mock server running on port ${PORT}`);
});
