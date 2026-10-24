// =========================================================
// DATAWAVES OPTIMIZER - SCRIPT CON SUPABASE CLOUD (BASE DE DATOS ÚNICA)
// =========================================================

// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = 'https://sksanvauywgjxmxujicl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2fuRdNLrO24nN5HA6e8lmw_v6IYVleX';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let partsList = [];
let editingIndex = null;
let partColorsMap = {};
let currentLoadedId = null; // ID del registro cargado

// Configurar acento verde por defecto
document.documentElement.setAttribute('data-accent', 'verde');
document.body.setAttribute('data-accent', 'verde');

// Funciones auxiliares para obtener y limpiar datos de la orden
function getOrderData() {
    return {
        id: (document.getElementById('doc-id')?.value || '').trim(),
        of: (document.getElementById('doc-of')?.value || '').trim(),
        descripcion: (document.getElementById('doc-descripcion')?.value || '').trim(),
        cliente: (document.getElementById('doc-cliente')?.value || '').trim(),
        obra: (document.getElementById('doc-obra')?.value || '').trim()
    };
}

function clearOrderDataFields() {
    const docId = document.getElementById('doc-id');
    const docOf = document.getElementById('doc-of');
    const docDesc = document.getElementById('doc-descripcion');
    const docCliente = document.getElementById('doc-cliente');
    const docObra = document.getElementById('doc-obra');

    if (docId) docId.value = '';
    if (docOf) docOf.value = '';
    if (docDesc) docDesc.value = '';
    if (docCliente) docCliente.value = '';
    if (docObra) docObra.value = '';
}

function setOrderDataFields(orderData) {
    if (!orderData) {
        clearOrderDataFields();
        return;
    }
    const docId = document.getElementById('doc-id');
    const docOf = document.getElementById('doc-of');
    const docDesc = document.getElementById('doc-descripcion');
    const docCliente = document.getElementById('doc-cliente');
    const docObra = document.getElementById('doc-obra');

    if (docId) docId.value = orderData.id || '';
    if (docOf) docOf.value = orderData.of || '';
    if (docDesc) docDesc.value = orderData.descripcion || '';
    if (docCliente) docCliente.value = orderData.cliente || '';
    if (docObra) docObra.value = orderData.obra || '';
}

function formatDocNameWithOF(baseName, ofVal) {
    let cleanName = baseName.trim();
    cleanName = cleanName.replace(/^OF\s+\d+\s*-\s*/i, '');
    if (ofVal && ofVal.trim() !== '') {
        return `OF ${ofVal.trim()} - ${cleanName}`;
    }
    return cleanName;
}

function updateButtonStates() {
    const projectName = document.getElementById('project-name').value.trim();
    const saveBtn = document.getElementById('btn-save-project');
    const updateBtn = document.getElementById('btn-update-project');
    const newBtn = document.getElementById('btn-new-project');
    const deleteBtn = document.getElementById('btn-delete-project');
    const exportBtn = document.getElementById('btn-export-project');
    const select = document.getElementById('saved-projects-select');

    if (projectName.length > 0 && partsList.length > 0) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
        saveBtn.style.cursor = 'pointer';
    } else {
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.5';
        saveBtn.style.cursor = 'not-allowed';
    }

    if (currentLoadedId && projectName.length > 0 && partsList.length > 0) {
        updateBtn.disabled = false;
        updateBtn.style.opacity = '1';
        updateBtn.style.cursor = 'pointer';
    } else {
        updateBtn.disabled = true;
        updateBtn.style.opacity = '0.5';
        updateBtn.style.cursor = 'not-allowed';
    }

    if (projectName.length > 0 || partsList.length > 0) {
        newBtn.disabled = false;
        newBtn.style.opacity = '1';
        newBtn.style.cursor = 'pointer';
    } else {
        newBtn.disabled = true;
        newBtn.style.opacity = '0.5';
        newBtn.style.cursor = 'not-allowed';
    }

    if (select && select.value !== "") {
        deleteBtn.disabled = false;
        deleteBtn.style.opacity = '1';
        deleteBtn.style.cursor = 'pointer';

        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.style.opacity = '1';
            exportBtn.style.cursor = 'pointer';
        }
    } else {
        deleteBtn.disabled = true;
        deleteBtn.style.opacity = '0.5';
        deleteBtn.style.cursor = 'not-allowed';

        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.style.opacity = '0.5';
            exportBtn.style.cursor = 'not-allowed';
        }
    }
}

