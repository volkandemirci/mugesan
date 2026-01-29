/**
 * Mugesan Platform - Ana Uygulama
 *
 * Bu dosya platformun temel işlevselliğini yönetir.
 * Her program için ayrı modüller eklenebilir.
 */

// Program Konfigürasyonu
// Her program için ayarlar burada yapılandırılabilir
const programConfig = {
    'thordon-kesim': {
        name: 'Thordon Kesim ve Malzeme Seçim Programı',
        path: 'programs/thordon-kesim/index.html',
        enabled: true,
        module: null
    },
    'atolye-is': {
        name: 'Atölye İş Programı',
        path: 'programs/atolye-is/index.html',
        enabled: false,
        module: null
    },
    'mugesan-is-takip': {
        name: 'Mugesan İş Takip Programı',
        path: 'programs/mugesan-is-takip/index.html',
        enabled: false,
        module: null
    },
    'chockfast-stok': {
        name: 'Chockfast Müşteriler Stok Takibi ve İş Bitiş Programı',
        path: 'programs/chockfast-stok/index.html',
        enabled: false,
        module: null
    },
    'chockfast-sertlik': {
        name: 'Chockfast Sertlik Raporu Hazırlama Programı',
        path: 'programs/chockfast-sertlik/index.html',
        enabled: false,
        module: null
    },
    'chris-marine': {
        name: 'Chris Marine Ödeme, Komisyon Takip Programı',
        path: 'programs/chris-marine/index.html',
        enabled: false,
        module: null
    },
    'commercial-invoice': {
        name: 'Commercial Invoice & Packing List Hazırlama Programı',
        path: 'programs/commercial-invoice/index.html',
        enabled: false,
        module: null
    },
    'siparis-portal': {
        name: 'Sipariş Portalı & PO Oluşturma Aracı',
        path: 'programs/siparis-portal/index.html',
        enabled: false,
        module: null
    },
    'servis-raporu': {
        name: 'Servis Raporu Takibi Programı',
        path: 'programs/servis-raporu/index.html',
        enabled: false,
        module: null
    },
    'sertlik-raporu': {
        name: 'Sertlik Raporu Oluşturma Programı',
        path: 'programs/sertlik-raporu/index.html',
        enabled: false,
        module: null
    },
    'chockfast-idcard': {
        name: 'Chockfast ID Card Üretim Programı',
        path: 'programs/chockfast-idcard/index.html',
        enabled: false,
        module: null
    },
    'chockfast-torque': {
        name: 'Chockfast Bolt Torque Calculation Program',
        path: 'programs/chockfast-torque/index.html',
        enabled: false,
        module: null
    }
};

// DOM Elements
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');
const programCards = document.querySelectorAll('.program-card');
const searchInput = document.querySelector('.search-box input');

// Sidebar Toggle (Mobile)
function initSidebar() {
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            toggleOverlay();
        });
    }

    // Overlay oluştur
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });
}

function toggleOverlay() {
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
        overlay.classList.toggle('active');
    }
}

// Program Kartı Tıklama
function initProgramCards() {
    programCards.forEach(card => {
        card.addEventListener('click', () => {
            const programId = card.dataset.program;
            openProgram(programId);
        });
    });
}

// Program Açma
function openProgram(programId) {
    const config = programConfig[programId];

    if (!config) {
        showNotification('Program bulunamadı!', 'error');
        return;
    }

    if (!config.enabled) {
        showNotification(`"${config.name}" henüz yapılandırılmadı.`, 'warning');
        return;
    }

    // Program aktifse yönlendir
    window.location.href = config.path;
}

// Program Aktifleştirme
// Bu fonksiyon ile programlar aktif hale getirilebilir
function enableProgram(programId) {
    if (programConfig[programId]) {
        programConfig[programId].enabled = true;
        updateCardStatus(programId, 'active');

        // Düğmeyi aktif et
        const card = document.querySelector(`[data-program="${programId}"]`);
        if (card) {
            const btn = card.querySelector('.card-btn');
            if (btn) {
                btn.disabled = false;
            }
        }
    }
}

