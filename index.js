import express from 'express';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import fs from 'fs';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = 'my_secret_token';

const logToFile = (message) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync('webhook.log', `[${timestamp}] ${message}\n`);
};

app.use(express.json());


// ✅ Facebook verification route
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  logToFile(`GET /webhook - mode: ${mode}, token: ${token}, challenge: ${challenge}`);
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
    logToFile(`POST /webhook - payload: ${JSON.stringify(req.body)}`);
    console.log('📥 Facebook lead payload:', JSON.stringify(req.body, null, 2));

    const changes = req.body?.entry?.[0]?.changes?.[0];
    const leadgenId = changes?.value?.leadgen_id;
    const accessToken = process.env.PAGE_ACCESS_TOKEN;

    if (!leadgenId || !accessToken) {
      throw new Error('Missing leadgen_id or PAGE_ACCESS_TOKEN');
    }

    // Get lead info from Facebook Graph API
    const response = await axios.get(`https://graph.facebook.com/v18.0/${leadgenId}?access_token=${accessToken}`);

    const { field_data } = response.data;

    // Extract fields
    const data = {};
    field_data.forEach(item => {
      data[item.name] = item.values[0];
    });
    logToFile(`Parsed lead data: ${JSON.stringify(data)}`);
    console.log('📋 Parsed lead data:', data);

    // Store into Google Sheets
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRow({
      Name: data.full_name || 'N/A',
      Email: data.email || 'N/A',
      Phone: data.phone_number || 'N/A',
    });

    res.status(200).send({ success: true });
  } catch (err) {
    console.error('❌ Error processing webhook:', err.message);
    res.status(500).send({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Webhook running on http://localhost:${PORT}/webhook`);
});