function injectFloatingSkinPicker() {
    const bar = document.createElement('div');
    bar.id = 'dw-floating-skin-bar';
    bar.style.cssText = `
        position: absolute;
        top: 20px;
        right: 30px;
        display: flex;
        gap: 6px;
        align-items: center;
        z-index: 99999;
    `;

    const accents = [
        { name: 'maiki', color: '#b35500' },
        { name: 'leo', color: '#278dbb' },
        { name: 'rafa', color: '#bb3030' },
        { name: 'doni', color: '#7a3bbb' },
        { name: 'verde', color: '#78B242' },
        { name: 'chocolate', color: '#75505D' }
    ];

    accents.forEach(acc => {
        const dot = document.createElement('button');
        dot.style.cssText = `
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background-color: ${acc.color};
            border: 2px solid transparent;
            cursor: pointer;
            padding: 0;
            transition: transform 0.2s ease;
        `;
        dot.onmouseover = () => dot.style.transform = 'scale(1.25)';
        dot.onmouseout = () => dot.style.transform = 'scale(1)';
        dot.onclick = () => {
            document.documentElement.setAttribute('data-accent', acc.name);
            document.body.setAttribute('data-accent', acc.name);
            
            const accentColors = { 'maiki': '#b35500', 'leo': '#278dbb', 'rafa': '#bb3030', 'doni': '#7a3bbb', 'verde': '#78B242', 'chocolate': '#75505D' };
            const newColor = accentColors[acc.name] || '#78B242';
            
            const logoText = document.querySelector('.dw-logo-dynamic-fill');
            if (logoText) logoText.style.color = newColor;

            if (editingIndex === null) {
                const addBtn = document.getElementById('btn-add-part');
                if (addBtn) addBtn.style.setProperty('background-color', newColor, 'important');
            }
            const optBtn = document.getElementById('btn-optimize');
            if (optBtn) optBtn.style.setProperty('background-color', newColor, 'important');
            const saveBtn = document.getElementById('btn-save-project');
            if (saveBtn) saveBtn.style.setProperty('background-color', newColor, 'important');
        };
        bar.appendChild(dot);
    });

    const header = document.querySelector('header');
    if (header) {
        header.style.position = 'relative';
        header.appendChild(bar);
    }
}

// =========================================================
// GESTIÓN DE SUPABASE (BASE DE DATOS CLOUD)
// =========================================================

async function populateSavedProjectsDropdown() {
    const select = document.getElementById('saved-projects-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- CARGANDO DESDE LA NUBE... --</option>';

    const { data, error } = await supabaseClient
        .from('projects')
        .select('doc_name')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error al cargar proyectos de Supabase:', error);
        select.innerHTML = '<option value="">-- ERROR AL CARGAR --</option>';
        return;
    }

    select.innerHTML = '<option value="">-- SELECCIONAR --</option>';

    data.forEach(row => {
        const option = document.createElement('option');
        option.value = row.doc_name;
        option.textContent = row.doc_name.toUpperCase();
        select.appendChild(option);
    });
    
    if (currentLoadedId) {
        select.value = currentLoadedId;
    }
    updateButtonStates();
}

document.getElementById('project-name').addEventListener('input', () => {
    updateButtonStates();
});

document.getElementById('saved-projects-select').addEventListener('change', () => {
    updateButtonStates();
});

