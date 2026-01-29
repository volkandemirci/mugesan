/**
 * Thordon Kesim ve Malzeme Seçim Programı
 * Mugesan Platform
 */

// ===== FIREBASE CONFIGURATION =====
// Firebase yapılandırmasını buraya girin
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// ===== GLOBAL STATE =====
let db = null;
let stockData = [];
let requestList = [];
let currentExchangeRate = 0.74;
let editingStockId = null;
let deleteStockId = null;
let currentReferenceNo = null;
let selectedMaterials = [];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    initEventListeners();
    initTabs();
    loadLocalData();
});

function initFirebase() {
    try {
        // Firebase'i başlat
        if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();

            // Bağlantı durumunu izle
            db.ref('.info/connected').on('value', (snap) => {
                updateConnectionStatus(snap.val());
            });

            // Verileri dinle
            listenToStockChanges();
            listenToExchangeRate();
            listenToHistory();
        } else {
            // Demo modu - yerel depolama kullan
            console.log('Firebase yapılandırılmamış - Demo modu aktif');
            updateConnectionStatus(false);
            loadFromLocalStorage();
        }
    } catch (error) {
        console.error('Firebase başlatma hatası:', error);
        updateConnectionStatus(false);
        loadFromLocalStorage();
    }
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    if (connected) {
        statusEl.className = 'connection-status connected';
        statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Bağlı</span>';
    } else {
        statusEl.className = 'connection-status disconnected';
        statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Çevrimdışı</span>';
    }
}

// ===== LOCAL STORAGE (Demo mode) =====
function loadFromLocalStorage() {
    const savedStock = localStorage.getItem('thordon_stock');
    const savedRate = localStorage.getItem('thordon_exchange_rate');
    const savedHistory = localStorage.getItem('thordon_history');

    if (savedStock) {
        stockData = JSON.parse(savedStock);
        renderStockTable();
        updateModelFilters();
    }

    if (savedRate) {
        currentExchangeRate = parseFloat(savedRate);
        document.getElementById('exchangeRate').value = currentExchangeRate;
    }

    if (savedHistory) {
        renderHistory(JSON.parse(savedHistory));
    }
}

function saveToLocalStorage() {
    localStorage.setItem('thordon_stock', JSON.stringify(stockData));
    localStorage.setItem('thordon_exchange_rate', currentExchangeRate.toString());
}

function saveHistoryToLocalStorage(history) {
    localStorage.setItem('thordon_history', JSON.stringify(history));
}

// ===== FIREBASE LISTENERS =====
function listenToStockChanges() {
    if (!db) return;

    db.ref('thordon/stock').on('value', (snapshot) => {
        stockData = [];
        snapshot.forEach((child) => {
            stockData.push({ id: child.key, ...child.val() });
        });
        renderStockTable();
        updateModelFilters();
    });
}

function listenToExchangeRate() {
    if (!db) return;

    db.ref('thordon/exchangeRate').on('value', (snapshot) => {
        if (snapshot.val()) {
            currentExchangeRate = snapshot.val();
            document.getElementById('exchangeRate').value = currentExchangeRate;
            renderStockTable(); // USD fiyatlarını güncelle
        }
    });
}

function listenToHistory() {
    if (!db) return;

    db.ref('thordon/history').orderByChild('timestamp').limitToLast(100).on('value', (snapshot) => {
        const history = [];
        snapshot.forEach((child) => {
            history.push({ id: child.key, ...child.val() });
        });
        renderHistory(history.reverse());
    });
}

// ===== EVENT LISTENERS =====
function initEventListeners() {
    // Exchange Rate
    document.getElementById('saveExchangeRate').addEventListener('click', saveExchangeRate);

    // Stock Management
    document.getElementById('addStockBtn').addEventListener('click', () => openStockModal());
    document.getElementById('closeStockModal').addEventListener('click', closeStockModal);
    document.getElementById('cancelStockBtn').addEventListener('click', closeStockModal);
    document.getElementById('saveStockBtn').addEventListener('click', saveStock);
    document.getElementById('stockPriceCAD').addEventListener('input', calculateUSDPrice);

    // Delete Modal
    document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
    document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);

    // Search & Filter
    document.getElementById('stockSearch').addEventListener('input', filterStockTable);
    document.getElementById('modelFilter').addEventListener('change', filterStockTable);

    // Excel Import/Export
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('importExcelBtn').addEventListener('click', () => {
        document.getElementById('excelFileInput').click();
    });
    document.getElementById('excelFileInput').addEventListener('change', importFromExcel);

    // Request Form
    document.getElementById('addToRequestList').addEventListener('click', addToRequestList);
    document.getElementById('findMaterialsBtn').addEventListener('click', findMaterials);

    // PDF & Quote
    document.getElementById('printMachiningPdf').addEventListener('click', generateMachiningPdf);
    document.getElementById('printQuotePdf').addEventListener('click', generateQuotePdf);
    document.getElementById('confirmQuote').addEventListener('click', confirmQuote);

    // History
    document.getElementById('refreshHistoryBtn').addEventListener('click', refreshHistory);
    document.getElementById('historyTypeFilter').addEventListener('change', filterHistory);
    document.getElementById('historyStartDate').addEventListener('change', filterHistory);
    document.getElementById('historyEndDate').addEventListener('change', filterHistory);

    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

