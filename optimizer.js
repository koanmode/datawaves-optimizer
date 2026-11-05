// =========================================================
// DATAWAVES OPTIMIZER - LÓGICA DE CONTROL Y SUPABASE
// =========================================================

const SUPABASE_URL = 'https://sksanvauywgjxmxujicl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2fuRdNLrO24nN5HA6e8lmw_v6IYVleX';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let partsList = [];
let inputRows = [{ name: '', length: '', qty: '' }]; 
let editingIndex = null;
let editingTempRow = null; 
let partColorsMap = {};
let currentLoadedId = null; 
let isColorBlindMode = false;

function getOrderData() {
    return {
        id: (document.getElementById('doc-id')?.value || '').trim(),
        of: (document.getElementById('doc-of')?.value || '').trim(),
        descripcion: (document.getElementById('doc-descripcion')?.value || '').trim(),
        cliente: (document.getElementById('doc-cliente')?.value || '').trim(),
        obra: (document.getElementById('doc-obra')?.value || '').trim(),
        excelCodigo: (document.getElementById('excel-codigo')?.value || '').trim(),
        excelDescripcion: (document.getElementById('excel-descripcion')?.value || '').trim(),
        excelCategoria: (document.getElementById('excel-categoria')?.value || '').trim()
    };
}

function clearOrderDataFields() {
    ['doc-id', 'doc-of', 'doc-descripcion', 'doc-cliente', 'doc-obra', 'excel-codigo', 'excel-descripcion', 'excel-categoria'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const barLengthInput = document.getElementById('bar-length');
    if (barLengthInput) barLengthInput.value = '6000';
    const bladeInput = document.getElementById('blade-width');
    if (bladeInput) bladeInput.value = '0';
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
    const excelCodigo = document.getElementById('excel-codigo');
    const excelDesc = document.getElementById('excel-descripcion');
    const excelCat = document.getElementById('excel-categoria');

    if (docId) docId.value = orderData.id || '';
    if (docOf) docOf.value = orderData.of || '';
    if (docDesc) docDesc.value = orderData.descripcion || '';
    if (docCliente) docCliente.value = orderData.cliente || '';
    if (docObra) docObra.value = orderData.obra || '';
    if (excelCodigo) excelCodigo.value = orderData.excelCodigo || '';
    if (excelDesc) excelDesc.value = orderData.excelDescripcion || '';
    if (excelCat) excelCat.value = orderData.excelCategoria || '';
}

function formatDocNameWithOF(baseName, ofVal) {
    let cleanName = (baseName || '').trim();
    cleanName = cleanName.replace(/^OF\s+\d+\s*-\s*/i, '');
    if (ofVal && ofVal.trim() !== '') {
        return `OF ${ofVal.trim()} - ${cleanName}`;
    }
    return cleanName;
}

function updateButtonStates() {
    const projectName = (document.getElementById('project-name')?.value || '').trim();
    const saveBtn = document.getElementById('btn-save-project');
    const updateBtn = document.getElementById('btn-update-project');
    const deleteBtn = document.getElementById('btn-delete-project');
    const exportBtn = document.getElementById('btn-export-project');
    const select = document.getElementById('saved-projects-select');

    if (saveBtn) saveBtn.disabled = !(projectName.length > 0 && partsList.length > 0);
    if (updateBtn) updateBtn.disabled = !(currentLoadedId && projectName.length > 0 && partsList.length > 0);

    const hasSelection = select && select.value !== "";
    if (deleteBtn) deleteBtn.disabled = !hasSelection;
    if (exportBtn) exportBtn.disabled = !hasSelection;
}

function sortPartsList() {
    partsList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

// =========================================================
// AUTOCOMPLETADO DE PERFIL DESDE LA BASE DE DATOS EXCEL
// =========================================================

document.getElementById('excel-codigo')?.addEventListener('input', async function() {
    const codigoIngresado = this.value.trim();
    
    if (codigoIngresado === '') {
        document.getElementById('excel-descripcion').value = '';
        document.getElementById('excel-categoria').value = '';
        document.getElementById('bar-length').value = '6000';
        return;
    }

    const { data, error } = await supabaseClient
        .from('excel_database')
        .select('*')
        .ilike('codigo', codigoIngresado)
        .maybeSingle();

    if (error || !data) {
        document.getElementById('excel-descripcion').value = '';
        document.getElementById('excel-categoria').value = '';
        return;
    }

    document.getElementById('excel-descripcion').value = data.descripcion || '';
    document.getElementById('excel-categoria').value = data.categoria || '';
    if (data.largo) {
        document.getElementById('bar-length').value = data.largo;
    }
});

// =========================================================
// CONTROLES DE DESBLOQUEO (LARGO Y HOJA)
// =========================================================

function toggleLockField(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!input || !btn) return;

    if (input.hasAttribute('disabled')) {
        input.removeAttribute('disabled');
        input.removeAttribute('readonly');
        input.classList.remove('field-locked');
        btn.classList.add('unlocked');
    } else {
        input.setAttribute('disabled', 'true');
        input.setAttribute('readonly', 'true');
        input.classList.add('field-locked');
        btn.classList.remove('unlocked');
    }
}

document.getElementById('btn-unlock-bar')?.addEventListener('click', () => toggleLockField('bar-length', 'btn-unlock-bar'));
document.getElementById('btn-unlock-blade')?.addEventListener('click', () => toggleLockField('blade-width', 'btn-unlock-blade'));

// =========================================================
// SUPABASE REALTIME Y PROYECTOS
// =========================================================

async function populateSavedProjectsDropdown(keepSelected = true) {
    const select = document.getElementById('saved-projects-select');
    if (!select) return;

    const previousValue = select.value;

    const { data, error } = await supabaseClient
        .from('projects')
        .select('doc_name')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error al cargar proyectos de Supabase:', error);
        return;
    }

    select.innerHTML = '<option value="">-- SELECCIONAR --</option>';

    (data || []).forEach(row => {
        const option = document.createElement('option');
        option.value = row.doc_name;
        option.textContent = row.doc_name.toUpperCase();
        select.appendChild(option);
    });
    
    if (keepSelected && previousValue) {
        select.value = previousValue;
    } else if (currentLoadedId) {
        select.value = currentLoadedId;
    }
    
    updateButtonStates();
}

