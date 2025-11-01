const priceList = {
  '10x15': 0.79,
  '13x18': 1.29,
  '15x21': 1.99,
  '21x30': 5.99,
};

const defaultFormat = '10x15';
const dbName = 'fotoOdbitki';
const storeName = 'photos';
let db;
const photoList = new Map();

const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const selectFilesButton = document.getElementById('selectFiles');
const photoListContainer = document.getElementById('photoList');
const orderForm = document.getElementById('orderForm');
const totalPriceElement = document.getElementById('totalPrice');
const summarySection = document.getElementById('summarySection');
const summaryDetails = document.getElementById('summaryDetails');
const thankYouMessage = document.getElementById('thankYouMessage');

const customerFields = ['customerName', 'customerEmail', 'customerPhone'];

function generateId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

function savePhotoRecord(record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getPhotoRecord(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllPhotoRecords() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function clearPhotoRecords() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function renderEmptyState() {
  const info = document.createElement('p');
  info.textContent = 'Nie dodano jeszcze żadnych zdjęć.';
  info.className = 'empty-state';
  photoListContainer.innerHTML = '';
  photoListContainer.appendChild(info);
}

function renderPhotoList() {
  photoListContainer.innerHTML = '';

  if (photoList.size === 0) {
    renderEmptyState();
    return;
  }

  photoList.forEach((photo) => {
    const card = document.createElement('div');
    card.className = 'photo-card';

    const preview = document.createElement('img');
    preview.className = 'photo-preview';
    preview.src = photo.previewUrl;
    preview.alt = photo.name;

    const info = document.createElement('div');
    info.className = 'photo-info';

    const title = document.createElement('div');
    title.textContent = photo.name;
    title.style.fontWeight = '600';

    const formatLabel = document.createElement('label');
    formatLabel.htmlFor = `format-${photo.id}`;
    formatLabel.textContent = 'Format odbitki';

    const formatSelect = document.createElement('select');
    formatSelect.id = `format-${photo.id}`;

    Object.entries(priceList).forEach(([format, price]) => {
      const option = document.createElement('option');
      option.value = format;
      option.textContent = `${format} (${price.toFixed(2)} zł)`;
      if (format === photo.format) {
        option.selected = true;
      }
      formatSelect.appendChild(option);
    });

    formatSelect.addEventListener('change', async (event) => {
      const newFormat = event.target.value;
      const record = await getPhotoRecord(photo.id);
      const updated = {
        ...record,
        format: newFormat,
      };
      await savePhotoRecord(updated);
      const existing = photoList.get(photo.id);
      photoList.set(photo.id, {
        ...existing,
        format: newFormat,
      });
      renderPhotoList();
      updateTotalPrice();
    });

    const quantityLabel = document.createElement('label');
    quantityLabel.htmlFor = `quantity-${photo.id}`;
    quantityLabel.textContent = 'Ilość odbitek';

    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.min = '1';
    quantityInput.id = `quantity-${photo.id}`;
    quantityInput.value = photo.quantity;

    quantityInput.addEventListener('change', async (event) => {
      let value = parseInt(event.target.value, 10);
      if (Number.isNaN(value) || value < 1) {
        value = 1;
        event.target.value = '1';
      }
      const record = await getPhotoRecord(photo.id);
      const updated = {
        ...record,
        quantity: value,
      };
      await savePhotoRecord(updated);
      const existing = photoList.get(photo.id);
      photoList.set(photo.id, {
        ...existing,
        quantity: value,
      });
      renderPhotoList();
      updateTotalPrice();
    });

    const price = document.createElement('div');
    price.className = 'price';
    const unitPrice = priceList[photo.format];
    const total = unitPrice * photo.quantity;
    price.textContent = `Cena: ${total.toFixed(2)} zł`;

    info.appendChild(title);
    info.appendChild(formatLabel);
    info.appendChild(formatSelect);
    info.appendChild(quantityLabel);
    info.appendChild(quantityInput);
    info.appendChild(price);

    card.appendChild(preview);
    card.appendChild(info);
    photoListContainer.appendChild(card);
  });
}

function updateTotalPrice() {
  const total = Array.from(photoList.values()).reduce((sum, photo) => {
    const unit = priceList[photo.format] || 0;
    return sum + unit * photo.quantity;
  }, 0);
  totalPriceElement.textContent = `${total.toFixed(2)} zł`;
  return total;
}

async function handleFiles(files) {
  const fileArray = Array.from(files).filter((file) => file.type.startsWith('image/'));
  for (const file of fileArray) {
    const id = generateId();
    const record = {
      id,
      name: file.name,
      format: defaultFormat,
      quantity: 1,
      file,
      createdAt: Date.now(),
    };
    await savePhotoRecord(record);
    const previewUrl = URL.createObjectURL(file);
    photoList.set(id, {
      ...record,
      previewUrl,
    });
  }
  renderPhotoList();
  updateTotalPrice();
}

function restoreCustomerData() {
  const stored = localStorage.getItem('customerData');
  if (!stored) return;
  try {
    const data = JSON.parse(stored);
    customerFields.forEach((field) => {
      const input = document.getElementById(field);
      if (input && data[field]) {
        input.value = data[field];
      }
    });
  } catch (error) {
    console.error('Nie udało się odczytać danych klienta z LocalStorage.', error);
  }
}

function persistCustomerData() {
  const data = {};
  customerFields.forEach((field) => {
    const input = document.getElementById(field);
    data[field] = input.value;
  });
  localStorage.setItem('customerData', JSON.stringify(data));
}

function attachCustomerListeners() {
  customerFields.forEach((field) => {
    const input = document.getElementById(field);
    input.addEventListener('input', persistCustomerData);
  });
}

async function loadPhotosFromStorage() {
  const records = await getAllPhotoRecords();
  records.forEach((record) => {
    const previewUrl = URL.createObjectURL(record.file);
    photoList.set(record.id, {
      ...record,
      previewUrl,
    });
  });
  renderPhotoList();
  updateTotalPrice();
}

async function prepareApp() {
  await openDatabase();
  await loadPhotosFromStorage();
  restoreCustomerData();
  attachCustomerListeners();
}

function buildSummaryList(photos) {
  const list = document.createElement('ul');
  photos.forEach((photo) => {
    const item = document.createElement('li');
    item.textContent = `${photo.name} — ${photo.format}, ${photo.quantity} szt. (razem ${photo.totalPrice.toFixed(2)} zł)`;
    list.appendChild(item);
  });
  return list;
}

async function submitOrder(event) {
  event.preventDefault();

  if (photoList.size === 0) {
    alert('Dodaj co najmniej jedno zdjęcie przed wysłaniem zamówienia.');
    return;
  }

  if (!orderForm.reportValidity()) {
    return;
  }

  const totalPrice = updateTotalPrice();

  const formData = new FormData();
  const photos = Array.from(photoList.values()).map((photo) => ({
    id: photo.id,
    name: photo.name,
    format: photo.format,
    quantity: photo.quantity,
    unitPrice: priceList[photo.format],
    totalPrice: priceList[photo.format] * photo.quantity,
  }));

  photos.forEach((photo, index) => {
    const record = photoList.get(photo.id);
    formData.append('images', record.file, record.name);
    formData.append(`photoMeta[${index}]`, JSON.stringify(photo));
  });

  formData.append('customerName', document.getElementById('customerName').value);
  formData.append('customerEmail', document.getElementById('customerEmail').value);
  formData.append('customerPhone', document.getElementById('customerPhone').value);
  formData.append('totalPrice', totalPrice.toFixed(2));

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Nie udało się zapisać zamówienia.');
    }

    const result = await response.json();
    displaySummary(result);
    await clearPhotoRecords();
    photoList.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    photoList.clear();
    renderPhotoList();
    updateTotalPrice();
    localStorage.removeItem('customerData');
    orderForm.reset();
  } catch (error) {
    console.error(error);
    alert('Wystąpił problem podczas wysyłania zamówienia. Spróbuj ponownie.');
  }
}