function loadLocalData() {
    // Set default dates for history filter
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    document.getElementById('historyEndDate').value = today.toISOString().split('T')[0];
    document.getElementById('historyStartDate').value = lastMonth.toISOString().split('T')[0];
}

// ===== EXCHANGE RATE =====
function saveExchangeRate() {
    const rate = parseFloat(document.getElementById('exchangeRate').value);
    if (isNaN(rate) || rate <= 0) {
        showToast('Geçerli bir kur değeri girin', 'error');
        return;
    }

    currentExchangeRate = rate;

    if (db) {
        db.ref('thordon/exchangeRate').set(rate)
            .then(() => {
                showToast('Döviz kuru kaydedildi', 'success');
                addHistoryEntry('edit', 'Döviz Kuru Güncellendi', `Yeni kur: ${rate}`);
            })
            .catch(err => showToast('Hata: ' + err.message, 'error'));
    } else {
        saveToLocalStorage();
        showToast('Döviz kuru kaydedildi (yerel)', 'success');
    }

    renderStockTable();
}

function calculateUSDPrice() {
    const cadPrice = parseFloat(document.getElementById('stockPriceCAD').value) || 0;
    const usdPrice = cadPrice * currentExchangeRate;
    document.getElementById('stockPriceUSD').value = usdPrice.toFixed(2);
}

// ===== STOCK MANAGEMENT =====
function openStockModal(stockId = null) {
    editingStockId = stockId;
    const modal = document.getElementById('stockModal');
    const form = document.getElementById('stockForm');

    if (stockId) {
        // Edit mode
        document.getElementById('stockModalTitle').textContent = 'Stok Düzenle';
        const stock = stockData.find(s => s.id === stockId);
        if (stock) {
            document.getElementById('stockId').value = stockId;
            document.getElementById('stockCode').value = stock.code || '';
            document.getElementById('stockDescription').value = stock.description || '';
            document.getElementById('stockModel').value = stock.model || '';
            document.getElementById('stockShelf').value = stock.shelf || '';
            document.getElementById('stockInnerDia').value = stock.innerDia || '';
            document.getElementById('stockOuterDia').value = stock.outerDia || '';
            document.getElementById('stockLength').value = stock.length || '';
            document.getElementById('stockPriceCAD').value = stock.priceCAD || '';
            calculateUSDPrice();
        }
    } else {
        // Add mode
        document.getElementById('stockModalTitle').textContent = 'Yeni Stok Ekle';
        form.reset();
        document.getElementById('stockId').value = '';
    }

    // Update model suggestions
    updateModelSuggestions();

    modal.classList.add('active');
}

function closeStockModal() {
    document.getElementById('stockModal').classList.remove('active');
    editingStockId = null;
}

function updateModelSuggestions() {
    const datalist = document.getElementById('modelSuggestions');
    const models = [...new Set(stockData.map(s => s.model).filter(m => m))];
    datalist.innerHTML = models.map(m => `<option value="${m}">`).join('');
}

function saveStock() {
    const code = document.getElementById('stockCode').value.trim();
    const description = document.getElementById('stockDescription').value.trim();
    const model = document.getElementById('stockModel').value.trim();
    const shelf = document.getElementById('stockShelf').value.trim();
    const innerDia = parseFloat(document.getElementById('stockInnerDia').value);
    const outerDia = parseFloat(document.getElementById('stockOuterDia').value);
    const length = parseFloat(document.getElementById('stockLength').value);
    const priceCAD = parseFloat(document.getElementById('stockPriceCAD').value);

    // Validation
    if (!code || !description || !model) {
        showToast('Lütfen zorunlu alanları doldurun', 'error');
        return;
    }

    if (isNaN(innerDia) || isNaN(outerDia) || isNaN(length) || isNaN(priceCAD)) {
        showToast('Lütfen geçerli sayısal değerler girin', 'error');
        return;
    }

    const stockItem = {
        code,
        description,
        model,
        shelf,
        innerDia,
        outerDia,
        length,
        priceCAD,
        priceUSD: priceCAD * currentExchangeRate,
        unitPrice: priceCAD / length,
        updatedAt: Date.now()
    };

    if (db) {
        if (editingStockId) {
            // Update
            db.ref(`thordon/stock/${editingStockId}`).update(stockItem)
                .then(() => {
                    showToast('Stok güncellendi', 'success');
                    addHistoryEntry('edit', 'Stok Güncellendi', `${code} - ${description}`);
                    closeStockModal();
                })
                .catch(err => showToast('Hata: ' + err.message, 'error'));
        } else {
            // Add new
            stockItem.createdAt = Date.now();
            db.ref('thordon/stock').push(stockItem)
                .then(() => {
                    showToast('Stok eklendi', 'success');
                    addHistoryEntry('add', 'Yeni Stok Eklendi', `${code} - ${description}`);
                    closeStockModal();
                })
                .catch(err => showToast('Hata: ' + err.message, 'error'));
        }
    } else {
        // Local storage mode
        if (editingStockId) {
            const index = stockData.findIndex(s => s.id === editingStockId);
            if (index !== -1) {
                stockData[index] = { ...stockData[index], ...stockItem };
            }
            addLocalHistory('edit', 'Stok Güncellendi', `${code} - ${description}`);
        } else {
            stockItem.id = 'local_' + Date.now();
            stockItem.createdAt = Date.now();
            stockData.push(stockItem);
            addLocalHistory('add', 'Yeni Stok Eklendi', `${code} - ${description}`);
        }
        saveToLocalStorage();
        renderStockTable();
        updateModelFilters();
        showToast('Stok kaydedildi (yerel)', 'success');
        closeStockModal();
    }
}

