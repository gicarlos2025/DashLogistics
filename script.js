const MONTHS = {
    '2026-09': { year: 2026, month: 8, days: 30, label: 'setembro de 2026' },
    '2026-10': { year: 2026, month: 9, days: 31, label: 'outubro de 2026' }
};

let selectedMonth = '2026-10';
let selectedWeek = null;
let weekSegments = [];

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
}

function parseDate(dateString) {
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
}

function getWeekNumber(date) {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return Math.ceil((date.getDate() + firstDayOfMonth) / 7);
}

function buildWeekSegments(monthKey) {
    const config = MONTHS[monthKey];
    const firstDayOfMonth = new Date(config.year, config.month, 1).getDay();
    const totalWeeks = Math.ceil((config.days + firstDayOfMonth) / 7);

    return Array.from({ length: totalWeeks }, (_, index) => {
        const number = index + 1;
        const startDay = Math.max(1, (number - 1) * 7 - firstDayOfMonth + 1);
        const endDay = Math.min(config.days, number * 7 - firstDayOfMonth);
        return {
            number,
            start: formatDate(new Date(config.year, config.month, startDay)),
            end: formatDate(new Date(config.year, config.month, endDay)),
            label: `Semana ${number}`
        };
    });
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2
    }).format(value);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function getMonthRecords() {
    const records = INVENTORY_DATA[selectedMonth];
    if (!records || records.length === 0) {
        throw new Error(`Não há dados de inventário cadastrados para ${MONTHS[selectedMonth].label}.`);
    }
    return records;
}

function getDashboardRecords() {
    const records = getMonthRecords();
    if (selectedWeek === null) return records;

    return records.filter(record => {
        const entryInWeek = record.entryDate && getWeekNumber(parseDate(record.entryDate)) === selectedWeek;
        const exitInWeek = record.exitDate && getWeekNumber(parseDate(record.exitDate)) === selectedWeek;
        return entryInWeek || exitInWeek;
    });
}

function getRecordValue(record) {
    return record.quantity * record.unitCost;
}

function getMovementEvents(type, week = selectedWeek) {
    const quantityKey = type === 'entradas' ? 'entryQuantity' : 'exitQuantity';
    const dateKey = type === 'entradas' ? 'entryDate' : 'exitDate';

    return getMonthRecords()
        .filter(record => record[dateKey] && record[quantityKey] > 0)
        .map(record => ({
            record,
            date: record[dateKey],
            quantity: record[quantityKey]
        }))
        .filter(event => week === null || getWeekNumber(parseDate(event.date)) === week);
}

function renderWeekSummary() {
    const container = document.getElementById('week-segments');
    container.innerHTML = weekSegments.map(segment => `
        <button type="button" class="week-pill ${segment.number === selectedWeek ? 'active' : ''}" data-week="${segment.number}" aria-pressed="${segment.number === selectedWeek}">
            <strong>${segment.label}</strong>
            <span>${segment.start} - ${segment.end}</span>
        </button>
    `).join('');

    container.querySelectorAll('.week-pill').forEach(button => {
        button.addEventListener('click', () => {
            const nextWeek = Number(button.dataset.week);
            selectedWeek = selectedWeek === nextWeek ? null : nextWeek;
            renderWeekSummary();
            updateDashboard();
            applyOperationalFilters();
        });
    });
}

function getDistributionGroup(category) {
    const normalized = category.toLocaleLowerCase('pt-BR');
    if (/embalagem|caixa/.test(normalized)) return 'Embalagens';
    if (/equipamento|ferramenta|epi|empilhadeira|ti|coleta/.test(normalized)) return 'Equipamentos';
    if (/consum|filme|proteção|fita|lacres|limpeza|lubrificante/.test(normalized)) return 'Consumíveis';
    return 'Outros';
}