function displaySummary(result) {
  summarySection.hidden = false;
  const { customer, photos, totalPrice } = result;
  summaryDetails.innerHTML = '';

  const customerInfo = document.createElement('div');
  customerInfo.innerHTML = `
    <h3>Dane klienta</h3>
    <p><strong>Imię:</strong> ${customer.name}</p>
    <p><strong>E-mail:</strong> ${customer.email}</p>
    <p><strong>Telefon:</strong> ${customer.phone}</p>
  `;

  const photoHeader = document.createElement('h3');
  photoHeader.textContent = 'Zamówione zdjęcia';

  const summaryList = buildSummaryList(photos);

  const totalInfo = document.createElement('p');
  totalInfo.innerHTML = `<strong>Łączna cena: ${Number(totalPrice).toFixed(2)} zł</strong>`;

  summaryDetails.appendChild(customerInfo);
  summaryDetails.appendChild(photoHeader);
  summaryDetails.appendChild(summaryList);
  summaryDetails.appendChild(totalInfo);

  thankYouMessage.textContent = 'Dziękujemy za zamówienie! Wysłaliśmy potwierdzenie na Twój e-mail.';
  summarySection.scrollIntoView({ behavior: 'smooth' });
}

selectFilesButton.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (event) => {
  if (event.target.files?.length) {
    handleFiles(event.target.files);
    fileInput.value = '';
  }
});

dropArea.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropArea.classList.add('dragover');
});

dropArea.addEventListener('dragleave', () => {
  dropArea.classList.remove('dragover');
});

dropArea.addEventListener('drop', (event) => {
  event.preventDefault();
  dropArea.classList.remove('dragover');
  if (event.dataTransfer?.files?.length) {
    handleFiles(event.dataTransfer.files);
  }
});

orderForm.addEventListener('submit', submitOrder);

prepareApp().catch((error) => {
  console.error('Nie udało się zainicjować aplikacji.', error);
  alert('Twoja przeglądarka nie obsługuje wymaganych funkcji (IndexedDB).');
});