function initRealtimeSync() {
    supabaseClient
        .channel('public:projects')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
            populateSavedProjectsDropdown(true);
        })
        .subscribe();
}

document.getElementById('project-name')?.addEventListener('input', () => {
    updateButtonStates();
});

document.getElementById('btn-colorblind-mode')?.addEventListener('click', () => {
    isColorBlindMode = !isColorBlindMode;
    const btn = document.getElementById('btn-colorblind-mode');
    
    if (isColorBlindMode) {
        btn.classList.add('active-mode');
        btn.style.backgroundColor = 'rgba(179, 85, 0, 0.2)';
        btn.style.borderRadius = '4px';
    } else {
        btn.classList.remove('active-mode');
        btn.style.backgroundColor = 'transparent';
    }

    if (partsList.length > 0) {
        document.getElementById('btn-optimize').click();
    }
});

let lastSelectedValue = "";

document.getElementById('saved-projects-select')?.addEventListener('change', async function() {
    const selectedDoc = this.value;
    const hasProgress = (document.getElementById('project-name').value.trim().length > 0) || partsList.length > 0;

    if (selectedDoc === "") {
        if (hasProgress) {
            const confirmNew = window.confirm('¿ESTÁS SEGURO DE CREAR UN NUEVO PROYECTO? SE PERDERÁ EL PROGRESO NO GUARDADO.');
            if (!confirmNew) {
                this.value = lastSelectedValue;
                return;
            }
        }
        executeNewProjectReset();
        lastSelectedValue = "";
        return;
    }

    if (hasProgress) {
        const confirmarCarga = window.confirm('¿ESTÁS SEGURO DE CARGAR UN REGISTRO EXISTENTE? PERDERÁS EL PROGRESO ACTUAL.');
        if (!confirmarCarga) {
            this.value = lastSelectedValue;
            return;
        }
    }

    lastSelectedValue = selectedDoc;
    await loadProjectData(selectedDoc);
});

async function loadProjectData(selectedDoc) {
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
    document.getElementById('bar-length').value = data.bar_length || 6000;
    document.getElementById('blade-width').value = data.blade_width !== undefined ? data.blade_width : 0;
    
    partsList = JSON.parse(JSON.stringify(data.parts_list || []));
    sortPartsList();

    editingIndex = null;
    editingTempRow = null;
    inputRows = [{ name: '', length: '', qty: '' }];

    setOrderDataFields(data.order_data);

    renderInputRows();
    renderPartsTable();
    updateButtonStates();
    document.getElementById('btn-optimize').click();
}

function executeNewProjectReset() {
    currentLoadedId = null;
    document.getElementById('project-name').value = '';
    document.getElementById('bar-length').value = '6000';
    document.getElementById('blade-width').value = '0';
    document.getElementById('saved-projects-select').value = '';
    
    inputRows = [{ name: '', length: '', qty: '' }];
    editingIndex = null;
    editingTempRow = null;
    renderInputRows();
    
    clearOrderDataFields();

    partsList = [];
    renderPartsTable();
    updateButtonStates();

    document.getElementById('results-container').innerHTML = 'AGREGUE PIEZAS Y PRESIONE "CALCULAR OPTIMIZACIÓN" PARA GENERAR EL PLANO DE BARRAS.';
}

document.getElementById('btn-save-project')?.addEventListener('click', async () => {
    let rawDocName = document.getElementById('project-name').value.trim();
    const ofVal = document.getElementById('doc-of').value.trim();
    
    let docName = formatDocNameWithOF(rawDocName, ofVal).toUpperCase();
    document.getElementById('project-name').value = docName;

    const barLength = parseFloat(document.getElementById('bar-length').value) || 6000;
    const bladeWidth = parseFloat(document.getElementById('blade-width').value) || 0;

    if (!docName || partsList.length === 0) {
        alert('DEBE INGRESAR UN NOMBRE DE PROYECTO Y AL MENOS UNA PIEZA PARA REGISTRAR.');
        return;
    }

    const { data: existing } = await supabaseClient
        .from('projects')
        .select('doc_name')
        .eq('doc_name', docName)
        .maybeSingle();

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
    await populateSavedProjectsDropdown(false);
    document.getElementById('saved-projects-select').value = docName;
    lastSelectedValue = docName;
    updateButtonStates();
    alert(`EL REGISTRO "${docName}" HA SIDO GUARDADO EN LA NUBE EXITOSAMENTE.`);
});