function getDashboardSummary(records) {
    const categories = new Map();
    const distribution = { Equipamentos: 0, Consumíveis: 0, Embalagens: 0, Outros: 0 };

    records.forEach(record => {
        distribution[getDistributionGroup(record.category)] += 1;
    });

    const criticalRecords = records.filter(record => record.quantity <= record.minimum);
    const totalValue = records.reduce((total, record) => total + getRecordValue(record), 0);
    const totalQuantity = records.reduce((total, record) => total + record.quantity, 0);
    const entryEvents = getMovementEvents('entradas');
    const exitEvents = getMovementEvents('saidas');
    const movementEvents = [...entryEvents, ...exitEvents];
    movementEvents.forEach(event => {
        const movementValue = event.quantity * event.record.unitCost;
        categories.set(event.record.category, (categories.get(event.record.category) || 0) + movementValue);
    });
    const latestDate = movementEvents
        .map(event => parseDate(event.date))
        .sort((a, b) => b - a)[0];

    return {
        totalValue,
        totalQuantity,
        criticalRecords,
        categories: [...categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
        distribution,
        entries: entryEvents.reduce((total, event) => total + event.quantity, 0),
        exits: exitEvents.reduce((total, event) => total + event.quantity, 0),
        movementValue: movementEvents.reduce((total, event) => total + event.quantity * event.record.unitCost, 0),
        latestMovement: latestDate ? formatDate(latestDate) : '—'
    };
}

function renderCriticalItems(records) {
    const criticalList = document.querySelector('.critical-list');
    const criticalItems = records
        .filter(record => record.quantity <= record.minimum)
        .sort((a, b) => getRecordValue(b) - getRecordValue(a))
        .slice(0, 5);

    criticalList.innerHTML = criticalItems.length
        ? criticalItems.map(record => `
            <div class="list-item">
                <div class="item-info">
                    <h4>${escapeHtml(record.name)}</h4>
                    <p>${escapeHtml(record.sku)} | Qtd: ${record.quantity} ${escapeHtml(record.unit)}</p>
                </div>
                <div class="item-value"><h4>${formatCurrency(getRecordValue(record))}</h4></div>
            </div>
        `).join('')
        : '<p class="card-sub">Nenhum SKU crítico neste período.</p>';
}

function updateDashboard() {
    const records = getDashboardRecords();
    const summary = getDashboardSummary(records);
    const isWeekSelected = selectedWeek !== null;

    document.getElementById('kpi-valor').textContent = formatCurrency(summary.totalValue);
    document.getElementById('kpi-skus').textContent = records.length.toLocaleString('pt-BR');
    document.getElementById('kpi-itens').textContent = summary.totalQuantity.toLocaleString('pt-BR');
    document.getElementById('kpi-critical-count').textContent = summary.criticalRecords.length.toLocaleString('pt-BR');
    document.getElementById('status-label').textContent = summary.criticalRecords.length ? 'Atenção à reposição' : 'Estoque normal';
    document.getElementById('kpi-valor-sub').textContent = isWeekSelected ? `SKUs com movimentação na Semana ${selectedWeek}` : 'Valor calculado pela planilha';
    document.getElementById('kpi-skus-sub').textContent = isWeekSelected ? 'SKUs movimentados na semana' : 'Tipos de materiais no mês';
    document.getElementById('kpi-itens-sub').textContent = isWeekSelected ? 'Unidades dos SKUs movimentados na semana' : 'Unidades físicas (UN/CX/RL)';
    document.getElementById('kpi-valor-label').textContent = isWeekSelected ? 'VALOR EM ESTOQUE DOS SKUs (R$)' : 'VALOR EM ESTOQUE (R$)';
    document.getElementById('kpi-itens-label').textContent = isWeekSelected ? 'QTD. EM ESTOQUE DOS SKUs' : 'QTD. TOTAL DE ITENS';
    document.getElementById('metric-entries').textContent = summary.entries.toLocaleString('pt-BR');
    document.getElementById('metric-exits').textContent = summary.exits.toLocaleString('pt-BR');
    document.getElementById('metric-movement-value').textContent = formatCurrency(summary.movementValue);
    document.getElementById('metric-last-movement').textContent = summary.latestMovement;

    barChart.data.labels = summary.categories.map(([category]) => category);
    barChart.data.datasets[0].data = summary.categories.map(([, value]) => value);
    barChart.update();

    pieChart1.data.datasets[0].data = [
        records.length - summary.criticalRecords.length,
        summary.criticalRecords.length
    ];
    pieChart1.update();

    pieChart2.data.datasets[0].data = [
        summary.distribution.Equipamentos,
        summary.distribution.Consumíveis,
        summary.distribution.Embalagens,
        summary.distribution.Outros
    ];
    pieChart2.update();

    renderCriticalItems(records);

    const weeklyValues = weekSegments.map(segment => ['entradas', 'saidas']
        .flatMap(type => getMovementEvents(type, segment.number))
        .reduce((total, event) => total + event.quantity * event.record.unitCost, 0));
    lineChart.data.labels = weekSegments.map(segment => `Sem ${segment.number}`);
    lineChart.data.datasets[0].data = weeklyValues;
    lineChart.data.datasets[0].pointBackgroundColor = weekSegments.map(segment => segment.number === selectedWeek ? '#f43f5e' : '#00d2ff');
    lineChart.data.datasets[0].pointBorderColor = lineChart.data.datasets[0].pointBackgroundColor;
    lineChart.data.datasets[0].pointRadius = weekSegments.map(segment => segment.number === selectedWeek ? 5 : 0);
    lineChart.update();
}

function renderInventoryTable() {
    const body = document.getElementById('inventory-table-body');
    body.innerHTML = getMonthRecords().map(record => {
        const critical = record.quantity <= record.minimum;
        return `
            <tr>
                <td>${escapeHtml(record.sku)}</td>
                <td>${escapeHtml(record.name)}</td>
                <td>${escapeHtml(record.address)}</td>
                <td>${record.quantity.toLocaleString('pt-BR')} ${escapeHtml(record.unit)}</td>
                <td>${formatCurrency(getRecordValue(record))}</td>
                <td><span class="badge ${critical ? 'badge-critico' : 'badge-normal'}">${critical ? 'Crítico' : 'Normal'}</span></td>
            </tr>
        `;
    }).join('');
}

function renderOperationalTables() {
    [
        { type: 'entradas', body: document.querySelector('tbody[data-operational-table="entradas"]') },
        { type: 'saidas', body: document.querySelector('tbody[data-operational-table="saidas"]') }
    ].forEach(({ type, body }) => {
        const quantityKey = type === 'entradas' ? 'entryQuantity' : 'exitQuantity';
        const dateKey = type === 'entradas' ? 'entryDate' : 'exitDate';
        const events = getMonthRecords()
            .filter(record => record[dateKey] && record[quantityKey] > 0)
            .map(record => ({ record, date: record[dateKey], quantity: record[quantityKey] }))
            .sort((a, b) => parseDate(a.date) - parseDate(b.date));

        body.innerHTML = events.map(({ record, date, quantity }) => {
            const week = getWeekNumber(parseDate(date));
            return `
                <tr data-semana="${week}">
                    <td>${date}<br><small style="color: var(--accent-cyan); font-weight: 600;">Semana ${week}</small></td>
                    <td>${escapeHtml(record.sku)}</td>
                    <td>${escapeHtml(record.name)}</td>
                    <td>${quantity.toLocaleString('pt-BR')} ${escapeHtml(record.unit)}</td>
                </tr>
            `;
        }).join('');
    });
}

function applyOperationalFilters() {
    document.querySelectorAll('[data-operational-table]').forEach(body => {
        let visibleCount = 0;
        body.querySelectorAll('tr:not(.empty-state-row)').forEach(row => {
            const visible = selectedWeek === null || row.dataset.semana === String(selectedWeek);
            row.hidden = !visible;
            if (visible) visibleCount += 1;
        });

        let emptyRow = body.querySelector('.empty-state-row');
        if (visibleCount === 0) {
            if (!emptyRow) {
                emptyRow = document.createElement('tr');
                emptyRow.className = 'empty-state-row';
                const cell = document.createElement('td');
                cell.colSpan = body.closest('table').querySelectorAll('thead th').length;
                cell.className = 'card-sub';
                emptyRow.append(cell);
                body.append(emptyRow);
            }
            const period = selectedWeek === null ? MONTHS[selectedMonth].label : `a Semana ${selectedWeek} de ${MONTHS[selectedMonth].label}`;
            emptyRow.firstElementChild.textContent = `Não há registros de movimentação para ${period}.`;
            emptyRow.hidden = false;
        } else if (emptyRow) {
            emptyRow.hidden = true;
        }
    });
}

function updateMonth() {
    selectedMonth = document.getElementById('month-select').value;
    selectedWeek = null;
    weekSegments = buildWeekSegments(selectedMonth);
    renderWeekSummary();
    updateDashboard();
    renderInventoryTable();
    renderOperationalTables();
    applyOperationalFilters();
}

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

navItems.forEach(item => {
    item.addEventListener('click', event => {
        event.preventDefault();
        navItems.forEach(nav => nav.classList.remove('active'));
        pages.forEach(page => page.classList.remove('active'));
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
        document.getElementById('week-segments').classList.toggle('is-hidden', targetId === 'view-inventario');
    });
});

Chart.defaults.color = '#64748b';
Chart.defaults.font.family = "'Poppins', sans-serif";

const barChart = new Chart(document.getElementById('barChart').getContext('2d'), {
    type: 'bar',
    data: {
        labels: [],
        datasets: [{
            label: 'Valor total (R$)',
            data: [],
            backgroundColor: '#00d2ff',
            borderRadius: 4,
            barPercentage: 0.6
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { display: false, grid: { display: false } },
            x: { grid: { display: false, drawBorder: false }, ticks: { font: { size: 9 } } }
        }
    }
});

const pieChart1 = new Chart(document.getElementById('pieChart1').getContext('2d'), {
    type: 'doughnut',
    data: {
        labels: ['Normal', 'Crítico'],
        datasets: [{ data: [], backgroundColor: ['#00d2ff', '#f43f5e'], borderWidth: 0, hoverOffset: 4 }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: { legend: { display: false } }
    }
});

const pieChart2 = new Chart(document.getElementById('pieChart2').getContext('2d'), {
    type: 'pie',
    data: {
        labels: ['Equipamentos', 'Consumíveis', 'Embalagens', 'Outros'],
        datasets: [{ data: [], backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6', '#0ea5e9'], borderWidth: 0, hoverOffset: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
});

const lineContext = document.getElementById('lineChart').getContext('2d');
const lineGradient = lineContext.createLinearGradient(0, 0, 0, 300);
lineGradient.addColorStop(0, 'rgba(0, 210, 255, 0.3)');
lineGradient.addColorStop(1, 'rgba(0, 210, 255, 0.0)');

const lineChart = new Chart(lineContext, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Valor em estoque por semana (R$)',
            data: [],
            borderColor: '#00d2ff',
            borderWidth: 2,
            backgroundColor: lineGradient,
            fill: true,
            tension: 0.4,
            pointRadius: []
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false, beginAtZero: true } }
    }
});

document.getElementById('month-select').addEventListener('change', updateMonth);
weekSegments = buildWeekSegments(selectedMonth);
renderWeekSummary();
updateDashboard();
renderInventoryTable();
renderOperationalTables();
applyOperationalFilters();
