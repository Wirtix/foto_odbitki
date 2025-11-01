const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${timestamp}_${sanitized}`);
  },
});

const upload = multer({ storage });

app.use(express.static(__dirname));

app.post('/upload', upload.array('images'), (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, totalPrice } = req.body;
    const photos = [];

    Object.entries(req.body)
      .filter(([key]) => key.startsWith('photoMeta'))
      .forEach(([, value]) => {
        try {
          const parsed = JSON.parse(value);
          photos.push(parsed);
        } catch (error) {
          console.error('Nie udało się zinterpretować danych zdjęcia.', error);
        }
      });

    const customer = {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
    };

    res.json({
      success: true,
      customer,
      photos,
      totalPrice: Number(totalPrice || 0).toFixed(2),
    });
  } catch (error) {
    console.error('Błąd podczas zapisu zamówienia:', error);
    res.status(500).json({
      success: false,
      message: 'Wystąpił błąd podczas zapisu zamówienia.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