document.getElementById('btn-update-project')?.addEventListener('click', async () => {
    let rawDocName = document.getElementById('project-name').value.trim();
    const ofVal = document.getElementById('doc-of').value.trim();
    
    let docName = formatDocNameWithOF(rawDocName, ofVal).toUpperCase();
    document.getElementById('project-name').value = docName;

    const barLength = parseFloat(document.getElementById('bar-length').value) || 6000;
    const bladeWidth = parseFloat(document.getElementById('blade-width').value) || 0;

    if (!docName || partsList.length === 0 || !currentLoadedId) {
        alert('NO HAY UN REGISTRO CARGADO PARA ACTUALIZAR.');
        return;
    }

    const confirmar = window.confirm('¿ESTÁS SEGURO DE ACTUALIZAR ESTE REGISTRO EN LA NUBE?');
    if (!confirmar) return;

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

    const { error } = await supabaseClient.from('projects').upsert([projectData]);

    if (error) {
        alert('ERROR AL ACTUALIZAR: ' + error.message);
        return;
    }

    currentLoadedId = docName;
    await populateSavedProjectsDropdown(false);
    document.getElementById('saved-projects-select').value = docName;
    lastSelectedValue = docName;
    updateButtonStates();
    alert(`EL REGISTRO "${docName}" FUE ACTUALIZADO CON ÉXITO.`);
});

document.getElementById('btn-delete-project')?.addEventListener('click', async () => {
    const selectedDoc = document.getElementById('saved-projects-select').value;
    if (!selectedDoc) {
        alert('SELECCIONE UN DOCUMENTO DE LA LISTA PARA ELIMINAR.');
        return;
    }

    const confirmDelete = window.confirm(`¿ESTÁS SEGURO DE ELIMINAR EL REGISTRO "${selectedDoc}" DE LA NUBE PARA TODOS?`);
    if (!confirmDelete) return;

    const { error } = await supabaseClient.from('projects').delete().eq('doc_name', selectedDoc);

    if (error) {
        alert('ERROR AL ELIMINAR: ' + error.message);
        return;
    }

    if (currentLoadedId === selectedDoc) {
        executeNewProjectReset();
    } else {
        await populateSavedProjectsDropdown(false);
        document.getElementById('saved-projects-select').value = "";
        lastSelectedValue = "";
        updateButtonStates();
    }
    
    alert(`EL REGISTRO "${selectedDoc}" FUE ELIMINADO CON ÉXITO.`);
});

// =========================================================
// IMPORTACIÓN Y EXPORTACIÓN JSON
// =========================================================

document.getElementById('btn-export-project')?.addEventListener('click', async () => {
    const selectedDoc = document.getElementById('saved-projects-select').value;
    if (!selectedDoc) {
        alert('SELECCIONE UN REGISTRO PARA EXPORTAR.');
        return;
    }

    const { data, error } = await supabaseClient.from('projects').select('*').eq('doc_name', selectedDoc).single();

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

document.getElementById('btn-import-project')?.addEventListener('click', () => {
    document.getElementById('import-file-input')?.click();
});

document.getElementById('import-file-input')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            const project = JSON.parse(evt.target.result);
            if (!project.docName || !Array.isArray(project.partsList)) {
                alert('EL ARCHIVO SELECCIONADO NO TIENE UN FORMATO VÁLIDO.');
                return;
            }

            const docName = project.docName.toUpperCase();
            const projectData = {
                doc_name: docName,
                bar_length: project.barLength || 6000,
                blade_width: project.bladeWidth || 0,
                parts_list: project.partsList,
                order_data: project.orderData || {},
                updated_at: new Date().toISOString()
            };

            const { error } = await supabaseClient.from('projects').upsert([projectData]);

            if (error) {
                alert('ERROR AL SUBIR A LA NUBE: ' + error.message);
                return;
            }

            await populateSavedProjectsDropdown(false);
            document.getElementById('saved-projects-select').value = docName;
            lastSelectedValue = docName;
            updateButtonStates();

            const autoLoad = window.confirm(`REGISTRO "${docName}" IMPORTADO CON ÉXITO.\n¿DESEAS CARGARLO EN PANTALLA AHORA?`);
            if (autoLoad) {
                currentLoadedId = project.docName;
                document.getElementById('project-name').value = project.docName;
                document.getElementById('bar-length').value = project.barLength || 6000;
                document.getElementById('blade-width').value = project.bladeWidth || 0;
                partsList = JSON.parse(JSON.stringify(project.partsList || []));
                sortPartsList();
                setOrderDataFields(project.orderData);
                renderPartsTable();
                updateButtonStates();
                document.getElementById('btn-optimize').click();
            }
        } catch (err) {
            alert('ERROR AL LEER EL ARCHIVO JSON: ' + err.message);
        }
        e.target.value = '';
    };
    reader.readAsText(file);
});

// =========================================================
// GESTIÓN DE FILAS MÚLTIPLES Y CARGA A LA DERECHA
// =========================================================