document.getElementById('btn-save-project').addEventListener('click', async () => {
    let rawDocName = document.getElementById('project-name').value.trim();
    const ofVal = document.getElementById('doc-of').value.trim();
    
    let docName = formatDocNameWithOF(rawDocName, ofVal).toUpperCase();
    document.getElementById('project-name').value = docName;

    const barLength = parseFloat(document.getElementById('bar-length').value);
    const bladeWidth = parseFloat(document.getElementById('blade-width').value) || 0;

    if (!docName || partsList.length === 0) return;

    // Verificar si ya existe en Supabase
    const { data: existing } = await supabaseClient
        .from('projects')
        .select('doc_name')
        .eq('doc_name', docName)
        .single();

    if (existing) {
        alert('YA EXISTE UN REGISTRO CON ESTE NOMBRE EN LA NUBE.');
        return;
    }

    const projectData = {
        doc_name: docName,
        bar_length: barLength,
        blade_width: bladeWidth,
        parts_list: partsList,
        order_data: getOrderData(),
        updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient.from('projects').insert([projectData]);

    if (error) {
        alert('ERROR AL GUARDAR EN LA NUBE: ' + error.message);
        return;
    }

    currentLoadedId = docName;
    
    await populateSavedProjectsDropdown();
    document.getElementById('saved-projects-select').value = docName;
    updateButtonStates();
    alert(`EL REGISTRO "${docName}" HA SIDO GUARDADO EN LA NUBE EXITOSAMENTE.`);
});

document.getElementById('btn-update-project').addEventListener('click', async () => {
    let rawDocName = document.getElementById('project-name').value.trim();
    const ofVal = document.getElementById('doc-of').value.trim();
    
    let docName = formatDocNameWithOF(rawDocName, ofVal).toUpperCase();
    document.getElementById('project-name').value = docName;

    const barLength = parseFloat(document.getElementById('bar-length').value);
    const bladeWidth = parseFloat(document.getElementById('blade-width').value) || 0;

    if (!docName || partsList.length === 0 || !currentLoadedId) return;

    const confirmar = window.confirm('¿ESTÁS SEGURO DE ACTUALIZAR ESTE REGISTRO EN LA NUBE?');
    if (!confirmar) return;

    // Si cambió el nombre del documento, eliminamos el anterior y creamos uno nuevo
    if (currentLoadedId !== docName) {
        await supabaseClient.from('projects').delete().eq('doc_name', currentLoadedId);
    }

    const projectData = {
        doc_name: docName,
        bar_length: barLength,
        blade_width: bladeWidth,
        parts_list: partsList,
        order_data: getOrderData(),
        updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient
        .from('projects')
        .upsert([projectData]);

    if (error) {
        alert('ERROR AL ACTUALIZAR: ' + error.message);
        return;
    }

    currentLoadedId = docName;

    await populateSavedProjectsDropdown();
    document.getElementById('saved-projects-select').value = docName;
    updateButtonStates();
    alert(`EL REGISTRO "${docName}" FUE ACTUALIZADO CON ÉXITO.`);
});

document.getElementById('btn-load-project').addEventListener('click', async () => {
    const selectedDoc = document.getElementById('saved-projects-select').value;
    if (!selectedDoc) {
        alert('SELECCIONE UN DOCUMENTO DE LA LISTA PARA CARGAR.');
        return;
    }

    const hasProgress = document.getElementById('project-name').value.trim().length > 0 || partsList.length > 0;

    if (hasProgress) {
        const confirmarCarga = window.confirm('¿ESTAS SEGURO DE CARGAR UN REGISTRO EXISTENTE? PERDERAS EL PROGRESO ACTUAL.');
        if (!confirmarCarga) return;
    }

    const { data, error } = await supabaseClient
        .from('projects')
        .select('*')
        .eq('doc_name', selectedDoc)
        .single();

    if (error || !data) {
        alert('NO SE PUDO OBTENER EL DOCUMENTO DESDE LA NUBE.');
        return;
    }

    currentLoadedId = data.doc_name;
    document.getElementById('project-name').value = data.doc_name;
    document.getElementById('bar-length').value = data.bar_length;
    document.getElementById('blade-width').value = data.blade_width;
    partsList = JSON.parse(JSON.stringify(data.parts_list || []));
    editingIndex = null;

    setOrderDataFields(data.order_data);

    renderPartsTable();
    updateButtonStates();
    
    document.getElementById('btn-optimize').click();
});

document.getElementById('btn-delete-project').addEventListener('click', async () => {
    const selectedDoc = document.getElementById('saved-projects-select').value;
    if (!selectedDoc) {
        alert('SELECCIONE UN DOCUMENTO DE LA LISTA PARA ELIMINAR.');
        return;
    }

    const confirmDelete = window.confirm(`¿ESTÁS SEGURO DE ELIMINAR EL REGISTRO "${selectedDoc}" DE LA NUBE PARA TODOS?`);
    if (!confirmDelete) return;

    const { error } = await supabaseClient
        .from('projects')
        .delete()
        .eq('doc_name', selectedDoc);

    if (error) {
        alert('ERROR AL ELIMINAR: ' + error.message);
        return;
    }

    if (currentLoadedId === selectedDoc) {
        currentLoadedId = null;
        clearOrderDataFields();
    }
    
    await populateSavedProjectsDropdown();
    document.getElementById('saved-projects-select').value = "";
    updateButtonStates();
    alert(`EL REGISTRO "${selectedDoc}" FUE ELIMINADO CON ÉXITO.`);
});

document.getElementById('btn-new-project').addEventListener('click', () => {
    currentLoadedId = null;
    document.getElementById('project-name').value = '';
    document.getElementById('bar-length').value = '6000';
    document.getElementById('blade-width').value = '2';
    document.getElementById('saved-projects-select').value = '';
    document.getElementById('part-name').value = '';
    document.getElementById('part-length').value = '';
    document.getElementById('part-qty').value = '';
    
    clearOrderDataFields();

    partsList = [];
    editingIndex = null;
    renderPartsTable();
    updateButtonStates();

    document.getElementById('results-container').innerHTML = 'AGREGUE PIEZAS Y PRESIONE "CALCULAR OPTIMIZACIÓN" PARA GENERAR EL PLANO DE BARRAS.';
});

// =========================================================
// EXPORTACIÓN E IMPORTACIÓN DE ARCHIVOS DE REGISTRO
// =========================================================

document.getElementById('btn-export-project').addEventListener('click', async () => {
    const selectedDoc = document.getElementById('saved-projects-select').value;
    if (!selectedDoc) {
        alert('SELECCIONE UN REGISTRO PARA EXPORTAR.');
        return;
    }

    const { data, error } = await supabaseClient
        .from('projects')
        .select('*')
        .eq('doc_name', selectedDoc)
        .single();

    if (error || !data) {
        alert('NO SE PUDO OBTENER EL REGISTRO.');
        return;
    }

    const exportObject = {
        docName: data.doc_name,
        barLength: data.bar_length,
        bladeWidth: data.blade_width,
        partsList: data.parts_list,
        orderData: data.order_data,
        updatedAt: data.updated_at
    };

    const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDoc.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

document.getElementById('btn-import-project').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
});

document.getElementById('import-file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            const project = JSON.parse(evt.target.result);

            if (!project.docName || !project.partsList) {
                alert('EL ARCHIVO SELECCIONADO NO TIENE UN FORMATO VÁLIDO DE OPTIMIZADOR.');
                return;
            }

            const docName = project.docName.toUpperCase();

            const projectData = {
                doc_name: docName,
                bar_length: project.barLength,
                blade_width: project.bladeWidth || 2,
                parts_list: project.partsList,
                order_data: project.orderData || {},
                updated_at: new Date().toISOString()
            };

            const { error } = await supabaseClient
                .from('projects')
                .upsert([projectData]);

            if (error) {
                alert('ERROR AL SUBIR A LA NUBE: ' + error.message);
                return;
            }

            await populateSavedProjectsDropdown();
            document.getElementById('saved-projects-select').value = docName;
            updateButtonStates();

            const autoLoad = window.confirm(`REGISTRO "${docName}" IMPORTADO A LA NUBE CON ÉXITO.\n¿DESEAS CARGARLO EN PANTALLA AHORA?`);
            if (autoLoad) {
                document.getElementById('btn-load-project').click();
            }
        } catch (err) {
            alert('ERROR AL LEER EL ARCHIVO JSON: ' + err.message);
        }
        
        e.target.value = '';
    };

    reader.readAsText(file);
});