// Program Devre Dışı Bırakma
function disableProgram(programId) {
    if (programConfig[programId]) {
        programConfig[programId].enabled = false;
        updateCardStatus(programId, 'pending');

        const card = document.querySelector(`[data-program="${programId}"]`);
        if (card) {
            const btn = card.querySelector('.card-btn');
            if (btn) {
                btn.disabled = true;
            }
        }
    }
}

// Kart Durumu Güncelleme
function updateCardStatus(programId, status) {
    const card = document.querySelector(`[data-program="${programId}"]`);
    if (card) {
        const badge = card.querySelector('.status-badge');
        if (badge) {
            badge.className = `status-badge ${status}`;

            switch(status) {
                case 'active':
                    badge.textContent = 'Aktif';
                    break;
                case 'pending':
                    badge.textContent = 'Yapılandırılacak';
                    break;
                case 'disabled':
                    badge.textContent = 'Devre Dışı';
                    break;
            }
        }
    }
}

// Arama Fonksiyonu
function initSearch() {
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterPrograms(searchTerm);
        });
    }
}

function filterPrograms(searchTerm) {
    programCards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        const description = card.querySelector('p').textContent.toLowerCase();

        if (title.includes(searchTerm) || description.includes(searchTerm)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// Bildirim Sistemi
function showNotification(message, type = 'info') {
    // Mevcut bildirimi kaldır
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Yeni bildirim oluştur
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Stil ekle
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 20px;
        border-radius: 10px;
        background: ${getNotificationColor(type)};
        color: white;
        display: flex;
        align-items: center;
        gap: 16px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;

    // Animasyon stil
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        @keyframes slideOut {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100%);
            }
        }
        .notification-content {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .notification-close {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s;
        }
        .notification-close:hover {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Kapatma butonu
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    });

    // Otomatik kapanma
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

function getNotificationIcon(type) {
    const icons = {
        'info': 'fa-info-circle',
        'success': 'fa-check-circle',
        'warning': 'fa-exclamation-triangle',
        'error': 'fa-times-circle'
    };
    return icons[type] || icons['info'];
}

function getNotificationColor(type) {
    const colors = {
        'info': '#2563eb',
        'success': '#22c55e',
        'warning': '#f59e0b',
        'error': '#ef4444'
    };
    return colors[type] || colors['info'];
}

// Yeni Program Ekleme Fonksiyonu
// Bu fonksiyon ile yeni programlar eklenebilir
function addNewProgram(id, name, description, iconClass, colorClass) {
    programConfig[id] = {
        name: name,
        path: `programs/${id}/index.html`,
        enabled: false,
        module: null
    };

    const grid = document.querySelector('.programs-grid');
    if (grid) {
        const card = document.createElement('div');
        card.className = 'program-card';
        card.dataset.program = id;
        card.innerHTML = `
            <div class="card-icon ${colorClass}">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="card-content">
                <h3>${name}</h3>
                <p>${description}</p>
            </div>
            <div class="card-status">
                <span class="status-badge pending">Yapılandırılacak</span>
            </div>
            <button class="card-btn" disabled>
                <i class="fas fa-arrow-right"></i>
            </button>
        `;

        card.addEventListener('click', () => openProgram(id));
        grid.appendChild(card);
    }
}

// Tüm Programları Listele
function listAllPrograms() {
    console.log('=== Mugesan Platform Programları ===');
    Object.keys(programConfig).forEach(id => {
        const config = programConfig[id];
        console.log(`${config.enabled ? '✓' : '○'} ${config.name} (${id})`);
    });
}

// Uygulama Başlatma
function init() {
    initSidebar();
    initProgramCards();
    initSearch();

    console.log('Mugesan Platform yüklendi.');
    console.log('Kullanılabilir fonksiyonlar:');
    console.log('- enableProgram(programId): Program aktifleştir');
    console.log('- disableProgram(programId): Program devre dışı bırak');
    console.log('- addNewProgram(id, name, desc, icon, color): Yeni program ekle');
    console.log('- listAllPrograms(): Tüm programları listele');
}

// DOM yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', init);

// Global API - Dışarıdan erişim için
window.MugesanPlatform = {
    enableProgram,
    disableProgram,
    addNewProgram,
    listAllPrograms,
    showNotification,
    config: programConfig
};
