import express from 'express';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
// import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = 'my_secret_token';


app.use(express.json());


// ✅ Facebook verification route
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔍 GET /webhook', req.query);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Verification failed');
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const lead = req.body;

    console.log('post/webhooks', lead);
    // const creds = JSON.parse(fs.readFileSync('./credentials.json'));

    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // First sheet

    await sheet.addRow({
      Name: lead.name || 'null',
      Email: lead.email || 'null',
      Phone: lead.phone || 'null',
      Message: lead.message || 'null',
    });

    res.status(200).send({ success: true });
  } catch (error) {
    console.error('❌ Error adding row:', error.message);
    res.status(500).send({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Webhook running on http://localhost:${PORT}/webhook`);
});