function renderInputRows() {
    const container = document.getElementById('input-rows-container');
    if (!container) return;
    container.innerHTML = '';

    if (editingIndex !== null && editingTempRow) {
        const tempRowDiv = document.createElement('div');
        tempRowDiv.style.cssText = 'display: grid; grid-template-columns: 1.5fr 1.2fr 1fr auto; gap: 8px; align-items: end; background: rgba(179, 85, 0, 0.08); padding: 8px; border-radius: 4px; border: 1px dashed #b35500;';
        tempRowDiv.innerHTML = `
            <div>
                <label style="display: block; margin-bottom: 5px; font-size: 10px; color: #b35500; font-weight: 700;">EDITANDO PIEZA</label>
                <input type="text" class="form-control temp-name" value="${editingTempRow.name || ''}" style="height: 34px;" autocomplete="off">
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; font-size: 10px; color: #b35500; font-weight: 700;">LONGITUD (mm):</label>
                <input type="number" class="form-control temp-length" value="${editingTempRow.length !== '' ? editingTempRow.length : ''}" min="0" style="height: 34px;">
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; font-size: 10px; color: #b35500; font-weight: 700;">CANTIDAD:</label>
                <input type="number" class="form-control temp-qty" value="${editingTempRow.qty !== '' ? editingTempRow.qty : ''}" min="0" style="height: 34px;">
            </div>
            <div style="display: flex; gap: 4px; align-items: center; height: 34px;">
                <button type="button" class="btn-add-box btn-temp-save active-mode" title="Guardar cambios de edición">
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
                <button type="button" class="btn-add-box btn-temp-cancel" title="Cancelar edición" style="border-color: #bb3030 !important;">
                    <svg viewBox="0 0 24 24" style="stroke: #bb3030;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;
        container.appendChild(tempRowDiv);

        tempRowDiv.querySelector('.temp-name').addEventListener('input', (e) => { editingTempRow.name = e.target.value; });
        tempRowDiv.querySelector('.temp-length').addEventListener('input', (e) => { editingTempRow.length = e.target.value === '' ? '' : parseFloat(e.target.value); });
        tempRowDiv.querySelector('.temp-qty').addEventListener('input', (e) => { editingTempRow.qty = e.target.value === '' ? '' : parseInt(e.target.value, 10); });

        tempRowDiv.querySelector('.btn-temp-save').addEventListener('click', () => {
            const barLength = parseFloat(document.getElementById('bar-length').value) || 6000;
            const name = (editingTempRow.name || '').trim();
            const length = parseFloat(editingTempRow.length);
            const qty = parseInt(editingTempRow.qty, 10);

            if (!name || isNaN(length) || length <= 0 || isNaN(qty) || qty <= 0) {
                alert('POR FAVOR COMPLETE CORRECTAMENTE LOS CAMPOS DE LA EDICIÓN.');
                return;
            }
            if (length > barLength) {
                alert('LA LONGITUD DE LA PIEZA NO PUEDE SER MAYOR QUE LA BARRA BASE.');
                return;
            }

            partsList[editingIndex] = { name, length, qty };
            sortPartsList();
            editingIndex = null;
            editingTempRow = null;
            renderInputRows();
            renderPartsTable();
            updateButtonStates();
        });

        tempRowDiv.querySelector('.btn-temp-cancel').addEventListener('click', () => {
            editingIndex = null;
            editingTempRow = null;
            renderInputRows();
            renderPartsTable();
        });
    }

    if (inputRows.length === 0) {
        inputRows.push({ name: '', length: '', qty: '' });
    }

    inputRows.forEach((row, index) => {
        const rowDiv = document.createElement('div');
        rowDiv.style.cssText = 'display: grid; grid-template-columns: 1.5fr 1.2fr 1fr auto; gap: 8px; align-items: end;';

        rowDiv.innerHTML = `
            <div>
                ${(index === 0 && editingIndex === null) ? '<label style="display: block; margin-bottom: 5px; font-size: 10px; color: #9e9ea6; font-weight: 600;">PIEZA</label>' : ''}
                <input type="text" class="form-control r-name" data-index="${index}" value="${row.name || ''}" style="height: 34px;" autocomplete="off">
            </div>
            <div>
                ${(index === 0 && editingIndex === null) ? '<label style="display: block; margin-bottom: 5px; font-size: 10px; color: #9e9ea6; font-weight: 600;">LONGITUD (mm):</label>' : ''}
                <input type="number" class="form-control r-length" data-index="${index}" value="${row.length !== '' ? row.length : ''}" min="0" style="height: 34px;">
            </div>
            <div>
                ${(index === 0 && editingIndex === null) ? '<label style="display: block; margin-bottom: 5px; font-size: 10px; color: #9e9ea6; font-weight: 600;">CANTIDAD:</label>' : ''}
                <input type="number" class="form-control r-qty" data-index="${index}" value="${row.qty !== '' ? row.qty : ''}" min="0" style="height: 34px;">
            </div>
            <div style="display: flex; gap: 4px; align-items: center; height: 34px;">
                <button type="button" class="btn-add-box btn-row-action" data-index="${index}" title="Agregar a la tabla">
                    <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button type="button" class="btn-add-box btn-row-delete" data-index="${index}" title="Eliminar fila" style="border-color: #bb3030 !important;">
                    <svg viewBox="0 0 24 24" style="stroke: #bb3030;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;
        container.appendChild(rowDiv);
    });

    document.querySelectorAll('.r-name').forEach(el => {
        el.addEventListener('input', (e) => {
            inputRows[e.target.dataset.index].name = e.target.value;
        });
    });
    document.querySelectorAll('.r-length').forEach(el => {
        el.addEventListener('input', (e) => {
            inputRows[e.target.dataset.index].length = e.target.value === '' ? '' : parseFloat(e.target.value);
        });
    });
    document.querySelectorAll('.r-qty').forEach(el => {
        el.addEventListener('input', (e) => {
            inputRows[e.target.dataset.index].qty = e.target.value === '' ? '' : parseInt(e.target.value, 10);
        });
    });

    document.querySelectorAll('.btn-row-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.closest('.btn-row-action').dataset.index, 10);
            const row = inputRows[idx];
            const barLength = parseFloat(document.getElementById('bar-length').value) || 6000;

            const name = (row.name || '').trim();
            const length = parseFloat(row.length);
            const qty = parseInt(row.qty, 10);

            if (!name || isNaN(length) || length <= 0 || isNaN(qty) || qty <= 0) {
                alert('POR FAVOR COMPLETE CORRECTAMENTE LOS CAMPOS DE ESTA FILA ANTES DE AGREGARLA.');
                return;
            }

            if (length > barLength) {
                alert('LA LONGITUD DE LA PIEZA NO PUEDE SER MAYOR QUE LA BARRA BASE.');
                return;
            }

            partsList.push({ name, length, qty });
            sortPartsList();

            inputRows.splice(idx, 1);
            if (inputRows.length === 0) {
                inputRows.push({ name: '', length: '', qty: '' });
            }

            renderInputRows();
            renderPartsTable();
            updateButtonStates();
        });
    });

    document.querySelectorAll('.btn-row-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.closest('.btn-row-delete').dataset.index, 10);
            inputRows.splice(idx, 1);
            if (inputRows.length === 0) {
                inputRows.push({ name: '', length: '', qty: '' });
            }
            renderInputRows();
        });
    });
}