// =========================================================
// GESTIÓN DE PIEZAS
// =========================================================

document.getElementById('btn-add-part').addEventListener('click', () => {
    const name = document.getElementById('part-name').value.trim();
    const length = parseFloat(document.getElementById('part-length').value);
    const qty = parseInt(document.getElementById('part-qty').value);
    const barLength = parseFloat(document.getElementById('bar-length').value);

    if (!name || isNaN(length) || length <= 0 || isNaN(qty) || qty <= 0) {
        alert('POR FAVOR COMPLETE CORRECTAMENTE LOS CAMPOS DE LA PIEZA.');
        return;
    }

    if (length > barLength) {
        alert('LA LONGITUD DE LA PIEZA NO PUEDE SER MAYOR QUE LA BARRA BASE.');
        return;
    }

    if (editingIndex !== null) {
        partsList[editingIndex] = { name, length, qty };
        editingIndex = null;
        const addBtn = document.getElementById('btn-add-part');
        addBtn.textContent = 'AGREGAR PIEZA';
        addBtn.style.backgroundColor = '';
    } else {
        partsList.push({ name, length, qty });
    }

    renderPartsTable();
    updateButtonStates();

    document.getElementById('part-name').value = '';
    document.getElementById('part-length').value = '';
    document.getElementById('part-qty').value = '';
    document.getElementById('part-name').focus();
});