function openDeleteModal(stockId) {
    deleteStockId = stockId;
    const stock = stockData.find(s => s.id === stockId);
    if (stock) {
        document.getElementById('deleteItemName').textContent = `${stock.code} - ${stock.description}`;
        document.getElementById('deleteModal').classList.add('active');
    }
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    deleteStockId = null;
}

function confirmDelete() {
    if (!deleteStockId) return;

    const stock = stockData.find(s => s.id === deleteStockId);

    if (db) {
        db.ref(`thordon/stock/${deleteStockId}`).remove()
            .then(() => {
                showToast('Stok silindi', 'success');
                addHistoryEntry('delete', 'Stok Silindi', `${stock?.code} - ${stock?.description}`);
                closeDeleteModal();
            })
            .catch(err => showToast('Hata: ' + err.message, 'error'));
    } else {
        stockData = stockData.filter(s => s.id !== deleteStockId);
        saveToLocalStorage();
        renderStockTable();
        updateModelFilters();
        addLocalHistory('delete', 'Stok Silindi', `${stock?.code} - ${stock?.description}`);
        showToast('Stok silindi (yerel)', 'success');
        closeDeleteModal();
    }
}

// ===== STOCK TABLE RENDERING =====
function renderStockTable() {
    const tbody = document.getElementById('stockTableBody');
    const searchTerm = document.getElementById('stockSearch').value.toLowerCase();
    const modelFilter = document.getElementById('modelFilter').value;

    let filteredData = stockData;

    // Apply filters
    if (searchTerm) {
        filteredData = filteredData.filter(s =>
            (s.code && s.code.toLowerCase().includes(searchTerm)) ||
            (s.description && s.description.toLowerCase().includes(searchTerm)) ||
            (s.model && s.model.toLowerCase().includes(searchTerm))
        );
    }

    if (modelFilter) {
        filteredData = filteredData.filter(s => s.model === modelFilter);
    }

    // Render rows
    tbody.innerHTML = filteredData.map(stock => `
        <tr data-id="${stock.id}">
            <td><strong>${escapeHtml(stock.code || '')}</strong></td>
            <td>${escapeHtml(stock.description || '')}</td>
            <td><span class="badge">${escapeHtml(stock.model || '')}</span></td>
            <td>${escapeHtml(stock.shelf || '-')}</td>
            <td class="text-right">${formatNumber(stock.innerDia)}</td>
            <td class="text-right">${formatNumber(stock.outerDia)}</td>
            <td class="text-right">${formatNumber(stock.length)}</td>
            <td class="text-right">${formatCurrency(stock.priceCAD, 'CAD')}</td>
            <td class="text-right">${formatCurrency(stock.priceCAD * currentExchangeRate, 'USD')}</td>
            <td class="text-right">${formatNumber(stock.priceCAD / stock.length, 4)}</td>
            <td>
                <div class="table-actions">
                    <button onclick="openStockModal('${stock.id}')" title="Düzenle">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete" onclick="openDeleteModal('${stock.id}')" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Update count
    document.getElementById('stockCount').textContent = `${filteredData.length} kayıt`;
}

function filterStockTable() {
    renderStockTable();
}

function updateModelFilters() {
    const models = [...new Set(stockData.map(s => s.model).filter(m => m))].sort();

    // Stock table filter
    const modelFilter = document.getElementById('modelFilter');
    const currentValue = modelFilter.value;
    modelFilter.innerHTML = '<option value="">Tüm Modeller</option>' +
        models.map(m => `<option value="${m}">${m}</option>`).join('');
    modelFilter.value = currentValue;

    // Request form filter
    const reqModel = document.getElementById('reqModel');
    reqModel.innerHTML = '<option value="">Model Seçin</option>' +
        models.map(m => `<option value="${m}">${m}</option>`).join('');
}

// ===== EXCEL IMPORT/EXPORT =====
function exportToExcel() {
    const headers = ['Stok Kodu', 'Stok Açıklaması', 'Malzeme Modeli', 'Raf Adresi',
                    'İç Çap (mm)', 'Dış Çap (mm)', 'Uzunluk (mm)', 'Fiyat (CAD)', 'Fiyat (USD)'];

    let csv = '\uFEFF' + headers.join(';') + '\n';

    stockData.forEach(stock => {
        const row = [
            stock.code,
            stock.description,
            stock.model,
            stock.shelf,
            stock.innerDia,
            stock.outerDia,
            stock.length,
            stock.priceCAD,
            (stock.priceCAD * currentExchangeRate).toFixed(2)
        ];
        csv += row.map(v => `"${v || ''}"`).join(';') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `thordon_stok_${formatDate(new Date())}.csv`;
    link.click();

    showToast('Excel dosyası indirildi', 'success');
}

function importFromExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split('\n');

        // Skip header
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(';').map(v => v.replace(/"/g, '').trim());

            if (values.length >= 7) {
                const stockItem = {
                    code: values[0],
                    description: values[1],
                    model: values[2],
                    shelf: values[3],
                    innerDia: parseFloat(values[4]) || 0,
                    outerDia: parseFloat(values[5]) || 0,
                    length: parseFloat(values[6]) || 0,
                    priceCAD: parseFloat(values[7]) || 0,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                stockItem.priceUSD = stockItem.priceCAD * currentExchangeRate;
                stockItem.unitPrice = stockItem.priceCAD / stockItem.length;

                if (db) {
                    db.ref('thordon/stock').push(stockItem);
                } else {
                    stockItem.id = 'local_' + Date.now() + '_' + i;
                    stockData.push(stockItem);
                }
                imported++;
            }
        }

        if (!db) {
            saveToLocalStorage();
            renderStockTable();
            updateModelFilters();
        }

        addHistoryEntry('add', 'Excel İçe Aktarma', `${imported} kayıt eklendi`);
        showToast(`${imported} kayıt içe aktarıldı`, 'success');
    };

    reader.readAsText(file);
    e.target.value = '';
}

// ===== MALZEME BULMA (MATERIAL FINDER) =====
function addToRequestList() {
    const model = document.getElementById('reqModel').value;
    const outerDia = parseFloat(document.getElementById('reqOuterDia').value);
    const innerDia = parseFloat(document.getElementById('reqInnerDia').value);
    const length = parseFloat(document.getElementById('reqLength').value);
    const quantity = parseInt(document.getElementById('reqQuantity').value);

    if (!model) {
        showToast('Lütfen model seçin', 'error');
        return;
    }

    if (isNaN(outerDia) || isNaN(innerDia) || isNaN(length) || isNaN(quantity)) {
        showToast('Lütfen geçerli değerler girin', 'error');
        return;
    }

    const request = {
        id: Date.now(),
        model,
        outerDia,
        innerDia,
        length,
        quantity
    };

    requestList.push(request);
    renderRequestList();

    // Clear form
    document.getElementById('reqOuterDia').value = '';
    document.getElementById('reqInnerDia').value = '';
    document.getElementById('reqLength').value = '';
    document.getElementById('reqQuantity').value = '1';

    showToast('Talep listeye eklendi', 'success');
}

function removeFromRequestList(id) {
    requestList = requestList.filter(r => r.id !== id);
    renderRequestList();
}

function renderRequestList() {
    const container = document.getElementById('requestItems');
    const summary = document.getElementById('requestSummary');

    if (requestList.length === 0) {
        container.innerHTML = '<p class="empty-message">Henüz talep eklenmedi</p>';
        summary.style.display = 'none';
        return;
    }

    container.innerHTML = requestList.map(req => `
        <div class="request-item">
            <div class="request-item-header">
                <span class="request-item-model">${escapeHtml(req.model)}</span>
                <button class="request-item-remove" onclick="removeFromRequestList(${req.id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="request-item-details">
                <span>Dış Çap: ${req.outerDia} mm</span>
                <span>İç Çap: ${req.innerDia} mm</span>
                <span>Uzunluk: ${req.length} mm</span>
                <span>Adet: ${req.quantity}</span>
            </div>
        </div>
    `).join('');

    summary.style.display = 'block';
}

function findMaterials() {
    if (requestList.length === 0) {
        showToast('Lütfen en az bir talep ekleyin', 'error');
        return;
    }

    // Generate reference number
    currentReferenceNo = generateReferenceNo();
    document.getElementById('refNumber').style.display = 'block';
    document.getElementById('refNumber').querySelector('span').textContent = currentReferenceNo;

    // Find matching materials for each request
    const allMatches = [];

    requestList.forEach(req => {
        const matches = stockData.filter(stock => {
            // Model eşleşmesi
            if (stock.model !== req.model) return false;

            // Dış çap: stok >= istek * 1.015
            const minOuterDia = req.outerDia * 1.015;
            if (stock.outerDia < minOuterDia) return false;

            // İç çap: stok <= istek
            if (stock.innerDia > req.innerDia) return false;

            // Uzunluk: stok >= istek + 30mm
            if (stock.length < req.length + 30) return false;

            return true;
        });

        // En uygun fiyatlı eşleşmeleri sırala
        matches.sort((a, b) => a.unitPrice - b.unitPrice);

        allMatches.push({
            request: req,
            matches: matches
        });
    });

    // Render matching materials
    renderMatchingMaterials(allMatches);

    // Show results section
    document.getElementById('matchingMaterials').style.display = 'block';
}

function renderMatchingMaterials(allMatches) {
    const tbody = document.getElementById('matchingMaterialsBody');
    selectedMaterials = [];

    let html = '';

    allMatches.forEach((item, index) => {
        if (item.matches.length === 0) {
            html += `
                <tr class="text-danger">
                    <td colspan="7">
                        <i class="fas fa-exclamation-triangle"></i>
                        ${item.request.model} - Dış:${item.request.outerDia} İç:${item.request.innerDia} Boy:${item.request.length} için uygun malzeme bulunamadı!
                    </td>
                </tr>
            `;
        } else {
            // En iyi eşleşmeyi öner
            const best = item.matches[0];
            selectedMaterials.push({
                stock: best,
                request: item.request,
                requestIndex: index
            });

            item.matches.slice(0, 3).forEach((stock, i) => {
                html += `
                    <tr class="${i === 0 ? 'selected' : ''}" data-request-index="${index}" data-stock-id="${stock.id}">
                        <td>${escapeHtml(stock.code)}</td>
                        <td>${escapeHtml(stock.model)}</td>
                        <td>${stock.innerDia} mm</td>
                        <td>${stock.outerDia} mm</td>
                        <td>${stock.length} mm</td>
                        <td>${formatCurrency(stock.priceCAD, 'CAD')}</td>
                        <td>
                            <input type="radio" name="select_${index}"
                                ${i === 0 ? 'checked' : ''}
                                onchange="selectMaterial(${index}, '${stock.id}')">
                        </td>
                    </tr>
                `;
            });
        }
    });

    tbody.innerHTML = html;

    if (selectedMaterials.length > 0) {
        calculateMachining();
    }
}

function selectMaterial(requestIndex, stockId) {
    const stock = stockData.find(s => s.id === stockId);
    const request = requestList[requestIndex];

    if (stock && request) {
        // Update selected material
        const existingIndex = selectedMaterials.findIndex(m => m.requestIndex === requestIndex);
        if (existingIndex !== -1) {
            selectedMaterials[existingIndex] = { stock, request, requestIndex };
        }

        // Update visual selection
        document.querySelectorAll(`tr[data-request-index="${requestIndex}"]`).forEach(tr => {
            tr.classList.remove('selected');
            if (tr.dataset.stockId === stockId) {
                tr.classList.add('selected');
            }
        });

        calculateMachining();
    }
}

// ===== MACHINING CALCULATIONS =====
function calculateMachining() {
    if (selectedMaterials.length === 0) return;

    const machiningPlans = [];
    const quoteItems = [];

    // Stokları grupla (aynı stoktan birden fazla kesim olabilir)
    const stockGroups = {};

    selectedMaterials.forEach(item => {
        const stockId = item.stock.id;
        if (!stockGroups[stockId]) {
            stockGroups[stockId] = {
                stock: { ...item.stock },
                requests: [],
                remainingLength: item.stock.length
            };
        }
        stockGroups[stockId].requests.push(item.request);
    });

    // Her stok grubu için kesim planı oluştur
    Object.values(stockGroups).forEach(group => {
        const stock = group.stock;
        const outerDia = stock.outerDia;

        // Kesim parametreleri
        const CHUCK_ALLOWANCE = 30; // Ayna tutma payı
        const SMALL_CUT_ALLOWANCE = 10; // <= 170mm için kesme payı
        const LARGE_CUT_ALLOWANCE = 5; // > 170mm için kesme payı
        const LARGE_DIA_THRESHOLD = 170;

        const isLargeDia = outerDia > LARGE_DIA_THRESHOLD;
        const cutAllowance = isLargeDia ? LARGE_CUT_ALLOWANCE : SMALL_CUT_ALLOWANCE;

        let plan = {
            stockCode: stock.code,
            stockId: stock.id,
            shelf: stock.shelf,
            outerDia: outerDia,
            totalLength: stock.length,
            isLargeDia: isLargeDia,
            segments: [],
            usedLength: 0
        };

        let currentPosition = 0;

        // İlk ayna payı
        plan.segments.push({
            type: 'chuck',
            start: currentPosition,
            length: CHUCK_ALLOWANCE,
            label: 'Ayna (30mm)'
        });
        currentPosition += CHUCK_ALLOWANCE;
        plan.usedLength += CHUCK_ALLOWANCE;

        // Her talep için kesim planla
        group.requests.forEach((request, reqIndex) => {
            for (let i = 0; i < request.quantity; i++) {
                // Gerekli uzunluk kontrolü
                const bearingLength = request.length + 30; // İşleme payı dahil
                const totalNeeded = bearingLength + (reqIndex > 0 || i > 0 ? cutAllowance : 0);

                if (isLargeDia && (reqIndex > 0 || i > 0)) {
                    // Büyük çaplı için: kesim + yeni ayna payı
                    const neededWithNewChuck = cutAllowance + CHUCK_ALLOWANCE + bearingLength;

                    if (currentPosition + neededWithNewChuck <= stock.length) {
                        // Kesim payı
                        plan.segments.push({
                            type: 'cut',
                            start: currentPosition,
                            length: cutAllowance,
                            label: `Kesim (${cutAllowance}mm)`
                        });
                        currentPosition += cutAllowance;

                        // Yeni ayna payı
                        plan.segments.push({
                            type: 'chuck',
                            start: currentPosition,
                            length: CHUCK_ALLOWANCE,
                            label: 'Ayna (30mm)'
                        });
                        currentPosition += CHUCK_ALLOWANCE;

                        // Yatak
                        plan.segments.push({
                            type: 'bearing',
                            start: currentPosition,
                            length: bearingLength,
                            label: `Yatak ${request.length}mm (${request.outerDia}x${request.innerDia})`
                        });
                        currentPosition += bearingLength;
                        plan.usedLength = currentPosition;
                    }
                } else {
                    // Küçük çaplı veya ilk parça
                    if (reqIndex > 0 || i > 0) {
                        // Kesim payı ekle
                        plan.segments.push({
                            type: 'cut',
                            start: currentPosition,
                            length: cutAllowance,
                            label: `Kesim (${cutAllowance}mm)`
                        });
                        currentPosition += cutAllowance;
                    }

                    if (currentPosition + bearingLength <= stock.length) {
                        plan.segments.push({
                            type: 'bearing',
                            start: currentPosition,
                            length: bearingLength,
                            label: `Yatak ${request.length}mm (${request.outerDia}x${request.innerDia})`
                        });
                        currentPosition += bearingLength;
                        plan.usedLength = currentPosition;
                    }
                }
            }
        });

        // Kalan kısım
        const remaining = stock.length - currentPosition;
        if (remaining > 0) {
            plan.segments.push({
                type: 'waste',
                start: currentPosition,
                length: remaining,
                label: `Fire (${remaining.toFixed(0)}mm)`
            });
        }

        machiningPlans.push(plan);

        // Teklif kalemi oluştur
        group.requests.forEach(request => {
            // 50mm ve katlarına yuvarla
            let quoteLength = Math.ceil(request.length / 50) * 50;

            // Dış çaptan küçük parça kalamaz kuralı
            if (quoteLength < outerDia) {
                quoteLength = request.length; // Tam parça olarak teklif et
            }

            const totalLength = quoteLength * request.quantity;
            const unitPrice = stock.unitPrice;
            const totalPrice = totalLength * unitPrice;

            quoteItems.push({
                stockCode: stock.code + (quoteLength !== stock.length ? `-${quoteLength}MM-T` : ''),
                originalCode: stock.code,
                model: stock.model,
                outerDia: stock.outerDia,
                innerDia: stock.innerDia,
                requestedDims: `${request.outerDia}x${request.innerDia}x${request.length}`,
                quoteLength: quoteLength,
                quantity: request.quantity,
                totalLength: totalLength,
                unitPriceCAD: unitPrice,
                totalPriceCAD: totalPrice,
                totalPriceUSD: totalPrice * currentExchangeRate,
                shelf: stock.shelf
            });
        });
    });

    // Render machining table
    renderMachiningTable(machiningPlans);

    // Render quote table
    renderQuoteTable(quoteItems);

    // Show sections
    document.getElementById('machiningSection').style.display = 'block';
    document.getElementById('quoteSection').style.display = 'block';

    // Update cutting allowance info
    const hasLarge = machiningPlans.some(p => p.isLargeDia);
    document.getElementById('cuttingAllowanceInfo').textContent = hasLarge
        ? 'Dış çap > 170mm: 5mm kesim + 30mm ayna'
        : 'Dış çap ≤ 170mm: 10mm kesme payı';
}

function renderMachiningTable(plans) {
    const container = document.getElementById('machiningTableContainer');

    let html = '';

    plans.forEach(plan => {
        html += `
            <div class="cutting-diagram">
                <div class="cutting-diagram-title">
                    <strong>${escapeHtml(plan.stockCode)}</strong> - Raf: ${escapeHtml(plan.shelf || '-')}
                    | Toplam: ${plan.totalLength}mm | Kullanılan: ${plan.usedLength.toFixed(0)}mm
                </div>
                <div class="cutting-bar">
                    ${plan.segments.map(seg => {
                        const widthPercent = (seg.length / plan.totalLength) * 100;
                        return `
                            <div class="cutting-segment ${seg.type}"
                                 style="width: ${widthPercent}%"
                                 title="${seg.label}">
                                ${widthPercent > 5 ? seg.length.toFixed(0) : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="cutting-legend">
                    <div class="legend-item"><div class="legend-color" style="background:#374151"></div> Ayna</div>
                    <div class="legend-item"><div class="legend-color" style="background:#10b981"></div> Yatak</div>
                    <div class="legend-item"><div class="legend-color" style="background:#ef4444"></div> Kesim</div>
                    <div class="legend-item"><div class="legend-color" style="background:#9ca3af"></div> Fire</div>
                </div>
            </div>
        `;
    });

    // İşleme listesi tablosu
    html += `
        <table class="data-table compact mt-2">
            <thead>
                <tr>
                    <th>Stok Kodu</th>
                    <th>Raf Adresi</th>
                    <th>Kesim Uzunlukları</th>
                </tr>
            </thead>
            <tbody>
                ${plans.map(plan => {
                    const bearingSegments = plan.segments.filter(s => s.type === 'bearing');
                    const cuts = bearingSegments.map(s => s.length + 'mm').join(', ');
                    return `
                        <tr>
                            <td><strong>${escapeHtml(plan.stockCode)}</strong></td>
                            <td>${escapeHtml(plan.shelf || '-')}</td>
                            <td>${cuts}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

function renderQuoteTable(items) {
    const container = document.getElementById('quoteTableContainer');

    let totalCAD = 0;
    let totalUSD = 0;

    items.forEach(item => {
        totalCAD += item.totalPriceCAD;
        totalUSD += item.totalPriceUSD;
    });

    container.innerHTML = `
        <table class="data-table compact">
            <thead>
                <tr>
                    <th>Stok Kodu</th>
                    <th>Model</th>
                    <th>İstenen Ölçüler</th>
                    <th>Teklif Uzunluk</th>
                    <th>Adet</th>
                    <th>Toplam Uzunluk</th>
                    <th>Birim Fiyat (CAD)</th>
                    <th>Toplam (CAD)</th>
                    <th>Toplam (USD)</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr>
                        <td><strong>${escapeHtml(item.stockCode)}</strong></td>
                        <td>${escapeHtml(item.model)}</td>
                        <td>${item.requestedDims}</td>
                        <td>${item.quoteLength} mm</td>
                        <td>${item.quantity}</td>
                        <td>${item.totalLength} mm</td>
                        <td class="text-right">${formatNumber(item.unitPriceCAD, 4)}</td>
                        <td class="text-right">${formatCurrency(item.totalPriceCAD, 'CAD')}</td>
                        <td class="text-right">${formatCurrency(item.totalPriceUSD, 'USD')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.getElementById('quoteTotal').innerHTML = `
        <div>Toplam: <strong>${formatCurrency(totalCAD, 'CAD')}</strong> / <strong>${formatCurrency(totalUSD, 'USD')}</strong></div>
    `;

    // Store for PDF
    window.currentQuoteItems = items;
    window.currentQuoteTotal = { cad: totalCAD, usd: totalUSD };
}

// ===== PDF GENERATION =====
function generateMachiningPdf() {
    const content = document.getElementById('machiningPdfContent');

    // Set reference number and date
    content.querySelector('.ref-no').textContent = currentReferenceNo;
    content.querySelector('.date').textContent = formatDate(new Date());

    // Copy machining table (without prices)
    const machiningHtml = document.getElementById('machiningTableContainer').innerHTML;
    content.querySelector('.pdf-body').innerHTML = machiningHtml;

    // Generate PDF
    const opt = {
        margin: 10,
        filename: `tornaci_talimati_${currentReferenceNo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    document.getElementById('machiningPdfTemplate').style.display = 'block';

    html2pdf().set(opt).from(content).save().then(() => {
        document.getElementById('machiningPdfTemplate').style.display = 'none';
        showToast('Tornacı PDF indirildi', 'success');
    });
}

function generateQuotePdf() {
    const content = document.getElementById('quotePdfContent');

    // Set reference number and date
    content.querySelector('.ref-no').textContent = currentReferenceNo;
    content.querySelector('.date').textContent = formatDate(new Date());
    content.querySelector('.exchange-rate').textContent = currentExchangeRate;

    // Copy quote table
    const quoteHtml = document.getElementById('quoteTableContainer').innerHTML;
    content.querySelector('.pdf-body').innerHTML = quoteHtml;

    // Set total
    content.querySelector('.pdf-total').innerHTML = document.getElementById('quoteTotal').innerHTML;

    // Generate PDF
    const opt = {
        margin: 10,
        filename: `teklif_${currentReferenceNo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    document.getElementById('quotePdfTemplate').style.display = 'block';

    html2pdf().set(opt).from(content).save().then(() => {
        document.getElementById('quotePdfTemplate').style.display = 'none';
        showToast('Teklif PDF indirildi', 'success');
    });
}

// ===== QUOTE CONFIRMATION =====
function confirmQuote() {
    if (!window.currentQuoteItems || window.currentQuoteItems.length === 0) {
        showToast('Onaylanacak teklif bulunamadı', 'error');
        return;
    }

    if (!confirm('Teklifi onaylayıp malzemeleri stoktan düşmek istediğinizden emin misiniz?')) {
        return;
    }

    // Stoktan düşme işlemi
    const updates = {};

    window.currentQuoteItems.forEach(item => {
        const stock = stockData.find(s => s.code === item.originalCode);
        if (stock) {
            const newLength = stock.length - item.totalLength;

            if (newLength <= 0) {
                // Stok tükendi - sil
                if (db) {
                    updates[`thordon/stock/${stock.id}`] = null;
                } else {
                    stockData = stockData.filter(s => s.id !== stock.id);
                }
            } else {
                // Uzunluğu güncelle
                const newPrice = (newLength / stock.length) * stock.priceCAD;

                if (db) {
                    updates[`thordon/stock/${stock.id}/length`] = newLength;
                    updates[`thordon/stock/${stock.id}/priceCAD`] = newPrice;
                    updates[`thordon/stock/${stock.id}/priceUSD`] = newPrice * currentExchangeRate;
                    updates[`thordon/stock/${stock.id}/updatedAt`] = Date.now();
                } else {
                    const idx = stockData.findIndex(s => s.id === stock.id);
                    if (idx !== -1) {
                        stockData[idx].length = newLength;
                        stockData[idx].priceCAD = newPrice;
                        stockData[idx].priceUSD = newPrice * currentExchangeRate;
                        stockData[idx].updatedAt = Date.now();
                    }
                }
            }
        }
    });

    // Güncellemeleri uygula
    if (db) {
        db.ref().update(updates)
            .then(() => {
                addHistoryEntry('deduct', 'Stoktan Düşüldü',
                    `Ref: ${currentReferenceNo} - ${window.currentQuoteItems.length} kalem`);
                showToast('Stok güncellendi', 'success');
                resetMaterialFinder();
            })
            .catch(err => showToast('Hata: ' + err.message, 'error'));
    } else {
        saveToLocalStorage();
        renderStockTable();
        addLocalHistory('deduct', 'Stoktan Düşüldü',
            `Ref: ${currentReferenceNo} - ${window.currentQuoteItems.length} kalem`);
        showToast('Stok güncellendi (yerel)', 'success');
        resetMaterialFinder();
    }
}

function resetMaterialFinder() {
    requestList = [];
    selectedMaterials = [];
    currentReferenceNo = null;
    window.currentQuoteItems = null;
    window.currentQuoteTotal = null;

    renderRequestList();
    document.getElementById('refNumber').style.display = 'none';
    document.getElementById('matchingMaterials').style.display = 'none';
    document.getElementById('machiningSection').style.display = 'none';
    document.getElementById('quoteSection').style.display = 'none';
    document.getElementById('matchingMaterialsBody').innerHTML = '';
    document.getElementById('machiningTableContainer').innerHTML = '';
    document.getElementById('quoteTableContainer').innerHTML = '';
}

// ===== HISTORY =====
function addHistoryEntry(type, title, details) {
    if (!db) return;

    const entry = {
        type,
        title,
        details,
        timestamp: Date.now(),
        user: 'Kullanıcı' // Gerçek uygulamada oturum bilgisi kullanılır
    };

    db.ref('thordon/history').push(entry);
}

function addLocalHistory(type, title, details) {
    const history = JSON.parse(localStorage.getItem('thordon_history') || '[]');
    history.unshift({
        id: 'local_' + Date.now(),
        type,
        title,
        details,
        timestamp: Date.now(),
        user: 'Kullanıcı'
    });

    // Son 100 kayıt
    if (history.length > 100) {
        history.pop();
    }

    saveHistoryToLocalStorage(history);
    renderHistory(history);
}

function renderHistory(history) {
    const timeline = document.getElementById('historyTimeline');

    if (!history || history.length === 0) {
        timeline.innerHTML = '<p class="empty-message">Henüz hareket kaydı bulunmuyor</p>';
        return;
    }

    const typeFilter = document.getElementById('historyTypeFilter').value;
    const startDate = document.getElementById('historyStartDate').value;
    const endDate = document.getElementById('historyEndDate').value;

    let filtered = history;

    if (typeFilter) {
        filtered = filtered.filter(h => h.type === typeFilter);
    }

    if (startDate) {
        const start = new Date(startDate).getTime();
        filtered = filtered.filter(h => h.timestamp >= start);
    }

    if (endDate) {
        const end = new Date(endDate).getTime() + 86400000; // +1 gün
        filtered = filtered.filter(h => h.timestamp < end);
    }

    timeline.innerHTML = filtered.map(item => `
        <div class="timeline-item">
            <div class="timeline-icon ${item.type}">
                <i class="fas ${getHistoryIcon(item.type)}"></i>
            </div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <span class="timeline-title">${escapeHtml(item.title)}</span>
                    <span class="timeline-date">${formatDateTime(new Date(item.timestamp))}</span>
                </div>
                <div class="timeline-details">${escapeHtml(item.details)}</div>
                <div class="timeline-user">
                    <i class="fas fa-user"></i> ${escapeHtml(item.user || 'Sistem')}
                </div>
            </div>
        </div>
    `).join('');
}

function getHistoryIcon(type) {
    const icons = {
        'add': 'fa-plus',
        'edit': 'fa-edit',
        'delete': 'fa-trash',
        'quote': 'fa-file-invoice',
        'deduct': 'fa-minus-circle'
    };
    return icons[type] || 'fa-circle';
}

function refreshHistory() {
    if (db) {
        // Firebase zaten dinliyor, manuel tetiklemeye gerek yok
        showToast('Liste güncellendi', 'info');
    } else {
        const history = JSON.parse(localStorage.getItem('thordon_history') || '[]');
        renderHistory(history);
        showToast('Liste güncellendi', 'info');
    }
}

function filterHistory() {
    if (db) {
        // Firebase verisi zaten var, sadece render et
        db.ref('thordon/history').orderByChild('timestamp').limitToLast(100).once('value', (snapshot) => {
            const history = [];
            snapshot.forEach((child) => {
                history.push({ id: child.key, ...child.val() });
            });
            renderHistory(history.reverse());
        });
    } else {
        const history = JSON.parse(localStorage.getItem('thordon_history') || '[]');
        renderHistory(history);
    }
}

// ===== UTILITY FUNCTIONS =====
function generateReferenceNo() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `TH${year}${month}${day}-${random}`;
}

function formatNumber(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return num.toFixed(decimals);
}

function formatCurrency(num, currency) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return `${num.toFixed(2)} ${currency}`;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatDateTime(date) {
    return date.toLocaleString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${getToastIcon(type)} toast-icon"></i>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 4000);
}

function getToastIcon(type) {
    const icons = {
        'success': 'fa-check-circle',
        'error': 'fa-times-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };
    return icons[type] || icons['info'];
}

// ===== GLOBAL FUNCTIONS (for onclick handlers) =====
window.openStockModal = openStockModal;
window.openDeleteModal = openDeleteModal;
window.removeFromRequestList = removeFromRequestList;
window.selectMaterial = selectMaterial;