document.getElementById('btn-add-row')?.addEventListener('click', () => {
    inputRows.push({ name: '', length: '', qty: '' });
    renderInputRows();
});

function renderPartsTable() {
    const tbody = document.getElementById('parts-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (partsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #555566; padding: 12px; font-size: 11px;">NO HAY PIEZAS AGREGADAS.</td></tr>`;
        return;
    }

    partsList.forEach((part, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #2a2a36';

        let isEditing = (index === editingIndex);
        let rowStyle = isEditing ? 'color: #b35500 !important; font-weight: bold;' : 'color: #c2c2d0;';

        tr.innerHTML = `
            <td style="padding: 6px 10px; font-size: 11px;"><span style="${rowStyle}">${part.name.toUpperCase()}</span></td>
            <td style="padding: 6px 10px; font-size: 11px;"><span style="${rowStyle}">${part.length} mm</span></td>
            <td style="padding: 6px 10px; font-size: 11px;"><span style="${rowStyle}">${part.qty}</span></td>
            <td style="padding: 6px 10px; text-align: center;">
                <div style="display: inline-flex; gap: 10px; justify-content: center; align-items: center;">
                    <button class="icon-btn btn-action-edit" data-index="${index}" title="${isEditing ? 'Cancelar edición' : 'Editar'}">
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="icon-btn btn-action-delete" data-index="${index}" title="Eliminar">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-action-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.closest('.btn-action-edit');
            if (target) editPart(parseInt(target.getAttribute('data-index'), 10));
        });
    });

    document.querySelectorAll('.btn-action-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.closest('.btn-action-delete');
            if (target) confirmRemovePart(parseInt(target.getAttribute('data-index'), 10));
        });
    });
}

function editPart(index) {
    if (editingIndex === index) {
        editingIndex = null;
        editingTempRow = null;
        renderInputRows();
        renderPartsTable();
        return;
    }

    const part = partsList[index];
    editingTempRow = { name: part.name, length: part.length, qty: part.qty };
    editingIndex = index;
    renderInputRows();
    renderPartsTable();
}

function confirmRemovePart(index) {
    const part = partsList[index];
    if (window.confirm(`¿ESTÁS SEGURO DE ELIMINAR LA PIEZA "${part.name.toUpperCase()}"?`)) {
        removePart(index);
    }
}

function removePart(index) {
    partsList.splice(index, 1);
    if (editingIndex === index) {
        editingIndex = null;
        editingTempRow = null;
    }
    renderInputRows();
    renderPartsTable();
    updateButtonStates();
}

function getPartColor(name) {
    if (!partColorsMap[name]) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        let hue = Math.abs(hash * 137) % 360;
        partColorsMap[name] = {
            normal: `hsl(${hue}, 55%, 55%)`,
            colorblind: `hsl(${(hue * 3) % 360}, 90%, 45%)`
        };
    }
    return isColorBlindMode ? partColorsMap[name].colorblind : partColorsMap[name].normal;
}

// =========================================================
// OPTIMIZACIÓN DE BARRAS
// =========================================================

document.getElementById('btn-optimize')?.addEventListener('click', () => {
    const projectName = document.getElementById('project-name').value.trim() || 'PROYECTO SIN NOMBRE';
    const barLength = parseFloat(document.getElementById('bar-length').value) || 6000;
    const bladeWidth = parseFloat(document.getElementById('blade-width').value) || 0;

    if (partsList.length === 0) {
        alert('DEBE AGREGAR AL MENOS UNA PIEZA A LA TABLA PARA OPTIMIZAR.');
        return;
    }

    let expandedParts = [];
    partsList.forEach(p => {
        for (let i = 0; i < p.qty; i++) {
            expandedParts.push({ name: p.name, length: parseFloat(p.length) });
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
    if (!container) return;

    const orderData = getOrderData();
    const profileCode = orderData.excelCodigo ? orderData.excelCodigo.toUpperCase() : '';
    const profileDesc = orderData.excelDescripcion ? orderData.excelDescripcion.toUpperCase() : '';
    const profileString = (profileCode || profileDesc) ? `${profileCode} ${profileDesc ? '- ' + profileDesc : ''}`.trim() : '';

    let html = `
        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 11px; display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span><strong>DOCUMENTO:</strong> ${projectName.toUpperCase()}</span>
                    <span style="border: 1px solid #383846; padding: 3px 8px; border-radius: 4px; font-weight: bold;">
                        BARRAS TOTALES: ${totalUsedBars}
                    </span>
                </div>
                ${profileString ? `<div style="font-size: 11px; color: #b35500;"><strong>PERFIL:</strong> ${profileString}</div>` : ''}
            </div>
            <button id="btn-print-report" class="btn-app" style="background-color: #b35500; color: #ffffff;">IMPRIMIR REPORTE</button>
        </div>

        <div class="print-parts-summary" style="margin-bottom: 12px; background: #23232c; padding: 10px; border-radius: 4px; border: 1px solid #2f2f3d;">
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <thead>
                    <tr style="background: #2d2c38; color: #a5a5b5;">
                        <th style="padding: 5px; text-align: left; border: 1px solid #383846;">LISTA DE PIEZAS</th>
                        <th style="padding: 5px; text-align: left; border: 1px solid #383846;">LONGITUD (mm)</th>
                        <th style="padding: 5px; text-align: center; border: 1px solid #383846;">CANTIDAD</th>
                    </tr>
                </thead>
                <tbody>
    `;

    partsList.forEach(p => {
        html += `
                    <tr>
                        <td style="padding: 4px 6px; border: 1px solid #383846;">${p.name.toUpperCase()}</td>
                        <td style="padding: 4px 6px; border: 1px solid #383846;">${p.length} mm</td>
                        <td style="padding: 4px 6px; border: 1px solid #383846; text-align: center;">${p.qty}</td>
                    </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
    `;

    groups.forEach((group, idx) => {
        let barNum = idx + 1;
        let barUsedLength = barLength - group.remaining;
        let waste = group.remaining;
        let efficiency = ((barUsedLength / barLength) * 100).toFixed(1);

        html += `
            <div class="print-bar-card bar-hover-effect" style="background: #23232c; padding: 10px; border-radius: 4px; border: 1px solid #2f2f3d; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: bold;">CANT ${group.count}</span>
                        <span>BARRA ${barNum} | UTILIZADO: ${barUsedLength} mm / SOBRANTE: ${waste} mm | EFICIENCIA: <strong>${efficiency}%</strong></span>
                    </div>
                </div>
                <div class="print-bar-track" style="height: 26px; background: #121217; border-radius: 3px; display: flex; overflow: hidden; border: 1px solid #2f2f3d;">
        `;

        group.cuts.forEach((cut) => {
            let widthPercent = (cut.length / barLength) * 100;
            let partColor = getPartColor(cut.name);
            let patternStyle = isColorBlindMode ? `; background-image: repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255, 255, 255, 0.15) 4px, rgba(255, 255, 255, 0.15) 8px)` : '';
            
            html += `
                <div class="print-cut-block" title="${cut.name}: ${cut.length}" style="width: ${widthPercent}%; background-color: ${partColor}${patternStyle}; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; overflow: hidden; white-space: nowrap; border-right: 1px solid #121217; padding: 2px; box-sizing: border-box;" >
                    <strong style="font-size: 8px; line-height: 9px; text-overflow: ellipsis; overflow: hidden; max-width: 100%; color: #fff;">${cut.name.toUpperCase()}</strong>
                    <span style="font-size: 8px; font-weight: bold; color: #fff;">${cut.length}</span>
                </div>
            `;
        });

        if (waste > 0) {
            let wastePercent = (waste / barLength) * 100;
            html += `
                <div class="print-waste-block" title="Sobrante: ${waste}mm" style="width: ${wastePercent}%; background: repeating-linear-gradient(45deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05) 5px, transparent 5px, transparent 10px);"></div>
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
        printBtn.addEventListener('click', () => window.print());
    }
}