function renderPartsTable() {
    const tbody = document.getElementById('parts-table-body');
    tbody.innerHTML = '';

    if (partsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #71717a;">NO HAY PIEZAS AGREGADAS.</td></tr>`;
        return;
    }

    partsList.forEach((part, index) => {
        const tr = document.createElement('tr');
        
        let isEditing = (index === editingIndex);
        let rowStyle = isEditing ? 'color: #d9822b !important; font-weight: bold;' : '';

        tr.innerHTML = `
            <td style="border: 1px solid var(--dw-border); padding: 10px 12px; vertical-align: middle;"><span style="${rowStyle}">${part.name.toUpperCase()}</span></td>
            <td style="border: 1px solid var(--dw-border); padding: 10px 12px; vertical-align: middle;"><span style="${rowStyle}">${part.length} mm</span></td>
            <td style="border: 1px solid var(--dw-border); padding: 10px 12px; vertical-align: middle;"><span style="${rowStyle}">${part.qty}</span></td>
            <td style="border: 1px solid var(--dw-border); padding: 10px 12px; text-align: center; vertical-align: middle;">
                <div style="display: inline-flex; gap: 8px; justify-content: center; align-items: center;">
                    <button class="btn-action-edit" data-index="${index}" style="${isEditing ? 'background-color: #d9822b !important;' : ''}">${isEditing ? 'CANCELAR' : 'EDITAR'}</button>
                    <button class="btn-action-delete" data-index="${index}">ELIMINAR</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-action-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            editPart(index);
        });
    });

    document.querySelectorAll('.btn-action-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            confirmRemovePart(index);
        });
    });
}

function editPart(index) {
    const addBtn = document.getElementById('btn-add-part');

    if (editingIndex === index) {
        editingIndex = null;
        addBtn.textContent = 'AGREGAR PIEZA';
        addBtn.style.backgroundColor = '';
        document.getElementById('part-name').value = '';
        document.getElementById('part-length').value = '';
        document.getElementById('part-qty').value = '';
        renderPartsTable();
        return;
    }

    const part = partsList[index];
    document.getElementById('part-name').value = part.name;
    document.getElementById('part-length').value = part.length;
    document.getElementById('part-qty').value = part.qty;
    editingIndex = index;
    
    addBtn.textContent = 'ACTUALIZAR PIEZA';
    addBtn.style.setProperty('background-color', '#d9822b', 'important');
    addBtn.style.setProperty('border-color', '#d9822b', 'important');
    
    renderPartsTable();
    document.getElementById('part-name').focus();
};

function confirmRemovePart(index) {
    const part = partsList[index];
    const confirmation = window.confirm(`¿ESTÁS SEGURO DE ELIMINAR LA PIEZA "${part.name.toUpperCase()}"?`);
    if (confirmation) {
        removePart(index);
    }
}

function removePart(index) {
    partsList.splice(index, 1);
    if (editingIndex === index) {
        editingIndex = null;
        const addBtn = document.getElementById('btn-add-part');
        addBtn.textContent = 'AGREGAR PIEZA';
        addBtn.style.backgroundColor = '';
        document.getElementById('part-name').value = '';
        document.getElementById('part-length').value = '';
        document.getElementById('part-qty').value = '';
    }
    renderPartsTable();
    updateButtonStates();
};

function getPartColor(name) {
    if (!partColorsMap[name]) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        let hue = Math.abs(hash * 137) % 360;
        partColorsMap[name] = `hsl(${hue}, 65%, 65%)`;
    }
    return partColorsMap[name];
}

document.getElementById('btn-optimize').addEventListener('click', () => {
    const projectName = document.getElementById('project-name').value.trim() || 'PROYECTO SIN NOMBRE';
    const barLength = parseFloat(document.getElementById('bar-length').value);
    const bladeWidth = parseFloat(document.getElementById('blade-width').value) || 0;

    if (partsList.length === 0) {
        alert('DEBE AGREGAR AL MENOS UNA PIEZA PARA OPTIMIZAR.');
        return;
    }

    let expandedParts = [];
    partsList.forEach(p => {
        for (let i = 0; i < p.qty; i++) {
            expandedParts.push({ name: p.name, length: p.length });
        }
    });

    expandedParts.sort((a, b) => b.length - a.length);

    let bars = [];

    expandedParts.forEach(part => {
        let placed = false;
        for (let bar of bars) {
            let requiredSpace = part.length + (bar.cutsCount > 0 ? bladeWidth : 0);
            if (bar.remaining >= requiredSpace) {
                bar.cuts.push(part);
                bar.remaining -= requiredSpace;
                bar.cutsCount++;
                placed = true;
                break;
            }
        }
        if (!placed) {
            bars.push({
                remaining: barLength - part.length,
                cuts: [part],
                cutsCount: 1
            });
        }
    });

    let groupedBars = {};
    bars.forEach(bar => {
        let signature = bar.cuts.map(c => `${c.name}:${c.length}`).join('|');
        if (!groupedBars[signature]) {
            groupedBars[signature] = {
                cuts: bar.cuts,
                remaining: bar.remaining,
                count: 0
            };
        }
        groupedBars[signature].count++;
    });

    let finalGroups = Object.values(groupedBars);
    renderResults(projectName, barLength, finalGroups, bars.length, bladeWidth);
});

function renderResults(projectName, barLength, groups, totalUsedBars, bladeWidth) {
    const container = document.getElementById('results-container');

    let html = `
        <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="font-size: 14px; display: flex; align-items: center; gap: 15px;">
                <span><strong>DOCUMENTO:</strong> ${projectName.toUpperCase()}</span>
                <span class="badge-total-bars" style="background: transparent; color: var(--dw-text-main); padding: 5px 10px; border-radius: 4px; font-weight: bold; border: 1px solid var(--dw-border);">
                    BARRAS TOTALES: ${totalUsedBars}
                </span>
            </div>
            <button id="btn-print-report" class="btn btn-primary" style="padding: 6px 15px; border-radius: 4px; font-size: 12px; cursor: pointer;">IMPRIMIR REPORTE</button>
        </div>

        <!-- REPORTE EN PANTALLA Y EN IMPRESIÓN: LISTADO DE PIEZAS -->
        <div class="print-parts-summary" style="margin-bottom: 20px; background: var(--dw-bg-input); padding: 15px; border-radius: 6px; border: 1px solid var(--dw-border);">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                    <tr style="background: #3F3F4D; color: #C2C2D0;">
                        <th style="padding: 8px; text-align: left; border: 1px solid var(--dw-border);">LISTA DE PIEZAS</th>
                        <th style="padding: 8px; text-align: left; border: 1px solid var(--dw-border);">LONGITUD (mm)</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid var(--dw-border);">CANTIDAD</th>
                    </tr>
                </thead>
                <tbody>
    `;

    partsList.forEach(p => {
        html += `
                    <tr>
                        <td style="padding: 6px 8px; border: 1px solid var(--dw-border);">${p.name.toUpperCase()}</td>
                        <td style="padding: 6px 8px; border: 1px solid var(--dw-border);">${p.length} mm</td>
                        <td style="padding: 6px 8px; border: 1px solid var(--dw-border); text-align: center;">${p.qty}</td>
                    </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>

        <!-- PLANO VISUAL DE BARRAS -->
        <div style="display: flex; flex-direction: column; gap: 15px;">
    `;

    groups.forEach((group, idx) => {
        let barNum = idx + 1;
        let barUsedLength = barLength - group.remaining;
        let waste = group.remaining;
        let efficiency = ((barUsedLength / barLength) * 100).toFixed(1);

        html += `
            <div class="print-bar-card" style="background: var(--dw-bg-input); padding: 15px; border-radius: 6px; border: 1px solid var(--dw-border);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-weight: bold; font-size: 14px;">CANT ${group.count}</span>
                        <span>BARRA ${barNum} | UTILIZADO: ${barUsedLength} mm / SOBRANTE: ${waste} mm | EFICIENCIA: <strong style="color: var(--dw-accent);">${efficiency}%</strong></span>
                    </div>
                </div>
                <div class="print-bar-track" style="height: 32px; background: #141418; border-radius: 4px; display: flex; overflow: hidden; border: 1px solid var(--dw-border);">
        `;

        group.cuts.forEach((cut) => {
            let widthPercent = (cut.length / barLength) * 100;
            let partColor = getPartColor(cut.name);
            
            html += `
                <div class="print-cut-block" title="${cut.name}: ${cut.length}" style="width: ${widthPercent}%; background: ${partColor}; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; color: #000; overflow: hidden; white-space: nowrap; border-right: 1px solid #141418; padding: 2px; box-sizing: border-box;" >
                    <strong style="font-size: 9px; line-height: 10px; text-overflow: ellipsis; overflow: hidden; max-width: 100%; color: #000;">${cut.name.toUpperCase()}</strong>
                    <span style="font-size: 9px; font-weight: bold; color: #000;">${cut.length}</span>
                </div>
            `;
        });

        if (waste > 0) {
            let wastePercent = (waste / barLength) * 100;
            html += `
                <div class="print-waste-block" title="Sobrante: ${waste}mm" style="width: ${wastePercent}%; background: repeating-linear-gradient(45deg, rgba(255,255,255,0.08), rgba(255,255,255,0.08) 6px, transparent 6px, transparent 12px);"></div>
            `;
        }

        html += `
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;

    const printBtn = document.getElementById('btn-print-report');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
}

// ESTILOS DE IMPRESIÓN
const printStyle = document.createElement('style');
printStyle.innerHTML = `
    @media print {
        @page { size: A4 portrait; margin: 10mm; }
        body { background: #ffffff !important; color: #000000 !important; font-family: system-ui, -apple-system, sans-serif !important; margin: 0 !important; padding: 0 !important; }
        header, .card:not(#results-card), #btn-optimize, #dw-floating-skin-bar, button, .main-header { display: none !important; }
        .page-wrapper { padding: 0 !important; }
        #results-card { border: none !important; box-shadow: none !important; background: #ffffff !important; padding: 0 !important; margin: 0 !important; }
        #results-card * { color: #000000 !important; }
        table { border-collapse: collapse !important; width: 100% !important; }
        th, td { border: 1px solid #000000 !important; padding: 4px 8px !important; font-size: 11px !important; }
        .print-parts-summary { background: #ffffff !important; border: 1px solid #000000 !important; margin-bottom: 15px !important; }
        .print-bar-card { background: #ffffff !important; border: 1px solid #000000 !important; border-radius: 2px !important; margin-bottom: 10px !important; padding: 8px !important; page-break-inside: avoid; }
        .print-bar-track { height: 26px !important; background: #ffffff !important; border: 1px solid #000000 !important; border-radius: 0 !important; }
        .print-cut-block { background: #ffffff !important; color: #000000 !important; border-right: 1px solid #000000 !important; box-sizing: border-box !important; }
        .print-cut-block strong, .print-cut-block span { color: #000000 !important; font-weight: 700 !important; font-size: 8.5px !important; }
        .print-waste-block { background: #dcdcdc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border-left: 1px solid #000000 !important; }
        .badge-total-bars { border: 1px solid #000000 !important; color: #000000 !important; background: #ffffff !important; }
    }
`;
document.head.appendChild(printStyle);

window.addEventListener('DOMContentLoaded', () => {
    injectFloatingSkinPicker();
    populateSavedProjectsDropdown();
    updateButtonStates();
    const bladeInput = document.getElementById('blade-width');
    if(bladeInput && !bladeInput.value) bladeInput.value = 2;
});
