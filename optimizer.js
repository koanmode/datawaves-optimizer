// =========================================================
// DATAWAVES OPTIMIZER - LÓGICA DE CONTROL Y SUPABASE
// =========================================================

const SUPABASE_URL = 'https://sksanvauywgjxmxujicl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2fuRdNLrO24nN5HA6e8lmw_v6IYVleX';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let partsList = [];
let editingIndex = null;
let partColorsMap = {};
let currentLoadedId = null; 
let isColorBlindMode = false; // Estado del modo daltónico

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
    ['doc-id', 'doc-of', 'doc-descripcion', 'doc-cliente', 'doc-obra'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
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
    const deleteBtn = document.getElementById('btn-delete-project');
    const exportBtn = document.getElementById('btn-export-project');
    const select = document.getElementById('saved-projects-select');

    if (projectName.length > 0 && partsList.length > 0) {
        saveBtn.disabled = false;
    } else {
        saveBtn.disabled = true;
    }

    if (currentLoadedId && projectName.length > 0 && partsList.length > 0) {
        updateBtn.disabled = false;
    } else {
        updateBtn.disabled = true;
    }

    if (select && select.value !== "") {
        deleteBtn.disabled = false;

        if (exportBtn) {
            exportBtn.disabled = false;
        }
    } else {
        deleteBtn.disabled = true;

        if (exportBtn) {
            exportBtn.disabled = true;
        }
    }
}

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

    data.forEach(row => {
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

document.getElementById('project-name').addEventListener('input', () => {
    updateButtonStates();
});

// EVENTO PARA EL BOTÓN DE MODO DALTÓNICO (OJO)
document.getElementById('btn-colorblind-mode').addEventListener('click', () => {
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

    // Recalcular/renderizar resultados si ya hay piezas optimizadas
    if (partsList.length > 0) {
        document.getElementById('btn-optimize').click();
    }
});

// CONTROL INTELIGENTE DEL SELECTOR (CARGAR / NUEVO AUTOMÁTICO)
let lastSelectedValue = "";

document.getElementById('saved-projects-select').addEventListener('change', async function() {
    const selectedDoc = this.value;
    const hasProgress = document.getElementById('project-name').value.trim().length > 0 || partsList.length > 0;

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
        const confirmarCarga = window.confirm('¿ESTAS SEGURO DE CARGAR UN REGISTRO EXISTENTE? PERDERAS EL PROGRESO ACTUAL.');
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
    document.getElementById('bar-length').value = data.bar_length;
    document.getElementById('blade-width').value = data.blade_width;
    partsList = JSON.parse(JSON.stringify(data.parts_list || []));
    editingIndex = null;

    setOrderDataFields(data.order_data);

    renderPartsTable();
    updateButtonStates();
    
    document.getElementById('btn-optimize').click();
}

function executeNewProjectReset() {
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
}

document.getElementById('btn-save-project').addEventListener('click', async () => {
    let rawDocName = document.getElementById('project-name').value.trim();
    const ofVal = document.getElementById('doc-of').value.trim();
    
    let docName = formatDocNameWithOF(rawDocName, ofVal).toUpperCase();
    document.getElementById('project-name').value = docName;

    const barLength = parseFloat(document.getElementById('bar-length').value);
    const bladeWidth = parseFloat(document.getElementById('blade-width').value) || 0;

    if (!docName || partsList.length === 0) {
        alert('DEBE INGRESAR UN NOMBRE DE PROYECTO Y AL MENOS UNA PIEZA PARA REGISTRAR.');
        return;
    }

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
    
    await populateSavedProjectsDropdown(false);
    document.getElementById('saved-projects-select').value = docName;
    lastSelectedValue = docName;
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

    const { error } = await supabaseClient
        .from('projects')
        .upsert([projectData]);

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
    
    await populateSavedProjectsDropdown(false);
    document.getElementById('saved-projects-select').value = "";
    lastSelectedValue = "";
    updateButtonStates();
    alert(`EL REGISTRO "${selectedDoc}" FUE ELIMINADO CON ÉXITO.`);
});

// =========================================================
// IMPORTACIÓN Y EXPORTACIÓN JSON
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

            await populateSavedProjectsDropdown(false);
            document.getElementById('saved-projects-select').value = docName;
            lastSelectedValue = docName;
            updateButtonStates();

            const autoLoad = window.confirm(`REGISTRO "${docName}" IMPORTADO A LA NUBE CON ÉXITO.\n¿DESEAS CARGARLO EN PANTALLA AHORA?`);
            if (autoLoad) {
                currentLoadedId = project.docName;
                document.getElementById('project-name').value = project.docName;
                document.getElementById('bar-length').value = project.barLength;
                document.getElementById('blade-width').value = project.bladeWidth || 2;
                partsList = JSON.parse(JSON.stringify(project.partsList || []));
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

    const addBtn = document.getElementById('btn-add-part');

    if (editingIndex !== null) {
        partsList[editingIndex] = { name, length, qty };
        editingIndex = null;
        addBtn.title = 'Agregar pieza';
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
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #555566; padding: 12px; font-size: 11px;">NO HAY PIEZAS AGREGADAS.</td></tr>`;
        return;
    }

    partsList.forEach((part, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #2a2a36';

        let isEditing = (index === editingIndex);
        let rowStyle = isEditing ? 'color: #e06b00 !important; font-weight: bold;' : 'color: #c2c2d0;';

        tr.innerHTML = `
            <td style="padding: 6px 10px; font-size: 11px;"><span style="${rowStyle}">${part.name.toUpperCase()}</span></td>
            <td style="padding: 6px 10px; font-size: 11px;"><span style="${rowStyle}">${part.length} mm</span></td>
            <td style="padding: 6px 10px; font-size: 11px;"><span style="${rowStyle}">${part.qty}</span></td>
            <td style="padding: 6px 10px; text-align: center;">
                <div style="display: inline-flex; gap: 10px; justify-content: center; align-items: center;">
                    <button class="icon-btn btn-action-edit" data-index="${index}" title="${isEditing ? 'Cancelar' : 'Editar'}">
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
            if (target) {
                const index = parseInt(target.getAttribute('data-index'));
                editPart(index);
            }
        });
    });

    document.querySelectorAll('.btn-action-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.closest('.btn-action-delete');
            if (target) {
                const index = parseInt(target.getAttribute('data-index'));
                confirmRemovePart(index);
            }
        });
    });
}

function editPart(index) {
    const addBtn = document.getElementById('btn-add-part');

    if (editingIndex === index) {
        editingIndex = null;
        addBtn.title = 'Agregar pieza';
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
    
    addBtn.title = 'Actualizar pieza';
    
    renderPartsTable();
    document.getElementById('part-name').focus();
}

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
        addBtn.title = 'Agregar pieza';
        document.getElementById('part-name').value = '';
        document.getElementById('part-length').value = '';
        document.getElementById('part-qty').value = '';
    }
    renderPartsTable();
    updateButtonStates();
}

// GENERADOR DE COLORES Y PATRONES ADAPTADOS PARA MODO DALTÓNICO
function getPartColor(name) {
    if (!partColorsMap[name]) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        let hue = Math.abs(hash * 137) % 360;
        partColorsMap[name] = {
            normal: `hsl(${hue}, 55%, 55%)`,
            // Alto contraste y diferenciación segura para daltónicos (Tonos optimizados y alta saturación)
            colorblind: `hsl(${(hue * 3) % 360}, 90%, 45%)`
        };
    }
    return isColorBlindMode ? partColorsMap[name].colorblind : partColorsMap[name].normal;
}

// =========================================================
// OPTIMIZACIÓN DE BARRAS
// =========================================================

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
        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 11px; display: flex; align-items: center; gap: 12px;">
                <span><strong>DOCUMENTO:</strong> ${projectName.toUpperCase()}</span>
                <span style="border: 1px solid #383846; padding: 3px 8px; border-radius: 4px; font-weight: bold;">
                    BARRAS TOTALES: ${totalUsedBars}
                </span>
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
            
            // Si el modo daltónico está activo, aplicamos patrones geométricos adicionales de textura a los bloques de corte para asegurar máxima distinción visual
            let patternStyle = isColorBlindMode ? `; background-image: repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255, 255, 255, 0.15) 4px, rgba(255, 255, 255, 0.15) 8px)` : '';
            
            html += `
                <div class="print-cut-block" title="${cut.name}: ${cut.length}" style="width: ${widthPercent}%; background-color: ${partColor}${patternStyle}; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; overflow: hidden; white-space: nowrap; border-right: 1px solid #121217; padding: 2px; box-sizing: border-box;" >
                    <strong style="font-size: 8px; line-height: 9px; text-overflow: ellipsis; overflow: hidden; max-width: 100%; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${cut.name.toUpperCase()}</strong>
                    <span style="font-size: 8px; font-weight: bold; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${cut.length}</span>
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
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
}

// ESTILOS DINÁMICOS PARA EL HOVER DE LAS BARRAS E IMPRESIÓN
const dynamicStyle = document.createElement('style');
dynamicStyle.innerHTML = `
    .bar-hover-effect:hover {
        border-color: #b35500 !important;
        background-color: #272732 !important;
        box-shadow: 0 0 8px rgba(179, 85, 0, 0.25);
    }

    @media print {
        @page { size: A4 portrait; margin: 10mm; }
        body { background: #ffffff !important; color: #000000 !important; font-family: system-ui, -apple-system, sans-serif !important; margin: 0 !important; padding: 0 !important; }
        header, .card:not(#results-card), #btn-optimize, button { display: none !important; }
        #results-card { border: none !important; box-shadow: none !important; background: #ffffff !important; padding: 0 !important; margin: 0 !important; }
        #results-card * { color: #000000 !important; }
        table { border-collapse: collapse !important; width: 100% !important; }
        th, td { border: 1px solid #000000 !important; padding: 4px 8px !important; font-size: 10px !important; }
        .print-parts-summary { background: #ffffff !important; border: 1px solid #000000 !important; margin-bottom: 12px !important; }
        .print-bar-card { background: #ffffff !important; border: 1px solid #000000 !important; border-radius: 2px !important; margin-bottom: 8mm !important; padding: 6px !important; page-break-inside: avoid; box-shadow: none !important; }
        .print-bar-track { height: 22px !important; background: #ffffff !important; border: 1px solid #000000 !important; border-radius: 0 !important; }
        .print-cut-block { background: #ffffff !important; color: #000000 !important; border-right: 1px solid #000000 !important; box-sizing: border-box !important; }
        .print-cut-block strong, .print-cut-block span { color: #000000 !important; font-weight: 700 !important; font-size: 8px !important; }
        .print-waste-block { background: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border-left: 1px solid #000000 !important; }
    }
`;
document.head.appendChild(dynamicStyle);

window.addEventListener('DOMContentLoaded', async () => {
    await populateSavedProjectsDropdown();
    initRealtimeSync();
    updateButtonStates();
    const bladeInput = document.getElementById('blade-width');
    if(bladeInput && !bladeInput.value) bladeInput.value = 2;
    
    const selectElem = document.getElementById('saved-projects-select');
    if(selectElem) lastSelectedValue = selectElem.value;
});