const dynamicStyle = document.createElement('style');
dynamicStyle.innerHTML = `
    .bar-hover-effect:hover {
        border-color: #b35500 !important;
        background-color: #272732 !important;
        box-shadow: 0 0 8px rgba(179, 85, 0, 0.25);
    }
    @media print {
        @page { 
            size: A4 landscape; 
            margin: 8mm; 
        }
        body { 
            background: #ffffff !important; 
            color: #000000 !important; 
            font-family: system-ui, -apple-system, sans-serif !important; 
            margin: 0 !important; 
            padding: 0 !important; 
        }
        header, .card:not(#results-card), #btn-optimize, button { 
            display: none !important; 
        }
        #results-card { 
            border: none !important; 
            box-shadow: none !important; 
            background: #ffffff !important; 
            padding: 0 !important; 
            margin: 0 !important; 
        }
        #results-card * { 
            color: #000000 !important; 
            text-shadow: none !important; 
        }
        table { 
            border-collapse: collapse !important; 
            width: 100% !important; 
        }
        th, td { 
            border: 1px solid #000000 !important; 
            padding: 4px 8px !important; 
            font-size: 10px !important; 
        }
        .print-parts-summary { 
            background: #ffffff !important; 
            border: 1px solid #000000 !important; 
            margin-bottom: 12px !important; 
        }
        .print-bar-card { 
            background: #ffffff !important; 
            border: 1px solid #000000 !important; 
            border-radius: 0px !important; 
            margin-bottom: 6mm !important; 
            padding: 6px !important; 
            page-break-inside: avoid; 
            box-shadow: none !important; 
        }
        .print-bar-track { 
            height: 24px !important; 
            background: #ffffff !important; 
            border: 1px solid #000000 !important; 
            border-radius: 0 !important; 
        }
        .print-cut-block { 
            background: #f0f0f0 !important; 
            color: #000000 !important; 
            border-right: 1px solid #000000 !important; 
            box-sizing: border-box !important; 
        }
        .print-cut-block strong, .print-cut-block span { 
            color: #000000 !important; 
            font-weight: 700 !important; 
            font-size: 9px !important; 
            text-shadow: none !important; 
        }
        .print-waste-block { 
            background: #ffffff !important; 
            background-image: repeating-linear-gradient(45deg, #ccc, #ccc 2px, #fff 2px, #fff 6px) !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            border-left: 1px solid #000000 !important; 
        }
    }
`;
document.head.appendChild(dynamicStyle);

window.addEventListener('DOMContentLoaded', async () => {
    await populateSavedProjectsDropdown();
    initRealtimeSync();
    renderInputRows();
    renderPartsTable();
    updateButtonStates();
    const bladeInput = document.getElementById('blade-width');
    if(bladeInput && !bladeInput.value) bladeInput.value = '0';
    const selectElem = document.getElementById('saved-projects-select');
    if(selectElem) lastSelectedValue = selectElem.value;
});

// =========================================================
// MÓDULO DE ADMINISTRACIÓN Y BASE DE DATOS EXCEL
// =========================================================

let excelRowsData = [];

document.getElementById('btn-admin')?.addEventListener('click', () => {
    const password = prompt('INGRESE LA CONTRASEÑA DE ADMINISTRADOR:');
    if (password === null) return;
    
    if (password.trim() === 'datawaves') {
        alert('¡ACCESO CONCEDIDO!');
        document.getElementById('admin-controls-container').style.display = 'flex';
        const btnAdmin = document.getElementById('btn-admin');
        btnAdmin.style.borderColor = '#28a745';
        btnAdmin.style.color = '#28a745';
        btnAdmin.textContent = 'ADMIN (ACTIVO)';
    } else {
        alert('CONTRASEÑA INCORRECTA.');
    }
});

document.getElementById('btn-open-excel-db')?.addEventListener('click', async () => {
    document.getElementById('excel-modal').style.display = 'flex';
    await cargarDatosExcelDesdeSupabase();
    restaurarAnchosColumnas();
});

document.getElementById('btn-close-excel-modal')?.addEventListener('click', () => {
    document.getElementById('excel-modal').style.display = 'none';
});

async function cargarDatosExcelDesdeSupabase() {
    const { data, error } = await supabaseClient.from('excel_database').select('*').order('created_at', { ascending: true });

    if (error) {
        const local = localStorage.getItem('datawaves_excel_db');
        excelRowsData = local ? JSON.parse(local) : [];
    } else {
        excelRowsData = data || [];
    }

    if (excelRowsData.length === 0) {
        excelRowsData.push({ codigo: '', descripcion: '', categoria: '', largo: '' });
    }
    renderExcelTable();
}

function renderExcelTable() {
    const tbody = document.getElementById('excel-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    excelRowsData.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #2a2a36';
        
        tr.innerHTML = `
            <td style="padding: 4px; border: 1px solid #383846; position: relative;">
                <input type="text" class="excel-input" data-index="${index}" data-field="codigo" value="${row.codigo || ''}" style="background: transparent; border: none; color: #c2c2d0; width: 100%; outline: none; padding: 4px;">
                <div class="drag-handle" title="Copiar hacia abajo" data-index="${index}" data-field="codigo" style="position: absolute; right: 2px; bottom: 2px; width: 6px; height: 6px; background: #b35500; cursor: s-resize; display: none;"></div>
            </td>
            <td style="padding: 4px; border: 1px solid #383846; position: relative;">
                <input type="text" class="excel-input" data-index="${index}" data-field="descripcion" value="${row.descripcion || ''}" style="background: transparent; border: none; color: #c2c2d0; width: 100%; outline: none; padding: 4px;">
                <div class="drag-handle" title="Copiar hacia abajo" data-index="${index}" data-field="descripcion" style="position: absolute; right: 2px; bottom: 2px; width: 6px; height: 6px; background: #b35500; cursor: s-resize; display: none;"></div>
            </td>
            <td style="padding: 4px; border: 1px solid #383846; position: relative;">
                <input type="text" class="excel-input" data-index="${index}" data-field="categoria" value="${row.categoria || ''}" style="background: transparent; border: none; color: #c2c2d0; width: 100%; outline: none; padding: 4px;">
                <div class="drag-handle" title="Copiar hacia abajo" data-index="${index}" data-field="categoria" style="position: absolute; right: 2px; bottom: 2px; width: 6px; height: 6px; background: #b35500; cursor: s-resize; display: none;"></div>
            </td>
            <td style="padding: 4px; border: 1px solid #383846; position: relative;">
                <input type="number" class="excel-input" data-index="${index}" data-field="largo" value="${row.largo || ''}" style="background: transparent; border: none; color: #c2c2d0; width: 100%; outline: none; padding: 4px;">
                <div class="drag-handle" title="Copiar hacia abajo" data-index="${index}" data-field="largo" style="position: absolute; right: 2px; bottom: 2px; width: 6px; height: 6px; background: #b35500; cursor: s-resize; display: none;"></div>
            </td>
            <td style="padding: 4px; border: 1px solid #383846; text-align: center;">
                <button class="icon-btn btn-delete-excel-row" data-index="${index}" title="Eliminar fila">
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; stroke: #bb3030;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.excel-input').forEach(input => {
        input.addEventListener('focus', (e) => {
            const td = e.target.closest('td');
            const handle = td?.querySelector('.drag-handle');
            if (handle) handle.style.display = 'block';
        });
        input.addEventListener('blur', (e) => {
            setTimeout(() => {
                const td = e.target.closest('td');
                const handle = td?.querySelector('.drag-handle');
                if (handle) handle.style.display = 'none';
            }, 200);
        });

        input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'), 10);
            const field = e.target.getAttribute('data-field');
            if (excelRowsData[idx]) {
                excelRowsData[idx][field] = e.target.value;
            }
        });
    });

    document.querySelectorAll('.drag-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const startIdx = parseInt(e.target.getAttribute('data-index'), 10);
            const field = e.target.getAttribute('data-field');
            const valToCopy = excelRowsData[startIdx][field];

            function onMouseMove(moveEvent) {
                const elemUnder = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
                if (elemUnder && elemUnder.classList.contains('excel-input')) {
                    const targetIdx = parseInt(elemUnder.getAttribute('data-index'), 10);
                    const targetField = elemUnder.getAttribute('data-field');
                    if (targetField === field && targetIdx >= startIdx) {
                        excelRowsData[targetIdx][field] = valToCopy;
                        elemUnder.value = valToCopy;
                    }
                }
            }

            function onMouseUp() {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                renderExcelTable();
            }

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    });

    document.querySelectorAll('.btn-delete-excel-row').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.target.closest('.btn-delete-excel-row');
            if (target) {
                const idx = parseInt(target.getAttribute('data-index'), 10);
                const rowToDelete = excelRowsData[idx];
                if (rowToDelete && rowToDelete.id) {
                    await supabaseClient.from('excel_database').delete().eq('id', rowToDelete.id);
                }
                excelRowsData.splice(idx, 1);
                renderExcelTable();
            }
        });
    });
}

document.getElementById('btn-excel-add-row')?.addEventListener('click', () => {
    excelRowsData.push({ codigo: '', descripcion: '', categoria: '', largo: '' });
    renderExcelTable();
});

document.getElementById('btn-excel-save')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-excel-save');
    btn.textContent = 'GUARDANDO...';
    btn.disabled = true;

    await supabaseClient.from('excel_database').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const cleanRows = excelRowsData
        .filter(r => r.codigo || r.descripcion || r.categoria || r.largo)
        .map(r => ({
            codigo: r.codigo || '',
            descripcion: r.descripcion || '',
            categoria: r.categoria || '',
            largo: r.largo || ''
        }));

    if (cleanRows.length > 0) {
        const { error } = await supabaseClient.from('excel_database').insert(cleanRows);
        if (error) {
            alert('ERROR AL GUARDAR EN NUBE: ' + error.message);
            btn.textContent = 'GUARDAR CAMBIOS';
            btn.disabled = false;
            return;
        }
    }

    localStorage.setItem('datawaves_excel_db', JSON.stringify(excelRowsData));
    alert('¡DATOS GUARDADOS EN NUBE CON ÉXITO!');
    btn.textContent = 'GUARDAR CAMBIOS';
    btn.disabled = false;
    document.getElementById('excel-modal').style.display = 'none';
});

function guardarAnchosColumnas() {
    const ths = document.querySelectorAll('#excel-editable-table th');
    const anchos = Array.from(ths).map(th => th.style.width || th.offsetWidth + 'px');
    localStorage.setItem('datawaves_excel_widths', JSON.stringify(anchos));
}

function restaurarAnchosColumnas() {
    const savedWidths = localStorage.getItem('datawaves_excel_widths');
    if (savedWidths) {
        try {
            const anchos = JSON.parse(savedWidths);
            const ths = document.querySelectorAll('#excel-editable-table th');
            ths.forEach((th, i) => {
                if (anchos[i]) th.style.width = anchos[i];
            });
        } catch(e) {}
    }
}

document.addEventListener('mouseup', () => {
    const modal = document.getElementById('excel-modal');
    if (modal && modal.style.display === 'flex') {
        guardarAnchosColumnas();
    }
});
